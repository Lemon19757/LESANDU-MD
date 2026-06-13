const { isAdmin, isOwner, getSender } = require('./utils');

module.exports = {
  name: 'mute',
  description: 'Mute group — only admins can send (admin only)',
  usage: '.mute',
  async execute(sock, msg) {
    const jid = msg.key.remoteJid;
    const sender = getSender(msg);
    if (!jid.endsWith('@g.us')) {
      return sock.sendMessage(jid, { text: '❌ This command only works in groups.' }, { quoted: msg });
    }
    if (!isOwner(sender) && !(await isAdmin(sock, jid, sender))) {
      return sock.sendMessage(jid, { text: '❌ Only admins can use this command.' }, { quoted: msg });
    }
    try {
      await sock.groupSettingUpdate(jid, 'announcement');
      await sock.sendMessage(jid, { text: '🔇 Group muted — only admins can send messages.' }, { quoted: msg });
    } catch (e) {
      await sock.sendMessage(jid, { text: `❌ Failed to mute group: ${e.message}` }, { quoted: msg });
    }
  },
};
