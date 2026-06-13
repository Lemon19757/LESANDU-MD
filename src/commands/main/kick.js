const { isAdmin, isOwner, getSender, resolveTarget } = require('./utils');

module.exports = {
  name: 'kick',
  description: 'Remove a member from the group (admin only)',
  usage: '.kick @member | .kick <reply> | .kick +94XXXXXXXXX',
  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const sender = getSender(msg);

    if (!jid.endsWith('@g.us')) {
      return sock.sendMessage(jid, { text: '❌ This command only works in groups.' }, { quoted: msg });
    }
    if (!isOwner(sender) && !(await isAdmin(sock, jid, sender))) {
      return sock.sendMessage(jid, { text: '❌ Only admins can use this command.' }, { quoted: msg });
    }

    const target = resolveTarget(msg, args);
    if (!target) {
      return sock.sendMessage(jid, {
        text: '❌ Please tag a member, reply to their message, or provide their number.\n_Usage: .kick @member | .kick +94XXXXXXXXX_'
      }, { quoted: msg });
    }
    if (target === sender) {
      return sock.sendMessage(jid, { text: "❌ You can't kick yourself." }, { quoted: msg });
    }
    if (await isAdmin(sock, jid, target)) {
      return sock.sendMessage(jid, { text: "❌ Can't kick another admin." }, { quoted: msg });
    }

    try {
      await sock.groupParticipantsUpdate(jid, [target], 'remove');
      await sock.sendMessage(jid, {
        text: `✅ @${target.split('@')[0]} has been removed from the group.`,
        mentions: [target]
      }, { quoted: msg });
    } catch (e) {
      await sock.sendMessage(jid, { text: `❌ Failed to remove member: ${e.message}` }, { quoted: msg });
    }
  },
};
