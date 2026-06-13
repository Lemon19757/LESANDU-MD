const { isAdmin, isBotAdmin, isOwner, getSender, resolveTarget } = require('./utils');

module.exports = {
  name: 'demote',
  description: 'Demote an admin to member (admin only)',
  usage: '.demote @member | .demote <reply> | .demote +94XXXXXXXXX',
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
      return sock.sendMessage(jid, { text: '❌ I need to be a group admin to demote members.' }, { quoted: msg });
    }

    const target = resolveTarget(msg, args);
    if (!target) {
      return sock.sendMessage(jid, {
        text: '❌ Please tag a member, reply to their message, or provide their number.\n_Usage: .demote @member_'
      }, { quoted: msg });
    }

    try {
      await sock.groupParticipantsUpdate(jid, [target], 'demote');
      await sock.sendMessage(jid, {
        text: `⬇️ @${target.split('@')[0]} has been demoted to *member*.`,
        mentions: [target]
      }, { quoted: msg });
    } catch (e) {
      await sock.sendMessage(jid, { text: `❌ Failed to demote: ${e.message}` }, { quoted: msg });
    }
  },
};
