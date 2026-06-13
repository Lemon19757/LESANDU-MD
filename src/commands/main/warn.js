const { isAdmin, isOwner, getSender, resolveTarget } = require('./utils');
const violations = require('../../lib/violations');

module.exports = {
  name: 'warn',
  description: 'Warn a member — auto-removes after 4 warnings (admin only)',
  usage: '.warn @member | .warn <reply> | .warn +94XXXXXXXXX',
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
        text: '❌ Please tag a member, reply to their message, or provide their number.\n_Usage: .warn @member | .warn +94XXXXXXXXX_'
      }, { quoted: msg });
    }
    if (target === sender) {
      return sock.sendMessage(jid, { text: "❌ You can't warn yourself." }, { quoted: msg });
    }

    const count = violations.increment(jid, target, 'warn');
    const max = violations.MAX_WARNS;

    if (count >= max) {
      violations.resetAll(jid, target);
      try {
        await sock.groupParticipantsUpdate(jid, [target], 'remove');
        await sock.sendMessage(jid, {
          text: `🚫 @${target.split('@')[0]} has been *removed* after reaching ${max}/${max} warnings.`,
          mentions: [target]
        }, { quoted: msg });
      } catch (e) {
        await sock.sendMessage(jid, {
          text: `⚠️ @${target.split('@')[0]} reached ${max}/${max} warnings but could not be removed: ${e.message}`,
          mentions: [target]
        }, { quoted: msg });
      }
    } else {
      await sock.sendMessage(jid, {
        text: `⚠️ *Warning ${count}/${max}* — @${target.split('@')[0]}\n_${max - count} more warning(s) before removal._`,
        mentions: [target]
      }, { quoted: msg });
    }
  },
};
