const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const axios = require('axios');

const TEMP_DIR = path.join(__dirname, '../../../temp');

async function fetchTikTokInfo(url) {
  const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`;
  const res = await axios.get(apiUrl, {
    timeout: 15000,
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  const data = res.data;
  if (!data || data.code !== 0 || !data.data) {
    throw new Error(data?.msg || 'Failed to fetch TikTok info');
  }
  return data.data;
}

async function downloadBuffer(url) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 60000,
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  return Buffer.from(res.data);
}

module.exports = {
  name: 'tt',
  description: 'Download TikTok video without watermark',
  usage: '.tt <tiktok url>',

  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;

    if (!args.length) {
      return sock.sendMessage(jid, {
        text: `🎵 *TikTok Downloader*\n\nUsage: *.tt <TikTok URL>*\n\nExample:\n*.tt https://www.tiktok.com/@user/video/123456789*`
      }, { quoted: msg });
    }

    const url = args[0];
    if (!url.includes('tiktok.com') && !url.includes('vm.tiktok.com') && !url.includes('vt.tiktok.com')) {
      return sock.sendMessage(jid, {
        text: `❌ Please provide a valid TikTok URL.`
      }, { quoted: msg });
    }

    const statusMsg = await sock.sendMessage(jid, {
      text: `⏳ *Fetching TikTok video...*`
    }, { quoted: msg });

    if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

    let info;
    try {
      info = await fetchTikTokInfo(url);
    } catch (e) {
      return sock.sendMessage(jid, {
        text: `❌ *Failed to fetch TikTok info.*\n_${e.message.slice(0, 200)}_`,
        edit: statusMsg.key,
      });
    }

    const title = info.title || 'TikTok Video';
    const author = info.author?.nickname || info.author?.unique_id || 'Unknown';
    const duration = info.duration ? `${info.duration}s` : '?';
    const plays = info.play_count ? info.play_count.toLocaleString() : '?';
    const likes = info.digg_count ? info.digg_count.toLocaleString() : '?';

    const hdUrl = info.hdplay || info.play;
    const noWmUrl = info.play;

    if (!hdUrl && !noWmUrl) {
      return sock.sendMessage(jid, {
        text: `❌ No downloadable video found for this TikTok.`,
        edit: statusMsg.key,
      });
    }

    await sock.sendMessage(jid, {
      text: `⬇️ *Downloading...*\n\n🎵 ${title}\n👤 @${author}\n⏱ ${duration} | ▶️ ${plays} plays | ❤️ ${likes} likes`,
      edit: statusMsg.key,
    });

    try {
      const videoBuffer = await downloadBuffer(hdUrl || noWmUrl);
      const fileSizeMB = (videoBuffer.length / 1024 / 1024).toFixed(2);

      await sock.sendMessage(jid, {
        text: `⬆️ *Uploading...*\n\n🎵 ${title}\n📦 ${fileSizeMB} MB`,
        edit: statusMsg.key,
      });

      if (videoBuffer.length <= 64 * 1024 * 1024) {
        await sock.sendMessage(jid, {
          video: videoBuffer,
          mimetype: 'video/mp4',
          fileName: `tiktok_${Date.now()}.mp4`,
          caption: `🎵 *${title}*\n👤 @${author}\n\n*㋛ 𝙿𝙾𝚆𝙴𝚁𝙳 𝙱𝚈 𝙻𝙴𝚂𝙰𝙽𝙳𝚄  〽️Ｄ*`,
        }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, {
          document: videoBuffer,
          mimetype: 'video/mp4',
          fileName: `tiktok_${Date.now()}.mp4`,
          caption: `🎵 *${title}*\n👤 @${author}\n\n*㋛ 𝙿𝙾𝚆𝙴𝚁𝙳 𝙱𝚈 𝙻𝙴𝚂𝙰𝙽𝙳𝚄  〽️Ｄ*`,
        }, { quoted: msg });
      }

      await sock.sendMessage(jid, {
        text: `✅ *Done!*\n\n🎵 ${title}\n👤 @${author} — ${fileSizeMB} MB`,
        edit: statusMsg.key,
      });

    } catch (e) {
      await sock.sendMessage(jid, {
        text: `❌ *Download failed.*\n_${e.message.slice(0, 200)}_`,
        edit: statusMsg.key,
      });
    }
  },
};
