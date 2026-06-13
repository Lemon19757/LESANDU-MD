module.exports = {
  name: 'ping',
  description: 'Check bot response time',
  async execute(sock, msg, args) {
    const start = Date.now();
    const sent = await sock.sendMessage(msg.key.remoteJid, { text: '🏓 Pinging...' }, { quoted: msg });
    const latency = Date.now() - start;
    await sock.sendMessage(msg.key.remoteJid, {
      text: `🏓 *Pong!*\n⚡ Response: *${latency}ms*`,
      edit: sent.key,
    });
  },
};
