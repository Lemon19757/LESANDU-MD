const { isOwner, getSender, getBotJid, normalizeJid } = require('./utils');

module.exports = {
  name: 'whoami',
  description: 'Debug: shows what JID the bot sees you as (owner only)',
  usage: '.whoami',
  async execute(sock, msg) {
    const jid = msg.key.remoteJid;
    const sender = getSender(msg);
    if (!isOwner(sender)) {
      return sock.sendMessage(jid, { text: '❌ This command is for the *owner* only.' }, { quoted: msg });
    }
    const botJid = getBotJid(sock);
    const raw = msg.key.participant || msg.key.remoteJid || '';
    await sock.sendMessage(jid, {
      text:
        `🔍 *Debug Info*\n\n` +
        `• *Resolved sender:* \`${sender}\`\n` +
        `• *Raw participant:* \`${raw}\`\n` +
        `• *Chat JID:* \`${jid}\`\n` +
        `• *Bot JID:* \`${botJid}\`\n` +
        `• *isOwner:* ${isOwner(sender) ? '✅ YES' : '❌ NO'}`
    }, { quoted: msg });
  },
};
