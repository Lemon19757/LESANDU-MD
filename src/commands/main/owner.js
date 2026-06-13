module.exports = {
  name: 'owner',
  description: 'Show owner info',
  async execute(sock, msg, args) {
    const info = `*🤖 Bot Owner Information*

📱 *Number:* wa.me/94770175250
👤 *Name:* Lesandu Biman
💬 *Note:* We need money!`;
    await sock.sendMessage(msg.key.remoteJid, { text: info }, { quoted: msg });
  },
};
