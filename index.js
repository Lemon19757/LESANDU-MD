const { makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, downloadMediaMessage } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const express = require('express');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const axios = require('axios');
const config = require('./config');
const { isOwner: _isOwner, getSender } = require('./src/commands/main/utils');
const welcomeCmd = require('./src/commands/main/welcome');
const autoresponderCmd = require('./src/commands/main/autoresponder');
const database = require('./src/lib/database');
const apiManager = require('./src/lib/api-manager');
const cache = require('./src/lib/cache');
const performanceMonitor = require('./src/lib/performance-monitor');
const connectionHealth = require('./src/lib/connection-health');
const settings = require('./src/lib/settings');
const violations = require('./src/lib/violations');
const fgState = require('./src/lib/fg-state');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

ffmpeg.setFfmpegPath(ffmpegPath);

// ─── Natural typing delay helpers ────────────────────────────────────────────

/** Non-blocking async sleep */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Random integer between min and max (inclusive), in milliseconds */
function randomDelay(minSec, maxSec) {
  return Math.floor((Math.random() * (maxSec - minSec) + minSec) * 1000);
}

/**
 * Simulate a human typing the reply:
 *   1. Send "composing" presence for the full delay duration
 *   2. Sleep for that duration (non-blocking)
 *   3. Clear the composing state
 *
 * @param {object} sock  - Baileys socket
 * @param {string} jid   - Chat JID
 * @param {boolean} isDownload - true → 5-10 s delay, false → 2-6 s delay
 */
async function typeBeforeSend(sock, jid, isDownload = false) {
  try {
    const ms = isDownload ? randomDelay(5, 10) : randomDelay(2, 6);
    await sock.sendPresenceUpdate('composing', jid);
    await sleep(ms);
    await sock.sendPresenceUpdate('paused', jid);
  } catch (_) {
    // Presence errors must never break message flow
  }
}

// ─── Feature constants ────────────────────────────────────────────────────────
const LINK_REGEX = /https?:\/\/[^\s]+|www\.[^\s]+/gi;

function getBadWordsRegex() {
  const words = settings.get('badWords') || [];
  if (!words.length) return null;
  return new RegExp(words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i');
}

// Auto-react emoji per command
const REACT_EMOJIS = {
  menu: '📁', ping: '🏓', uptime: '⏱️', help: '🆘', owner: '👑',
  tt: '🎵', ig: '📸', add: '➕', kick: '🦵', kickall: '💥', promote: '⬆️', demote: '⬇️',
  mute: '🔇', unmute: '🔊', warn: '⚠️', unwarn: '✅',
  tagall: '📢', link: '🔗', setsubject: '✏️', setdesc: '📝',
  welcome: '👋',
  autoresponder: '🤖', addtrigger: '➕', deltrigger: '🗑️', listtriggers: '📋',
  poll: '🗳️', vote: '☑️', pollresult: '📊',
  toimg: '🖼️', tomp3: '🎵',
  tictactoe: '✖️', suit: '✂️', tebakkata: '🔤',
  anime: '🎌', canva: '🎨', wikimedia: '📚',
  performance: '📈', setting: '⚙️',
};
const DEFAULT_REACT = '⚡';

// Message cache for anti-delete  (jid → Map(msgId → {sender, text, type, caption}))
const MSG_CACHE = new Map();
const MSG_CACHE_LIMIT = 60;

// Track chats awaiting a menu sub-menu reply (jid → true)
const pendingMenus = new Map();

// Track chats awaiting a .setting code reply (jid → true)
const pendingSettings = new Map();


// ─── Helper: cache a message ──────────────────────────────────────────────────
function cacheMsg(msg) {
  const jid = msg.key.remoteJid;
  const id = msg.key.id;
  const m = msg.message;
  if (!m || !jid || !id) return;
  if (!MSG_CACHE.has(jid)) MSG_CACHE.set(jid, new Map());
  const chatCache = MSG_CACHE.get(jid);
  const text = m.conversation || m.extendedTextMessage?.text || m.imageMessage?.caption || m.videoMessage?.caption || '';
  const type = Object.keys(m)[0];
  chatCache.set(id, { sender: msg.key.participant || jid, text, type, msg: m });
  if (chatCache.size > MSG_CACHE_LIMIT) {
    const oldest = chatCache.keys().next().value;
    chatCache.delete(oldest);
  }
}

// ─── Helper: is sender the owner ─────────────────────────────────────────────
function isOwner(senderJid) { return _isOwner(senderJid); }

// ─── Web status server ────────────────────────────────────────────────────────
let currentQR = null;
let botStatus = 'starting';

const app = express();
app.get('/', async (req, res) => {
  let qrHtml = '';
  if (botStatus === 'connected') {
    qrHtml = `<div class="connected">✅ Bot is connected and running!</div>`;
  } else if (currentQR) {
    try {
      const qrDataUrl = await QRCode.toDataURL(currentQR);
      qrHtml = `
        <p>Scan this QR code with WhatsApp to connect the bot:</p>
        <img src="${qrDataUrl}" style="width:280px;height:280px;" />
        <p style="color:#888;font-size:13px;">Page auto-refreshes every 10 seconds</p>
        <meta http-equiv="refresh" content="10">`;
    } catch (e) {
      qrHtml = `<p>QR code loading... please refresh.</p>`;
    }
  } else {
    qrHtml = `<p>⏳ Waiting for QR code... please refresh in a moment.</p><meta http-equiv="refresh" content="3">`;
  }

  res.send(`<!DOCTYPE html>
<html>
<head>
  <title>LESANDU-MD</title>
  <style>
    body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #111; color: #eee; }
    h1 { color: #25d366; }
    .connected { font-size: 22px; color: #25d366; }
    img { border: 4px solid #25d366; border-radius: 12px; }
    p { text-align: center; }
  </style>
</head>
<body>
  <h1>🤖 LESANDU-MD</h1>
  ${qrHtml}
</body>
</html>`);
});
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(chalk.green(`Status page running on port ${PORT}`));
});

