const { isAdmin, isOwner, getSender } = require('./utils');

module.exports = {
  name: 'tagall',
  description: 'Mention all group members (admin only)',
  usage: '.tagall [message]',
  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const sender = getSender(msg);
    if (!jid.endsWith('@g.us')) {
      return sock.sendMessage(jid, { text: '❌ This command only works in groups.' }, { quoted: msg });
    }
    if (!isOwner(sender) && !(await isAdmin(sock, jid, sender))) {
      return sock.sendMessage(jid, { text: '❌ Only admins can use this command.' }, { quoted: msg });
    }
    const metadata = await sock.groupMetadata(jid);
    const members = metadata.participants.map(p => p.id);
    const customMsg = args.length ? args.join(' ') : '📢 *Attention everyone!*';
    const mentionLines = members.map(m => `@${m.split('@')[0]}`).join(' ');
    await sock.sendMessage(jid, { text: `${customMsg}\n\n${mentionLines}`, mentions: members }, { quoted: msg });
  },
};
