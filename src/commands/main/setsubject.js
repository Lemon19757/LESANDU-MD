const { isAdmin, isOwner, getSender } = require('./utils');

module.exports = {
  name: 'setsubject',
  description: 'Change the group name (admin only)',
  usage: '.setsubject <new name>',
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
      return sock.sendMessage(jid, { text: '❌ Please provide a new group name.\n_Usage: .setsubject <new name>_' }, { quoted: msg });
    }
    const subject = args.join(' ');
    if (subject.length > 100) {
      return sock.sendMessage(jid, { text: '❌ Group name too long. Max 100 characters.' }, { quoted: msg });
    }
    try {
      await sock.groupUpdateSubject(jid, subject);
      await sock.sendMessage(jid, { text: `✅ Group name updated to *${subject}*` }, { quoted: msg });
    } catch (e) {
      await sock.sendMessage(jid, { text: `❌ Failed to update group name: ${e.message}` }, { quoted: msg });
    }
  },
};
