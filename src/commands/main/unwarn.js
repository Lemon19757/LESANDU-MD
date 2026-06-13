const { isAdmin, isOwner, getSender, resolveTarget } = require('./utils');
const violations = require('../../lib/violations');

module.exports = {
  name: 'unwarn',
  description: 'Remove a warning from a member (admin only)',
  usage: '.unwarn @member | .unwarn <reply> | .unwarn +94XXXXXXXXX',
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
        text: '❌ Please tag a member, reply to their message, or provide their number.\n_Usage: .unwarn @member | .unwarn +94XXXXXXXXX_'
      }, { quoted: msg });
    }

    const current = violations.getCount(jid, target, 'warn');
    if (!current) {
      return sock.sendMessage(jid, {
        text: `ℹ️ @${target.split('@')[0]} has no warnings.`,
        mentions: [target]
      }, { quoted: msg });
    }

    const remaining = violations.decrement(jid, target, 'warn');
    await sock.sendMessage(jid, {
      text: `✅ Warning removed from @${target.split('@')[0]}. They now have *${remaining}/${violations.MAX_WARNS}* warnings.`,
      mentions: [target]
    }, { quoted: msg });
  },
};
