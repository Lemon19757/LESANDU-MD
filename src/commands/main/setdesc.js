const { isAdmin, isOwner, getSender } = require('./utils');

module.exports = {
  name: 'setdesc',
  description: 'Change the group description (admin only)',
  usage: '.setdesc <description>',
  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const sender = getSender(msg);
    if (!jid.endsWith('@g.us')) {
      return sock.sendMessage(jid, { text: '❌ This command only works in groups.' }, { quoted: msg });
    }
    if (!isOwner(sender) && !(await isAdmin(sock, jid, sender))) {
      return sock.sendMessage(jid, { text: '❌ Only admins can use this command.' }, { quoted: msg });
    }
    if (!args.length) {
      return sock.sendMessage(jid, { text: '❌ Please provide a description.\n_Usage: .setdesc <description>_' }, { quoted: msg });
    }
    const desc = args.join(' ');
    if (desc.length > 512) {
      return sock.sendMessage(jid, { text: '❌ Description too long. Max 512 characters.' }, { quoted: msg });
    }
    try {
      await sock.groupUpdateDescription(jid, desc);
      await sock.sendMessage(jid, { text: '✅ Group description updated!' }, { quoted: msg });
    } catch (e) {
      await sock.sendMessage(jid, { text: `❌ Failed to update description: ${e.message}` }, { quoted: msg });
    }
  },
};
