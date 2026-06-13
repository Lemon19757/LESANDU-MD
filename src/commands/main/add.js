const { isAdmin, isOwner, getSender } = require('./utils');

function resolveNumber(msg, args) {
  const ctx = msg.message?.extendedTextMessage?.contextInfo
    || Object.values(msg.message || {}).find(v => v?.contextInfo)?.contextInfo;

  if (ctx?.mentionedJid?.length) return ctx.mentionedJid[0].split('@')[0];
  if (args[0]) {
    const num = args[0].replace(/[^0-9]/g, '');
    if (num.length >= 7) return num;
  }
  return null;
}

module.exports = {
  name: 'add',
  description: 'Add a member to the group (admin only)',
  usage: '.add +94XXXXXXXXX | .add @member',
  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const sender = getSender(msg);

    if (!jid.endsWith('@g.us')) {
      return sock.sendMessage(jid, { text: '❌ This command only works in groups.' }, { quoted: msg });
    }
    if (!isOwner(sender) && !(await isAdmin(sock, jid, sender))) {
      return sock.sendMessage(jid, { text: '❌ Only admins can use this command.' }, { quoted: msg });
    }

    const number = resolveNumber(msg, args);
    if (!number) {
      return sock.sendMessage(jid, {
        text: '❌ Please provide a number or mention a user.\n_Usage: .add +94XXXXXXXXX | .add @member_'
      }, { quoted: msg });
    }

    const targetJid = `${number}@s.whatsapp.net`;
    try {
      const result = await sock.groupParticipantsUpdate(jid, [targetJid], 'add');
      const status = result?.[0]?.status;
      if (status === '200') {
        await sock.sendMessage(jid, { text: `✅ Successfully added @${number} to the group!`, mentions: [targetJid] }, { quoted: msg });
      } else if (status === '403') {
        await sock.sendMessage(jid, { text: `❌ Cannot add @${number} — their privacy settings block group invites.`, mentions: [targetJid] }, { quoted: msg });
      } else if (status === '408') {
        await sock.sendMessage(jid, { text: `❌ @${number} does not exist on WhatsApp.`, mentions: [targetJid] }, { quoted: msg });
      } else if (status === '409') {
        await sock.sendMessage(jid, { text: `⚠️ @${number} is already in the group.`, mentions: [targetJid] }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, { text: `✅ Add request sent for @${number}.`, mentions: [targetJid] }, { quoted: msg });
      }
    } catch (e) {
      await sock.sendMessage(jid, { text: `❌ Failed to add member: ${e.message}` }, { quoted: msg });
    }
  },
};
