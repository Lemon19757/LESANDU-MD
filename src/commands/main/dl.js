const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { isOwner, getSender } = require('./utils');

const TEMP_DIR = path.join(__dirname, '../../../temp');

function buildProgressText(filename, done, fileSize, speed, type = 'download') {
  const percent = fileSize > 0 ? Math.round((done / fileSize) * 100) : 0;
  const filled = Math.round(percent / 5);
  const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);
  const doneMB = (done / 1024 / 1024).toFixed(2);
  const totalMB = fileSize > 0 ? (fileSize / 1024 / 1024).toFixed(2) : '?';
  const speedMB = (speed / 1024 / 1024).toFixed(2);
  const icon = type === 'upload' ? '⬆️' : '⬇️';
  const label = type === 'upload' ? 'Sending' : 'Downloading';
  return `${icon} *${label} File*\n\n📄 \`${filename}\`\n\n${bar} *${percent}%*\n\n💾 ${doneMB} / ${totalMB} MB\n⚡ ${speedMB} MB/s`;
}

function getFilenameFromUrl(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1];
    return last ? decodeURIComponent(last) : 'downloaded_file';
  } catch {
    return 'downloaded_file';
  }
}

async function resolveTarget(sock, arg) {
  const phoneMatch = arg.match(/^\+?(\d[\d\s\-()]{6,})$/);
  if (phoneMatch) {
    const cleaned = phoneMatch[1].replace(/[\s\-()]/g, '');
    return { jid: `${cleaned}@s.whatsapp.net`, label: `+${cleaned}` };
  }
  try {
    const groups = await sock.groupFetchAllParticipating();
    const entries = Object.entries(groups);
    const exact = entries.find(([, g]) => g.subject && g.subject.toLowerCase() === arg.toLowerCase());
    if (exact) return { jid: exact[0], label: exact[1].subject };
    const fuzzy = entries.find(([, g]) => g.subject && g.subject.toLowerCase().includes(arg.toLowerCase()));
    if (fuzzy) return { jid: fuzzy[0], label: fuzzy[1].subject };
  } catch (_) {}
  return null;
}

module.exports = {
  name: 'dl',
  description: 'Download a file from a direct URL and send it (owner only)',

  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const sender = getSender(msg);

    if (!isOwner(sender)) {
      return sock.sendMessage(jid, {
        text: `❌ *This command is for the owner only.*`
      }, { quoted: msg });
    }

    if (!args.length) {
      return sock.sendMessage(jid, {
        text: `📥 *Direct Link Downloader*\n\nUsage:\n*.dl <url>* — send here\n*.dl <url> +94XXXXXXXXX* — send to number\n*.dl <url> <group name>* — send to group\n\nExample: *.dl https://example.com/file.zip*`
      }, { quoted: msg });
    }

    const url = args[0];
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return sock.sendMessage(jid, {
        text: `❌ Invalid URL. Must start with http:// or https://`
      }, { quoted: msg });
    }

    const targetArg = args.slice(1).join(' ').trim();
    let targetJid = jid;
    let targetLabel = null;

    if (targetArg) {
      const resolved = await resolveTarget(sock, targetArg);
      if (!resolved) {
        return sock.sendMessage(jid, {
          text: `❌ Target not found: *${targetArg}*\n_Check the phone number or make sure the bot is in that group._`
        }, { quoted: msg });
      }
      targetJid = resolved.jid;
      targetLabel = resolved.label;
    }

    const filename = getFilenameFromUrl(url);
    const tempFile = path.join(TEMP_DIR, `dl_${Date.now()}_${filename}`);

    const statusMsg = await sock.sendMessage(jid, {
      text: `⬇️ *Downloading File*\n\n📄 \`${filename}\`\n\n⏳ Starting download...${targetLabel ? `\n\n📤 Target: *${targetLabel}*` : ''}`
    }, { quoted: msg });

    let updateInterval = null;

    try {
      if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

      const response = await axios({
        method: 'GET',
        url,
        responseType: 'stream',
        timeout: 60 * 60 * 1000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      const totalSize = parseInt(response.headers['content-length'] || '0', 10);
      let downloaded = 0;
      let lastDownloaded = 0;
      let lastTime = Date.now();
      let speed = 0;

      updateInterval = setInterval(async () => {
        const now = Date.now();
        const elapsed = (now - lastTime) / 1000;
        speed = elapsed > 0 ? (downloaded - lastDownloaded) / elapsed : 0;
        lastTime = now;
        lastDownloaded = downloaded;
        try {
          await sock.sendMessage(jid, {
            text: buildProgressText(filename, downloaded, totalSize, speed, 'download')
              + (targetLabel ? `\n\n📤 Target: *${targetLabel}*` : ''),
            edit: statusMsg.key,
          });
        } catch (_) {}
      }, 3000);

      await new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(tempFile);
        response.data.on('data', chunk => { downloaded += chunk.length; });
        response.data.pipe(writer);
        writer.on('finish', resolve);
        writer.on('error', reject);
        response.data.on('error', reject);
      });

      clearInterval(updateInterval);
      updateInterval = null;

      const fileSize = fs.statSync(tempFile).size;
      const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);

      await sock.sendMessage(jid, {
        text: `⬆️ *Sending File*\n\n📄 \`${filename}\`\n\n⏳ *Uploading to WhatsApp...*\n\n💾 ${fileSizeMB} MB${targetLabel ? `\n📤 To: *${targetLabel}*` : ''}`,
        edit: statusMsg.key,
      });

      const fileBuffer = fs.readFileSync(tempFile);
      const mimetype = 'application/octet-stream';

      await sock.sendMessage(targetJid, {
        document: fileBuffer,
        mimetype,
        fileName: filename,
        caption: `*🧩 ${filename}*\n\n*㋛ 𝙿𝙾𝚆𝙴𝚁𝙳 𝙱𝚈 𝙻𝙴𝚂𝙰𝙽𝙳𝚄  〽️Ｄ*`,
      });

      await sock.sendMessage(jid, {
        text: `✅ *Sent!*\n\n📄 \`${filename}\`\n💾 ${fileSizeMB} MB${targetLabel ? `\n📤 To: *${targetLabel}*` : ''}`,
        edit: statusMsg.key,
      });

    } catch (err) {
      if (updateInterval) clearInterval(updateInterval);
      await sock.sendMessage(jid, {
        text: `❌ *Download failed!*\n_${err.message}_`,
        edit: statusMsg.key,
      });
    } finally {
      if (updateInterval) clearInterval(updateInterval);
      try { if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile); } catch (_) {}
    }
  },
};
