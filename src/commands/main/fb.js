const fs = require('fs');
const path = require('path');
const { execFile, execSync } = require('child_process');

const TEMP_DIR = path.join(__dirname, '../../../temp');

function getNodePath() {
  try { return execSync('which node', { encoding: 'utf8' }).trim(); } catch (_) { return 'node'; }
}

const NODE_PATH = getNodePath();

const COMMON_ARGS = [
  '--no-playlist',
  '--no-check-certificates',
  '--js-runtimes', `node:${NODE_PATH}`,
  '--remote-components', 'ejs:github',
];

function ytDlp(args) {
  return new Promise((resolve, reject) => {
    execFile('python3', ['-m', 'yt_dlp', ...args], { maxBuffer: 50 * 1024 * 1024, timeout: 60000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr?.slice(0, 300) || err.message));
      resolve(stdout);
    });
  });
}

async function fetchInfo(url) {
  const raw = await ytDlp([url, '--dump-json', ...COMMON_ARGS]);
  const lines = raw.trim().split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    try { return JSON.parse(lines[i]); } catch (_) {}
  }
  throw new Error('Could not parse media info');
}

async function downloadVideo(url, outputPath) {
  const ffmpegPath = require('ffmpeg-static');
  await ytDlp([
    url,
    '-f', 'bestvideo[vcodec^=avc][ext=mp4]+bestaudio[ext=m4a]/bestvideo[vcodec^=avc]+bestaudio/bestvideo[ext=mp4]+bestaudio/best[ext=mp4]/best',
    ...COMMON_ARGS,
    '--merge-output-format', 'mp4',
    '--recode-video', 'mp4',
    '--postprocessor-args', `ffmpeg:-c:v libx264 -c:a aac -movflags +faststart`,
    '--ffmpeg-location', ffmpegPath,
    '-o', outputPath,
  ]);
}

module.exports = {
  name: 'fb',
  description: 'Download Facebook videos and Reels',
  usage: '.fb <facebook url>',

  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;

    if (!args.length) {
      return sock.sendMessage(jid, {
        text: `📘 *Facebook Downloader*\n\nUsage: *.fb <Facebook URL>*\n\nSupports:\n• Facebook Videos\n• Facebook Reels\n• Watch videos\n\nExample:\n*.fb https://www.facebook.com/watch?v=123456*`
      }, { quoted: msg });
    }

    const url = args[0];
    if (!url.includes('facebook.com') && !url.includes('fb.watch') && !url.includes('fb.com')) {
      return sock.sendMessage(jid, {
        text: `❌ Please provide a valid Facebook URL.`
      }, { quoted: msg });
    }

    const statusMsg = await sock.sendMessage(jid, {
      text: `⏳ *Fetching Facebook media...*`
    }, { quoted: msg });

    if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

    let info;
    try {
      info = await fetchInfo(url);
    } catch (e) {
      return sock.sendMessage(jid, {
        text: `❌ *Failed to fetch Facebook media.*\n_Make sure the video is public and the URL is correct._\n\n_${e.message.slice(0, 200)}_`,
        edit: statusMsg.key,
      });
    }

    const title = info.title || info.fulltitle || 'Facebook Video';
    const uploader = info.uploader || info.channel || 'Unknown';
    const duration = info.duration ? `${Math.floor(info.duration)}s` : '?';
    const views = info.view_count ? info.view_count.toLocaleString() : '?';

    await sock.sendMessage(jid, {
      text: `⬇️ *Downloading...*\n\n📘 ${title}\n👤 ${uploader}\n⏱ ${duration} | 👁 ${views} views`,
      edit: statusMsg.key,
    });

    const safeTitle = (title).replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 40);
    const outputPath = path.join(TEMP_DIR, `fb_${Date.now()}_${safeTitle}.mp4`);

    try {
      await downloadVideo(url, outputPath);

      const finalPath = fs.existsSync(outputPath)
        ? outputPath
        : fs.readdirSync(TEMP_DIR)
            .filter(f => f.startsWith('fb_') && f.includes(safeTitle))
            .map(f => path.join(TEMP_DIR, f))
            .find(f => fs.existsSync(f));

      if (!finalPath) throw new Error('Downloaded file not found.');

      const fileBuffer = fs.readFileSync(finalPath);
      const fileSizeMB = (fileBuffer.length / 1024 / 1024).toFixed(2);

      await sock.sendMessage(jid, {
        text: `⬆️ *Uploading...*\n📦 ${fileSizeMB} MB`,
        edit: statusMsg.key,
      });

      if (fileBuffer.length <= 64 * 1024 * 1024) {
        await sock.sendMessage(jid, {
          video: fileBuffer,
          mimetype: 'video/mp4',
          fileName: `facebook_${Date.now()}.mp4`,
          caption: `📘 *${title}*\n👤 ${uploader}\n\n*㋛ 𝙿𝙾𝚆𝙴𝚁𝙳 𝙱𝚈 𝙻𝙴𝚂𝙰𝙽𝙳𝚄  〽️Ｄ*`,
        }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, {
          document: fileBuffer,
          mimetype: 'video/mp4',
          fileName: `facebook_${Date.now()}.mp4`,
          caption: `📘 *${title}*\n👤 ${uploader}\n\n*㋛ 𝙿𝙾𝚆𝙴𝚁𝙳 𝙱𝚈 𝙻𝙴𝚂𝙰𝙽𝙳𝚄  〽️Ｄ*`,
        }, { quoted: msg });
      }

      await sock.sendMessage(jid, {
        text: `✅ *Done!*\n📘 ${title}\n👤 ${uploader} — ${fileSizeMB} MB`,
        edit: statusMsg.key,
      });

      try { fs.unlinkSync(finalPath); } catch (_) {}

    } catch (e) {
      await sock.sendMessage(jid, {
        text: `❌ *Download failed.*\n_${e.message.slice(0, 200)}_`,
        edit: statusMsg.key,
      });
      try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch (_) {}
    }
  },
};
