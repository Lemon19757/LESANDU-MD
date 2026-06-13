const { isAdmin, isBotAdmin, isOwner, getSender, resolveTarget } = require('./utils');

module.exports = {
  name: 'promote',
  description: 'Promote a member to admin (admin only)',
  usage: '.promote @member | .promote <reply> | .promote +94XXXXXXXXX',
  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const sender = getSender(msg);

    if (!jid.endsWith('@g.us')) {
      return sock.sendMessage(jid, { text: '❌ This command only works in groups.' }, { quoted: msg });
    }
    if (!isOwner(sender) && !(await isAdmin(sock, jid, sender))) {
      return sock.sendMessage(jid, { text: '❌ Only admins can use this command.' }, { quoted: msg });
    }
    if (!(await isBotAdmin(sock, jid))) {
      return sock.sendMessage(jid, { text: '❌ I need to be a group admin to promote members.' }, { quoted: msg });
    }

    const target = resolveTarget(msg, args);
    if (!target) {
      return sock.sendMessage(jid, {
        text: '❌ Please tag a member, reply to their message, or provide their number.\n_Usage: .promote @member_'
      }, { quoted: msg });
    }

    try {
      await sock.groupParticipantsUpdate(jid, [target], 'promote');
      await sock.sendMessage(jid, {
        text: `⬆️ @${target.split('@')[0]} has been promoted to *admin*! 🎉`,
        mentions: [target]
      }, { quoted: msg });
    } catch (e) {
      await sock.sendMessage(jid, { text: `❌ Failed to promote: ${e.message}` }, { quoted: msg });
    }
  },
};
