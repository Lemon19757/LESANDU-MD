const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

const TEMP_DIR = path.join(__dirname, '../../../temp');

module.exports = {
  name: 'toimg',
  description: 'Convert sticker to image (PNG or JPG)',
  usage: '.toimg [png|jpg] (reply to sticker)',
  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    const quoted = contextInfo?.quotedMessage;

    if (!quoted || !quoted.stickerMessage) {
      return sock.sendMessage(jid, {
        text: `🖼️ *Sticker to Image*\n\nReply to a sticker with *.toimg [png|jpg]*\n\nExample: *.toimg png*`
      }, { quoted: msg });
    }

    const format = (args[0] && ['jpg', 'jpeg'].includes(args[0].toLowerCase())) ? 'jpg' : 'png';

    if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

    const statusMsg = await sock.sendMessage(jid, {
      text: `⏳ Converting sticker to ${format.toUpperCase()}...`
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
      const inputPath = path.join(TEMP_DIR, `sticker_${ts}.webp`);
      const outputPath = path.join(TEMP_DIR, `sticker_${ts}.${format}`);
      fs.writeFileSync(inputPath, buffer);

      await new Promise((resolve, reject) => {
        execFile(ffmpegPath, [
          '-y', '-i', inputPath,
          outputPath
        ], (err) => err ? reject(err) : resolve());
      });

      const imgBuffer = fs.readFileSync(outputPath);
      await sock.sendMessage(jid, {
        image: imgBuffer,
        caption: `✅ Here is your ${format.toUpperCase()} image!\n\n*㋛ 𝙿𝙾𝚆𝙴𝚁𝙳 𝙱𝚈 𝙻𝙴𝚂𝙰𝙽𝙳𝚄  〽️Ｄ*`
      }, { quoted: msg });

      await sock.sendMessage(jid, { delete: statusMsg.key });

      try { fs.unlinkSync(inputPath); } catch (_) {}
      try { fs.unlinkSync(outputPath); } catch (_) {}

    } catch (e) {
      await sock.sendMessage(jid, {
        text: `❌ Failed to convert sticker.\n_${e.message.slice(0, 150)}_`,
        edit: statusMsg.key
      });
    }
  },
};