// Keep-alive: ping self every 4 minutes to prevent Replit from sleeping
const SELF_URL = process.env.REPLIT_DEV_DOMAIN
  ? `https://${process.env.REPLIT_DEV_DOMAIN}`
  : `http://localhost:${PORT}`;

setInterval(() => {
  axios.get(SELF_URL).catch(() => {});
}, 4 * 60 * 1000);

// Initialize optimized command loader
const CommandLoader = require('./src/lib/command-loader');
const commandsDir = path.join(__dirname, 'src/commands/main');
const commandLoader = new CommandLoader(commandsDir);

// Legacy functions replaced by database layer
async function loadJson(p) {
  const filename = path.basename(p, '.json');
  return await database.load(filename, {});
}

function saveJson(p, d) {
  const filename = path.basename(p, '.json');
  database.save(filename, d);
}

// Store interval IDs for proper cleanup
const backgroundIntervals = [];

async function pollBackground(sock) {
  // Scheduled Messages - Optimized
  const scheduleInterval = setInterval(async () => {
    try {
      const db = await database.load('schedules');
      const now = new Date();
      const hhmm = now.toTimeString().slice(0, 5);

      const messagesToSend = [];
      for (const jid in db) {
        const schedules = db[jid] || [];
        for (const s of schedules) {
          if (s.time === hhmm) {
            messagesToSend.push({ jid, message: s.message });
          }
        }
      }

      if (messagesToSend.length > 0) {
        await Promise.allSettled(
          messagesToSend.map(({ jid, message }) =>
            sock.sendMessage(jid, { text: `[Scheduled] ${message}` })
              .catch(error => console.error(`Error sending scheduled message to ${jid}:`, error.message))
          )
        );
      }
    } catch (error) {
      console.error('Error in scheduled messages polling:', error.message);
    }
  }, config.polling.scheduledMessages);

  backgroundIntervals.push(scheduleInterval);
}

// Function to clear all background intervals
function clearBackgroundIntervals() {
  backgroundIntervals.forEach(interval => {
    clearInterval(interval);
  });
  backgroundIntervals.length = 0;
}

// Function to send image from base64 data
async function sendImageFromBase64(sock, jid, base64Data, quotedMsg) {
  try {
    const imageBuffer = Buffer.from(base64Data, 'base64');
    await sock.sendMessage(jid, { image: imageBuffer }, { quoted: quotedMsg });
  } catch (error) {
    console.error('Error sending image from base64:', error);
    throw error;
  }
}

