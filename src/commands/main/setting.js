const config = require('../../../config');
const settings = require('../../lib/settings');
const { isOwner, getSender } = require('./utils');

const PANEL = `*╔══════════════════════╗*
*║   ⚙️  SETTING PANEL    ║*
*╚══════════════════════╝*

*🔢 Type  .setting <code>  to apply (e.g. .setting 1.1)*

*\`[1] MODE\`*
*🔸    1.1* ❯❯◦ *PUBLIC* 🧬
*🔸    1.2* ❯❯◦ *PRIVATE* 🧬
*🔸    1.3* ❯❯◦ *GROUPS* 🧬

*\`[2] ANTI BAD\`*
*🔸    2.1* ❯❯◦ *True 🔑*
*🔸    2.2* ❯❯◦ *False 🔒*

*\`[3] ANTI LINK\`*
*🔸    3.1* ❯❯◦ *Only Groups 🧬*
*🔸    3.2* ❯❯◦ *Only Inbox 🧬*
*🔸    3.3* ❯❯◦ *Group & Inbox 🧬*
*🔸    3.4* ❯❯◦ *False 🔒*

*\`[4] AUTO REACT\`*
*🔸    4.1* ❯❯◦ *True 🔑*
*🔸    4.2* ❯❯◦ *False 🔒*

*\`[5] WELCOME GOODBYE\`*
*🔸    5.1* ❯❯◦ *True 🔑*
*🔸    5.2* ❯❯◦ *False 🔒*

*\`[6] ANTI DELETE\`*
*🔸    6.1* ❯❯◦ *Only Inbox 🧬*
*🔸    6.2* ❯❯◦ *Only Group 🧬*
*🔸    6.3* ❯❯◦ *Group & Inbox 🧬*
*🔸    6.4* ❯❯◦ *False 🔒*

*㋛ 𝙿𝙾𝚆𝙴𝚁𝙳 𝙱𝚈 𝙻𝙴𝚂𝙰𝙽𝙳𝚄  〽️Ｄ*`;

const SETTING_MAP = {
  '1.1': { key: 'mode',           value: 'public',  label: 'MODE → PUBLIC 🧬' },
  '1.2': { key: 'mode',           value: 'private', label: 'MODE → PRIVATE 🧬' },
  '1.3': { key: 'mode',           value: 'groups',  label: 'MODE → GROUPS 🧬' },
  '2.1': { key: 'antiBad',        value: true,      label: 'ANTI BAD → True 🔑' },
  '2.2': { key: 'antiBad',        value: false,     label: 'ANTI BAD → False 🔒' },
  '3.1': { key: 'antiLink',       value: 'groups',  label: 'ANTI LINK → Only Groups 🧬' },
  '3.2': { key: 'antiLink',       value: 'inbox',   label: 'ANTI LINK → Only Inbox 🧬' },
  '3.3': { key: 'antiLink',       value: 'both',    label: 'ANTI LINK → Group & Inbox 🧬' },
  '3.4': { key: 'antiLink',       value: 'false',   label: 'ANTI LINK → False 🔒' },
  '4.1': { key: 'autoReact',      value: true,      label: 'AUTO REACT → True 🔑' },
  '4.2': { key: 'autoReact',      value: false,     label: 'AUTO REACT → False 🔒' },
  '5.1': { key: 'welcomeGoodbye', value: true,      label: 'WELCOME GOODBYE → True 🔑' },
  '5.2': { key: 'welcomeGoodbye', value: false,     label: 'WELCOME GOODBYE → False 🔒' },
  '6.1': { key: 'antiDelete',     value: 'inbox',   label: 'ANTI DELETE → Only Inbox 🧬' },
  '6.2': { key: 'antiDelete',     value: 'groups',  label: 'ANTI DELETE → Only Group 🧬' },
  '6.3': { key: 'antiDelete',     value: 'both',    label: 'ANTI DELETE → Group & Inbox 🧬' },
  '6.4': { key: 'antiDelete',     value: 'false',   label: 'ANTI DELETE → False 🔒' },
};

function currentStatus() {
  const s = settings.getAll();
  return `\n*📊 Current Settings:*\n` +
    `• Mode: *${s.mode.toUpperCase()}*\n` +
    `• Anti Bad: *${s.antiBad ? 'ON 🔑' : 'OFF 🔒'}*\n` +
    `• Anti Link: *${s.antiLink === 'false' ? 'OFF 🔒' : s.antiLink.toUpperCase() + ' 🧬'}*\n` +
    `• Auto React: *${s.autoReact ? 'ON 🔑' : 'OFF 🔒'}*\n` +
    `• Welcome/Goodbye: *${s.welcomeGoodbye ? 'ON 🔑' : 'OFF 🔒'}*\n` +
    `• Anti Delete: *${s.antiDelete === 'false' ? 'OFF 🔒' : s.antiDelete.toUpperCase() + ' 🧬'}*`;
}

module.exports = {
  name: 'setting',
  description: 'Bot settings panel (owner only). Use: .setting  or  .setting 1.1',
  usage: '.setting | .setting <code>  (e.g. .setting 1.1)',
  SETTING_MAP,
  isOwner,
  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const sender = getSender(msg);
    if (!isOwner(sender)) {
      return sock.sendMessage(jid, { text: '❌ This command is for the *owner* only.' }, { quoted: msg });
    }

    // One-step mode: .setting 1.1  → apply immediately
    const code = (args[0] || '').trim();
    if (code && SETTING_MAP[code]) {
      const { key, value, label } = SETTING_MAP[code];
      settings.set(key, value);
      return sock.sendMessage(jid, { text: `✅ *Setting updated:*\n${label}` }, { quoted: msg });
    }

    // No arg (or invalid code) → show the panel
    await sock.sendMessage(jid, { text: PANEL + currentStatus() }, { quoted: msg });
  },
};
