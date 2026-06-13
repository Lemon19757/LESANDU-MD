const { isAdmin, isOwner, getSender } = require('./utils');

module.exports = {
  name: 'link',
  description: 'Get the group invite link (admin only)',
  usage: '.link',
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
      const code = await sock.groupInviteCode(jid);
      const meta = await sock.groupMetadata(jid);
      await sock.sendMessage(jid, {
        text: `🔗 *Group Invite Link*\n\n*Group:* ${meta.subject}\n*Link:* https://chat.whatsapp.com/${code}`
      }, { quoted: msg });
    } catch (e) {
      await sock.sendMessage(jid, { text: `❌ Failed to get group link: ${e.message}` }, { quoted: msg });
    }
  },
};
