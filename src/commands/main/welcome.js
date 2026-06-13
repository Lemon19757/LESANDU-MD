const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, '../../../welcome.json');

function load() {
  try {
    if (!fs.existsSync(dbPath)) return {};
    return JSON.parse(fs.readFileSync(dbPath));
  } catch (e) { return {}; }
}

function save(data) {
  try { fs.writeFileSync(dbPath, JSON.stringify(data, null, 2)); } catch (e) {}
}

const HELP_TEXT =
  `*╭──────────●●►*\n*│👋 Welcome / Goodbye Commands*\n*╰──────────●●►*\n\n` +
  `*.setwelcome <msg>* — set join message\n` +
  `*.setgoodbye <msg>* — set leave message\n` +
  `*.viewwelcome* — view current join message\n` +
  `*.viewgoodbye* — view current leave message\n` +
  `*.clearwelcome* — reset to default\n` +
  `*.cleargoodbye* — reset to default\n\n` +
  `*Placeholders:* \`@user\`  \`@group\`\n\n` +
  `_Toggle on/off: .setting → option 5_`;

module.exports = {
  name: 'welcome',
  description: 'Show welcome/goodbye command help',
  usage: '.welcome',
  async execute(sock, msg) {
    return sock.sendMessage(msg.key.remoteJid, { text: HELP_TEXT }, { quoted: msg });
  },

  // ── Shared helpers used by index.js group-event handler ──────────────────────
  getWelcome(id) {
    try { return load()[id]?.welcome || null; } catch (e) { return null; }
  },
  getGoodbye(id) {
    try { return load()[id]?.goodbye || null; } catch (e) { return null; }
  },

  // ── Shared DB helpers used by sub-command files ───────────────────────────────
  load,
  save,
};
