const { isOwner, getSender, resolveTarget, normalizeJid, getBotJid } = require('./utils');

module.exports = {
  name: 'getpp',
  description: 'Get a user\'s profile picture (owner/bot only)',
  usage: '.getpp | .getpp @member | .getpp +94XXXXXXXXX | reply to a message',
  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const sender = getSender(msg);

    // Only the owner or bot's own number can use this
    const botJid = getBotJid(sock);
    const senderNum = sender.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
    const botNum   = botJid.split('@')[0].replace(/[^0-9]/g, '');
    if (!isOwner(sender) && senderNum !== botNum) {
      return sock.sendMessage(jid, { text: '❌ This command can only be used by the bot owner.' }, { quoted: msg });
    }

    // Determine target
    let targetJid = resolveTarget(msg, args);
    if (!targetJid) targetJid = normalizeJid(sender);

    try {
      const ppUrl = await sock.profilePictureUrl(targetJid, 'image');
      const axios = require('axios');
      const response = await axios.get(ppUrl, { responseType: 'arraybuffer', timeout: 15000 });
      const imgBuffer = Buffer.from(response.data);
      const targetNum = targetJid.split('@')[0];

      await sock.sendMessage(jid, {
        image: imgBuffer,
        caption: `🖼️ *Profile picture of @${targetNum}*`,
        mentions: [targetJid]
      }, { quoted: msg });

    } catch (e) {
      const targetNum = targetJid.split('@')[0];
      const isNotFound = e.message?.includes('404') || e.message?.includes('item-not-found') || e.message?.toLowerCase().includes('not found');
      await sock.sendMessage(jid, {
        text: isNotFound
          ? `❌ @${targetNum} has no profile picture or it is private.`
          : `❌ Could not fetch profile picture: ${e.message}`,
        mentions: [targetJid]
      }, { quoted: msg });
    }
  },
};