// Function to send video from base64 data
async function sendVideoFromBase64(sock, jid, base64Data, quotedMsg) {
  try {
    const videoBuffer = Buffer.from(base64Data, 'base64');
    await sock.sendMessage(jid, { video: videoBuffer }, { quoted: quotedMsg });
  } catch (error) {
    console.error('Error sending video from base64:', error);
    throw error;
  }
}

// Function to send audio from base64 data
async function sendAudioFromBase64(sock, jid, base64Data, quotedMsg) {
  try {
    const audioBuffer = Buffer.from(base64Data, 'base64');
    await sock.sendMessage(jid, { audio: audioBuffer }, { quoted: quotedMsg });
  } catch (error) {
    console.error('Error sending audio from base64:', error);
    throw error;
  }
}

// Function to send sticker from base64 data
async function sendStickerFromBase64(sock, jid, base64Data, quotedMsg) {
  try {
    const stickerBuffer = Buffer.from(base64Data, 'base64');
    await sock.sendMessage(jid, { sticker: stickerBuffer }, { quoted: quotedMsg });
  } catch (error) {
    console.error('Error sending sticker from base64:', error);
    await sock.sendMessage(jid, { text: '❌ Failed to send sticker.' }, { quoted: quotedMsg });
  }
}

// Function to send sticker from URL
async function sendStickerFromUrl(sock, jid, url, quotedMsg) {
  let tempInput = null;
  let tempOutput = null;

  try {
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000
    });
    const buffer = Buffer.from(res.data);

    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    tempInput = path.join(tempDir, `autoresponder_${Date.now()}.jpg`);
    tempOutput = path.join(tempDir, `autoresponder_${Date.now()}.webp`);

    fs.writeFileSync(tempInput, buffer);

    await new Promise((resolve, reject) => {
      ffmpeg(tempInput)
        .outputOptions([
          '-vcodec', 'libwebp',
          '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,fps=15',
          '-lossless', '1',
          '-compression_level', '6',
          '-q:v', '50',
          '-loop', '0',
          '-preset', 'default',
          '-an',
          '-vsync', '0'
        ])
        .toFormat('webp')
        .save(tempOutput)
        .on('end', resolve)
        .on('error', reject);
    });

    const stickerBuffer = fs.readFileSync(tempOutput);
    await sock.sendMessage(jid, { sticker: stickerBuffer }, { quoted: quotedMsg });

  } catch (error) {
    console.error('Error creating sticker from URL:', error);
    await sock.sendMessage(jid, { text: '❌ Failed to create sticker from URL.' }, { quoted: quotedMsg });
  } finally {
    try {
      if (tempInput && fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
      if (tempOutput && fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
    } catch (cleanupError) {
      console.error('Error cleaning up temporary files:', cleanupError.message);
    }
  }
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(config.sessionName);
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version,
    auth: state,
    browser: ['LESANDU-MD', 'Chrome', '110.0.0.0'],
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      currentQR = qr;
      botStatus = 'waiting_scan';
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'close') {
      botStatus = 'disconnected';
      const reason = lastDisconnect?.error?.message || 'unknown';
      connectionHealth.connectionClosed(reason);

      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log(chalk.red('Connection closed. Reconnecting...'));

      clearBackgroundIntervals();
      connectionHealth.stopMonitoring();

      if (shouldReconnect && connectionHealth.shouldReconnect()) {
        const delay = connectionHealth.getReconnectDelay();
        console.log(chalk.yellow(`Reconnecting in ${delay}ms...`));
        setTimeout(() => startBot(), delay);
      } else if (!shouldReconnect) {
        console.log(chalk.red('Logged out. Not reconnecting.'));
      } else {
        console.log(chalk.red('Max reconnect attempts reached.'));
      }
    } else if (connection === 'open') {
      botStatus = 'connected';
      currentQR = null;
      connectionHealth.connectionOpened();
      console.log(chalk.green('LESANDU-MD is ready!'));

      await commandLoader.initialize();
      console.log(chalk.blue('Command loader initialized'));

      const frequentCommands = ['help', 'menu', 'ping', 'setting'];
      await commandLoader.preloadCommands(frequentCommands);

      await database.preload();
      console.log(chalk.blue('Database preloaded successfully'));

      performanceMonitor.start();
      console.log(chalk.blue('Performance monitoring started'));

      connectionHealth.startMonitoring(sock);
      console.log(chalk.blue('Connection health monitoring started'));
    }
  });

  // ─── Welcome / Goodbye ───────────────────────────────────────────────────────
  sock.ev.on('group-participants.update', async (update) => {
    if (!settings.get('welcomeGoodbye')) return;
    const { id, participants, action } = update;

    // Fetch group name for use in messages
    let groupName = id.split('@')[0];
    try {
      const meta = await sock.groupMetadata(id);
      if (meta && meta.subject) groupName = meta.subject;
    } catch (_) {}

    if (action === 'add') {
      const customWelcome = welcomeCmd.getWelcome(id);
      for (const user of participants) {
        try {
          const userNum = '@' + user.split('@')[0];
          const text = customWelcome
            ? customWelcome.replace(/@user/g, userNum).replace(/@group/g, groupName)
            : `👋 *Welcome to ${groupName}!*\n\nHey ${userNum}, glad to have you here! 🎉\nPlease read the group rules and enjoy your stay. 😊`;
          await sock.sendMessage(id, { text, mentions: [user] });
        } catch (error) {
          console.error(`Error sending welcome message to ${user}:`, error.message);
        }
      }
    } else if (action === 'remove') {
      const customGoodbye = welcomeCmd.getGoodbye(id);
      for (const user of participants) {
        try {
          const userNum = '@' + user.split('@')[0];
          const text = customGoodbye
            ? customGoodbye.replace(/@user/g, userNum).replace(/@group/g, groupName)
            : `👋 *${userNum} has left ${groupName}.*\n\nWe'll miss you! Take care. 🙏`;
          await sock.sendMessage(id, { text, mentions: [user] });
        } catch (error) {
          console.error(`Error sending goodbye message to ${user}:`, error.message);
        }
      }
    }
  });

  // ─── Anti-Delete: restore deleted messages ───────────────────────────────────
  sock.ev.on('messages.update', async (updates) => {
    const antiDelete = settings.get('antiDelete');
    if (antiDelete === 'false') return;

    for (const update of updates) {
      try {
        const proto = update.update?.message?.protocolMessage;
        if (!proto || proto.type !== 0) continue;

        const deletedKey = proto.key;
        const jid = deletedKey.remoteJid || update.key?.remoteJid;
        if (!jid) continue;

        const isGroup = jid.endsWith('@g.us');
        if (antiDelete === 'groups' && !isGroup) continue;
        if (antiDelete === 'inbox' && isGroup) continue;

        const chatCache = MSG_CACHE.get(jid);
        if (!chatCache) continue;
        const cached = chatCache.get(deletedKey.id);
        if (!cached) continue;

        const senderNum = cached.sender.replace(/[^0-9]/g, '');
        const header = `🗑️ *Deleted message from @${senderNum}:*\n`;

        if (cached.type === 'conversation' || cached.type === 'extendedTextMessage') {
          await sock.sendMessage(jid, {
            text: header + (cached.text || '(empty)'),
            mentions: [cached.sender]
          });
        } else {
          await sock.sendMessage(jid, {
            text: header + `[${cached.type}]${cached.text ? ' — ' + cached.text : ''}`,
            mentions: [cached.sender]
          });
        }
      } catch (err) {
        console.error('Anti-delete error:', err.message);
      }
    }
  });

  // ─── Main message handler ────────────────────────────────────────────────────
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;

    // Cache message for anti-delete (all incoming, including fromMe for delete events)
    if (!msg.key.fromMe) cacheMsg(msg);

    // Skip bot's own messages UNLESS it's a command or a pending reply from the owner
    if (msg.key.fromMe) {
      const selfBody = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      const jidTemp = msg.key.remoteJid;
      if (!selfBody.startsWith(config.commandPrefix) && !pendingSettings.has(jidTemp) && !pendingMenus.has(jidTemp) && !fgState.hasState(jidTemp)) return;
    }

    const startTime = Date.now();

    try {
      performanceMonitor.recordMessage();

      const jid = msg.key.remoteJid;
      const isGroup = jid.endsWith('@g.us');

      // For fromMe private messages getSender returns the recipient — use owner number instead
      const sender = (msg.key.fromMe && !isGroup)
        ? `${config.ownerNumber}@s.whatsapp.net`
        : getSender(msg);
      const body = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

      // ── Mode check ──────────────────────────────────────────────────────────
      const mode = settings.get('mode');
      const senderIsOwner = isOwner(sender);
      if (mode === 'private' && !senderIsOwner) return;
      if (mode === 'groups' && !isGroup) return;

      // ── Menu sub-menu reply handler ─────────────────────────────────────────
      if (pendingMenus.get(jid)) {
        const trimmed = body.trim();
        const num = parseInt(trimmed, 10);
        if (!isNaN(num) && num >= 1 && num <= 13 && String(num) === trimmed.trim()) {
          try {
            const menuCmd = await commandLoader.getCommand('menu');
            if (menuCmd && menuCmd.showSubMenu) {
              await typeBeforeSend(sock, jid, false);
              await menuCmd.showSubMenu(sock, msg, num);
            }
          } catch (e) {
            console.error('Menu sub-menu error:', e.message);
          }
          pendingMenus.delete(jid);
          return;
        }
      }

      // ── Setting code reply handler ───────────────────────────────────────────
      if (pendingSettings.get(jid) && senderIsOwner) {
        const code = body.trim();
        if (/^\d+\.\d+$/.test(code)) {
          try {
            const settingCmd = await commandLoader.getCommand('setting');
            await typeBeforeSend(sock, jid, false);
            if (settingCmd && settingCmd.SETTING_MAP && settingCmd.SETTING_MAP[code]) {
              const { key, value, label } = settingCmd.SETTING_MAP[code];
              settings.set(key, value);
              await sock.sendMessage(jid, { text: `✅ *Setting updated:*\n${label}` }, { quoted: msg });
            } else {
              await sock.sendMessage(jid, { text: `❌ Invalid code *${code}*. Please use a valid code like *2.2* or type *.setting* again.` }, { quoted: msg });
            }
          } catch (e) {
            console.error('Setting reply error:', e.message);
          }
          pendingSettings.delete(jid);
          return;
        }
      }

      // ── FitGirl: number-select reply ─────────────────────────────────────────
      if (fgState.hasState(jid)) {
        const fgSt = fgState.getState(jid);

        if (fgSt && fgSt.phase === 'select') {
          const num = parseInt(body.trim(), 10);
          if (!isNaN(num) && num >= 1 && num <= 10) {
            try {
              const fgCmd = await commandLoader.getCommand('fg');
              if (fgCmd) {
                await typeBeforeSend(sock, jid, true);
                await fgCmd.handleSelect(sock, jid, msg, num);
              }
            } catch (e) {
              console.error('FG select error:', e.message);
            }
            return;
          }
        }

        if (fgSt && fgSt.phase === 'parts') {
          const trimmed = body.trim().toLowerCase();
          if (trimmed === '.send' || trimmed === '.send main') {
            const mainOnly = trimmed === '.send main';
            try {
              const fgCmd = await commandLoader.getCommand('fg');
              if (fgCmd) {
                await typeBeforeSend(sock, jid, true);
                await fgCmd.handleSend(sock, jid, msg, mainOnly);
              }
            } catch (e) {
              console.error('FG send error:', e.message);
              await sock.sendMessage(jid, { text: '❌ Send error: ' + e.message }, { quoted: msg });
            }
            return;
          }
          const sfgMatch = body.trim().match(/^\.sfg\s+(\d+)$/i);
          if (sfgMatch) {
            const partNum = parseInt(sfgMatch[1], 10);
            try {
              const fgCmd = await commandLoader.getCommand('fg');
              if (fgCmd) {
                await typeBeforeSend(sock, jid, true);
                await fgCmd.handleSfg(sock, jid, msg, partNum);
              }
            } catch (e) {
              console.error('FG sfg error:', e.message);
              await sock.sendMessage(jid, { text: '❌ Error: ' + e.message }, { quoted: msg });
            }
            return;
          }
          const ffgMatch = body.trim().match(/^\.ffg\s+(.+)$/i);
          if (ffgMatch) {
            const target = ffgMatch[1].trim();
            try {
              const fgCmd = await commandLoader.getCommand('fg');
              if (fgCmd) {
                await typeBeforeSend(sock, jid, true);
                await fgCmd.handleFfg(sock, jid, msg, target);
              }
            } catch (e) {
              console.error('FG ffg error:', e.message);
              await sock.sendMessage(jid, { text: '❌ Error: ' + e.message }, { quoted: msg });
            }
            return;
          }
        }

        if (body.trim().toLowerCase() === '.stop ffg') {
          try {
            const fgCmd = await commandLoader.getCommand('fg');
            if (fgCmd) await fgCmd.handleStopFfg(sock, jid, msg);
          } catch (e) {
            console.error('FG stop ffg error:', e.message);
          }
          return;
        }
        if (body.trim().toLowerCase() === '.stop') {
          try {
            const fgCmd = await commandLoader.getCommand('fg');
            if (fgCmd) await fgCmd.handleStop(sock, jid, msg);
          } catch (e) {
            console.error('FG stop error:', e.message);
          }
          return;
        }
      }

      // ── .stop also works when sending is in progress (fg state may be 'sending') ─
      if (body.trim().toLowerCase() === '.stop' && fgState.isStopped !== undefined) {
        const fgSt2 = fgState.getState(jid);
        if (fgSt2 && (fgSt2.phase === 'sending' || fgSt2.phase === 'ffg_sending')) {
          try {
            const fgCmd = await commandLoader.getCommand('fg');
            if (fgCmd) await fgCmd.handleStop(sock, jid, msg);
          } catch (e) {
            console.error('FG stop error:', e.message);
          }
          return;
        }
      }

      // ── Anti bad word ───────────────────────────────────────────────────────
      if (settings.get('antiBad') && body && !senderIsOwner) {
        const badRegex = getBadWordsRegex();
        if (badRegex && badRegex.test(body)) {
          try {
            const count = violations.increment(jid, sender, 'antiBad');
            const remaining = violations.MAX_WARNS - count;
            if (count >= violations.MAX_WARNS) {
              violations.resetAll(jid, sender);
              await sock.sendMessage(jid, {
                text: `🚫 @${sender.split('@')[0]} has been *removed* for repeated bad language. (${violations.MAX_WARNS}/${violations.MAX_WARNS} warnings reached)`,
                mentions: [sender]
              }, { quoted: msg });
              if (isGroup) {
                await sock.groupParticipantsUpdate(jid, [sender], 'remove').catch(() => {});
              }
            } else {
              await sock.sendMessage(jid, {
                text: `⚠️ *Warning ${count}/${violations.MAX_WARNS}* — @${sender.split('@')[0]}, bad language is not allowed!\n_${remaining} more warning(s) before removal._`,
                mentions: [sender]
              }, { quoted: msg });
            }
          } catch (e) {
            console.error('Anti-bad error:', e.message);
          }
          return;
        }
      }

      // ── Anti link ───────────────────────────────────────────────────────────
      const antiLink = settings.get('antiLink');
      if (antiLink !== 'false' && body && !senderIsOwner) {
        LINK_REGEX.lastIndex = 0;
        if (LINK_REGEX.test(body)) {
          const linkInGroup = isGroup && (antiLink === 'groups' || antiLink === 'both');
          const linkInInbox = !isGroup && (antiLink === 'inbox' || antiLink === 'both');
          if (linkInGroup || linkInInbox) {
            try {
              const count = violations.increment(jid, sender, 'antiLink');
              const remaining = violations.MAX_WARNS - count;
              if (count >= violations.MAX_WARNS) {
                violations.resetAll(jid, sender);
                await sock.sendMessage(jid, {
                  text: `🚫 @${sender.split('@')[0]} has been *removed* for repeatedly sharing links. (${violations.MAX_WARNS}/${violations.MAX_WARNS} warnings reached)`,
                  mentions: [sender]
                }, { quoted: msg });
                if (isGroup) {
                  await sock.groupParticipantsUpdate(jid, [sender], 'remove').catch(() => {});
                }
              } else {
                await sock.sendMessage(jid, {
                  text: `⚠️ *Warning ${count}/${violations.MAX_WARNS}* — @${sender.split('@')[0]}, links are not allowed here!\n_${remaining} more warning(s) before removal._`,
                  mentions: [sender]
                }, { quoted: msg });
              }
            } catch (e) {
              console.error('Anti-link error:', e.message);
            }
            return;
          }
        }
      }

      // ── Autoresponder ───────────────────────────────────────────────────────
      const triggers = autoresponderCmd.getTriggers(jid);
      for (const [trigger, response] of Object.entries(triggers)) {
        if (body.toLowerCase().includes(trigger)) {
          try {
            await typeBeforeSend(sock, jid, false);
            if (response.startsWith('STICKER:')) {
              await sendStickerFromUrl(sock, jid, response.substring(8).trim(), msg);
            } else if (response.startsWith('STICKER_BASE64:')) {
              await sendStickerFromBase64(sock, jid, response.substring(15), msg);
            } else if (response.startsWith('IMAGE_BASE64:')) {
              await sendImageFromBase64(sock, jid, response.substring(13), msg);
            } else if (response.startsWith('VIDEO_BASE64:')) {
              await sendVideoFromBase64(sock, jid, response.substring(13), msg);
            } else if (response.startsWith('AUDIO_BASE64:')) {
              await sendAudioFromBase64(sock, jid, response.substring(13), msg);
            } else if (response.startsWith('FORWARD:')) {
              const forwardData = JSON.parse(response.substring(8));
              await sock.sendMessage(jid, forwardData.message, { quoted: msg });
            } else if (response.startsWith('STICKER_REF:')) {
              await sock.sendMessage(jid, { text: '❌ This sticker trigger is not supported. Please re-add it.' }, { quoted: msg });
            } else {
              await sock.sendMessage(jid, { text: response }, { quoted: msg });
            }
          } catch (error) {
            console.error('Error sending autoresponder:', error.message);
          }
          break;
        }
      }

      // ── Command dispatch ────────────────────────────────────────────────────
      if (!body.startsWith(config.commandPrefix)) return;
      const args = body.slice(config.commandPrefix.length).trim().split(/ +/);
      const command = args.shift().toLowerCase();

      if (!commandLoader.hasCommand(command)) return;

      console.log('COMMAND TRIGGERED:', command, args);
      const commandStartTime = Date.now();

      // Auto-react before execution
      if (settings.get('autoReact')) {
        const emoji = REACT_EMOJIS[command] || DEFAULT_REACT;
        sock.sendMessage(jid, {
          react: { text: emoji, key: msg.key }
        }).catch(() => {});
      }

      // Download/FitGirl commands get a longer typing delay (5-10 s)
      const DOWNLOAD_COMMANDS = new Set(['fg', 'tt', 'ig', 'ytmp3', 'ytmp4']);
      const isDownloadCmd = DOWNLOAD_COMMANDS.has(command);
      await typeBeforeSend(sock, jid, isDownloadCmd);

      try {
        const cmd = await commandLoader.getCommand(command);
        if (cmd) {
          await cmd.execute(sock, msg, args);
          performanceMonitor.recordCommand(command, commandStartTime);

          // After .menu, mark chat as pending a sub-menu reply
          if (command === 'menu') {
            pendingMenus.set(jid, true);
            setTimeout(() => pendingMenus.delete(jid), 5 * 60 * 1000);
          }
          // After .setting with no args (panel shown), mark chat as pending a code reply
          if (command === 'setting' && args.length === 0) {
            pendingSettings.set(jid, true);
            setTimeout(() => pendingSettings.delete(jid), 5 * 60 * 1000);
          }
        } else {
          await sock.sendMessage(jid, { text: '❌ Failed to load command.' }, { quoted: msg });
        }
      } catch (e) {
        console.error(`Error executing command ${command}:`, e);
        performanceMonitor.recordError(e, `command:${command}`);
        await sock.sendMessage(jid, { text: '❌ Error: ' + e.message }, { quoted: msg });
      }

    } catch (error) {
      console.error('Error processing message:', error.message);
      performanceMonitor.recordError(error, 'message_processing');
    }
  });

  await pollBackground(sock);
}

// Handle process termination gracefully
process.on('SIGINT', async () => {
  console.log(chalk.yellow('\nShutting down bot...'));
  clearBackgroundIntervals();
  commandLoader.shutdown();
  performanceMonitor.stop();
  await database.flush();
  apiManager.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log(chalk.yellow('\nShutting down bot...'));
  clearBackgroundIntervals();
  commandLoader.shutdown();
  performanceMonitor.stop();
  await database.flush();
  apiManager.shutdown();
  process.exit(0);
});

startBot();
