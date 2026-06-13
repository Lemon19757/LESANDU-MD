const { isOwner, isBotAdmin, normalizeJid, getSender } = require('./utils');

module.exports = {
  name: 'kickall',
  description: 'Kick all members from the group (owner only)',
  usage: '.kickall',
  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const sender = getSender(msg);

    if (!jid.endsWith('@g.us')) {
      return sock.sendMessage(jid, { text: '❌ This command only works in groups.' }, { quoted: msg });
    }

    if (!isOwner(sender)) {
      return sock.sendMessage(jid, { text: '❌ Only the *bot owner* can use this command.' }, { quoted: msg });
    }

    const botIsAdmin = await isBotAdmin(sock, jid);
    if (!botIsAdmin) {
      return sock.sendMessage(jid, { text: '❌ I need to be an admin to kick members.' }, { quoted: msg });
    }

    let metadata;
    try {
      metadata = await sock.groupMetadata(jid);
    } catch (e) {
      return sock.sendMessage(jid, { text: '❌ Failed to fetch group info: ' + e.message }, { quoted: msg });
    }

    const botJids = new Set();
    if (sock.user?.id)  botJids.add(normalizeJid(sock.user.id));
    if (sock.user?.lid) botJids.add(normalizeJid(sock.user.lid));

    const toKick = metadata.participants.filter(p => {
      const norm = normalizeJid(p.id);
      if (botJids.has(norm)) return false;
      if (isOwner(norm)) return false;
      return true;
    });

    if (toKick.length === 0) {
      return sock.sendMessage(jid, { text: '⚠️ No members to kick.' }, { quoted: msg });
    }

    await sock.sendMessage(jid, {
      text: `⚠️ *KICKALL initiated by owner.*\n🔄 Kicking *${toKick.length}* member(s) one by one...`
    }, { quoted: msg });

    let kicked = 0;
    let failed = 0;

    for (const participant of toKick) {
      try {
        await sock.groupParticipantsUpdate(jid, [participant.id], 'remove');
        kicked++;
        await new Promise(r => setTimeout(r, 800));
      } catch (e) {
        failed++;
      }
    }

    await sock.sendMessage(jid, {
      text: `✅ *KICKALL complete!*\n\n👢 *Kicked:* ${kicked}\n❌ *Failed:* ${failed}\n📊 *Total attempted:* ${toKick.length}`
    });
  },
};
