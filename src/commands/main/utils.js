const config = require('../../../config');

// Returns true if the JID belongs to the bot owner
function isOwner(senderJid) {
  const num = (senderJid || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
  if (!num) return false;
  // Check both ownerNumbers array AND singular ownerNumber for robustness
  const single = (config.ownerNumber || '').replace(/[^0-9]/g, '');
  const multi  = (config.ownerNumbers || []).map(n => n.replace(/[^0-9]/g, ''));
  const all = [...new Set([single, ...multi].filter(Boolean))];
  return all.includes(num);
}

// Normalize a JID — strip device suffix (:0, :1, etc.)
function normalizeJid(jid) {
  if (!jid) return '';
  const [user, server] = jid.split('@');
  const clean = user.split(':')[0];
  return server ? `${clean}@${server}` : clean;
}

// Get the bot's own normalized JID (for admin checks)
function getBotJid(sock) {
  return normalizeJid(sock.user?.id || '');
}

// Reliably extract the sender JID from a message.
// msg.key.participant can be an empty string ("") in some Baileys builds,
// which would cause "".|| jid to fall back to the GROUP JID — breaking owner checks.
function getSender(msg) {
  // fromMe in ANY chat: the sender is always the bot owner.
  // - Private: remoteJid is the recipient, not sender.
  // - Group: participant is the bot's LID, not phone number.
  // Both cases break isOwner(), so always return the owner phone JID.
  if (msg.key.fromMe) return `${config.ownerNumber}@s.whatsapp.net`;

  const p = msg.key.participant;
  // Only trust participant if it looks like a real JID (contains @)
  if (p && p.includes('@')) return normalizeJid(p);
  const r = msg.key.remoteJid || '';
  if (!r.endsWith('@g.us')) return normalizeJid(r);
  // Group message with no usable participant — best effort
  return normalizeJid(p || r);
}

async function isAdmin(sock, jid, user) {
  try {
    const normUser = normalizeJid(user);
    const metadata = await sock.groupMetadata(jid);
    const participant = metadata.participants.find(p => normalizeJid(p.id) === normUser);
    return participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
  } catch {
    return false;
  }
}

// Check if the BOT itself is a group admin.
// Handles LID addressing: sock.user.id is phone-based but WhatsApp may store
// the bot as a LID in the participant list, so we match against both.
async function isBotAdmin(sock, jid) {
  try {
    const botJids = new Set();
    if (sock.user?.id)  botJids.add(normalizeJid(sock.user.id));
    if (sock.user?.lid) botJids.add(normalizeJid(sock.user.lid));
    const metadata = await sock.groupMetadata(jid);
    const participant = metadata.participants.find(p => botJids.has(normalizeJid(p.id)));
    return participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
  } catch {
    return false;
  }
}

// Resolve the target JID from a message (reply / mention / phone number arg)
function resolveTarget(msg, args) {
  const ctx = msg.message?.extendedTextMessage?.contextInfo
    || msg.message?.imageMessage?.contextInfo
    || msg.message?.videoMessage?.contextInfo
    || msg.message?.stickerMessage?.contextInfo
    || msg.message?.audioMessage?.contextInfo
    || msg.message?.documentMessage?.contextInfo
    || Object.values(msg.message || {}).find(v => v?.contextInfo)?.contextInfo;

  // Reply
  if (ctx?.participant) return normalizeJid(ctx.participant);

  // @mention
  const mentions = ctx?.mentionedJid;
  if (mentions?.length) return normalizeJid(mentions[0]);

  // Phone number arg
  if (args[0]) {
    const num = args[0].replace(/[^0-9]/g, '');
    if (num.length >= 7) return `${num}@s.whatsapp.net`;
  }

  return null;
}

module.exports = { isOwner, isAdmin, isBotAdmin, normalizeJid, getBotJid, getSender, resolveTarget };
