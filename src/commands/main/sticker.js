const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

const TEMP_DIR = path.join(__dirname, '../../../temp');

module.exports = {
  name: 'sticker',
  aliases: ['s', 'stiker'],
  description: 'Convert image or video to WhatsApp sticker',
  usage: '.sticker (reply to image or short video)',
  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    const quoted = contextInfo?.quotedMessage;

    const isImage = quoted?.imageMessage;
    const isVideo = quoted?.videoMessage;

    if (!quoted || (!isImage && !isVideo)) {
      return sock.sendMessage(jid, {
        text: `🎭 *Image/Video to Sticker*\n\nReply to an image or short video with *.sticker*\n\nAliases: *.s* | *.stiker*`
      }, { quoted: msg });
    }

    if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

    const statusMsg = await sock.sendMessage(jid, {
      text: `⏳ Creating sticker...`
    }, { quoted: msg });

    try {
      const stream = await downloadMediaMessage(
        { key: msg.key, message: quoted },
        sock
      );
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      const buffer = Buffer.concat(chunks);

      const ts = Date.now();
      const ext = isVideo ? 'mp4' : 'jpg';
      const inputPath = path.join(TEMP_DIR, `sticker_in_${ts}.${ext}`);
      const outputPath = path.join(TEMP_DIR, `sticker_out_${ts}.webp`);
      fs.writeFileSync(inputPath, buffer);

      const ffmpegArgs = isVideo
        ? [
            '-y', '-i', inputPath,
            '-vf', 'fps=15,scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000',
            '-t', '6',
            '-loop', '0',
            '-preset', 'default',
            '-an',
            '-vsync', '0',
            outputPath
          ]
        : [
            '-y', '-i', inputPath,
            '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000',
            outputPath
          ];

      await new Promise((resolve, reject) => {
        execFile(ffmpegPath, ffmpegArgs, (err, stdout, stderr) => {
          if (err) return reject(new Error(stderr?.slice(0, 200) || err.message));
          resolve();
        });
      });

      const stickerBuffer = fs.readFileSync(outputPath);

      await sock.sendMessage(jid, {
        sticker: stickerBuffer,
      }, { quoted: msg });

      await sock.sendMessage(jid, { delete: statusMsg.key });

      try { fs.unlinkSync(inputPath); } catch (_) {}
      try { fs.unlinkSync(outputPath); } catch (_) {}

    } catch (e) {
      await sock.sendMessage(jid, {
        text: `❌ Failed to create sticker.\n_${e.message.slice(0, 150)}_`,
        edit: statusMsg.key
      });
    }
  },
};
