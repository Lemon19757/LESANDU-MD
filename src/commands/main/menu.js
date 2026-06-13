const fs = require('fs');
const path = require('path');
const os = require('os');
const config = require('../../../config');

const menuImagePath = path.join(__dirname, '../../assets/menu.png');
const subMenuImagePath = path.join(__dirname, '../../assets/submenu.png');

function getUptime() {
  const s = Math.floor(process.uptime());
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${m}m ${sec}s`;
}

function getRam() {
  const used = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
  const total = (os.totalmem() / 1024 / 1024).toFixed(1);
  return `${used}MB / ${total}MB`;
}

function countCommands() {
  try {
    const dir = path.join(__dirname, '../');
    return fs.readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'utils.js').length;
  } catch { return '?'; }
}

const SUB_MENUS = {
  1: {
    title: 'OWNER',
    emoji: '👑',
    commands: [
      { name: 'setting',     use: '.setting' },
      { name: 'addbadwords', use: '.addbadwords <word(s)> | list | remove <word> | clear' },
      { name: 'performance', use: '.performance' },
      { name: 'dl',          use: '.dl <url>  *(download & send any direct link)*' },
    ]
  },
  2: {
    title: 'DOWNLOAD',
    emoji: '⬇️',
    commands: [
      { name: 'tt',      use: '.tt <tiktok url>  *(download without watermark)*' },
      { name: 'ig',      use: '.ig <instagram url>  *(reels, posts, stories)*' },
      { name: 'fb',      use: '.fb <facebook url>  *(videos, reels)*' },
      { name: 'toimg',   use: '.toimg [png|jpg]  *(reply to a sticker)*' },
      { name: 'sticker', use: '.sticker  *(reply to image or video → sticker)*' },
      { name: 'fg',      use: '.fg <game name>  *(search FitGirl repacks)*' },
      { name: 'dl',      use: '.dl <url>  *(owner only — direct link download)*' },
    ]
  },
  3: {
    title: 'FUN',
    emoji: '🎉',
    commands: [
      { name: 'poll',       use: '.poll <question>|<option1>|<option2>' },
      { name: 'vote',       use: '.vote <option>' },
      { name: 'pollresult', use: '.pollresult' },
    ]
  },
  4: {
    title: 'MAIN',
    emoji: '🏠',
    commands: [
      { name: 'menu',   use: '.menu' },
      { name: 'ping',   use: '.ping' },
      { name: 'uptime', use: '.uptime' },
      { name: 'help',   use: '.help [command]' },
      { name: 'owner',  use: '.owner' },
    ]
  },
  5: {
    title: 'CONVERT',
    emoji: '🔄',
    commands: [
      { name: 'toimg',   use: '.toimg [png|jpg]  *(reply to a sticker → image)*' },
      { name: 'sticker', use: '.sticker  *(reply to image or video → sticker)*' },
    ]
  },
  6: {
    title: 'OTHER',
    emoji: '✨',
    commands: [
      { name: 'getpp',        use: '.getpp | .getpp @member | .getpp +94XXXXXXXXX | reply' },
      { name: 'autoresponder',use: '.autoresponder' },
      { name: 'addtrigger',   use: '.addtrigger <trigger>|<response>' },
      { name: 'deltrigger',   use: '.deltrigger <trigger>' },
      { name: 'listtriggers', use: '.listtriggers' },
    ]
  },
  7: {
    title: 'GAMES',
    emoji: '🎮',
    commands: [
      { name: 'poll',       use: '.poll <question>|<opt1>|<opt2>  *(create a game poll)*' },
      { name: 'vote',       use: '.vote <option>' },
      { name: 'pollresult', use: '.pollresult' },
    ]
  },
  8: {
    title: 'GROUP',
    emoji: '👥',
    commands: [
      { name: 'add',        use: '.add +94XXXXXXXXX | .add @member' },
      { name: 'kick',       use: '.kick @member | .kick +94XXXXXXXXX' },
      { name: 'kickall',    use: '.kickall  *(owner only — kick all members one by one)*' },
      { name: 'promote',    use: '.promote @member' },
      { name: 'demote',     use: '.demote @member' },
      { name: 'mute',       use: '.mute  *(only admins can send)*' },
      { name: 'unmute',     use: '.unmute  *(everyone can send)*' },
      { name: 'warn',       use: '.warn @member' },
      { name: 'unwarn',     use: '.unwarn @member' },
      { name: 'tagall',     use: '.tagall [message]' },
      { name: 'link',       use: '.link' },
      { name: 'setsubject', use: '.setsubject <new group name>' },
      { name: 'setdesc',    use: '.setdesc <group description text>' },
      { name: 'setwelcome',  use: '.setwelcome <message>  _(@user @group)_' },
      { name: 'setgoodbye',  use: '.setgoodbye <message>  _(@user @group)_' },
      { name: 'viewwelcome', use: '.viewwelcome' },
      { name: 'viewgoodbye', use: '.viewgoodbye' },
      { name: 'clearwelcome',use: '.clearwelcome' },
      { name: 'cleargoodbye',use: '.cleargoodbye' },
    ]
  },
};

function buildSubMenuText(num) {
  const sub = SUB_MENUS[num];
  if (!sub) return null;

  let text = `*HELLO* .\n`;
  text += `*╭─「 ᴄᴏᴍᴍᴀɴᴅꜱ ᴘᴀɴᴇʟ」*\n`;
  text += `*│◈ 𝚁𝙰𝙼 𝚄𝚂𝙰𝙶𝙴 -* ${getRam()}\n`;
  text += `*│◈ 𝚁𝚄𝙽𝚃𝙸𝙼𝙴 -* ${getUptime()}\n`;
  text += `*╰──────────●●►*\n`;
  text += `*╭──────────●●►*\n`;
  text += `*│${sub.emoji} ${sub.title} Command List:*\n`;
  text += `*╰──────────●●►*\n`;

  for (const cmd of sub.commands) {
    text += `*╭──────────●●►*\n`;
    text += `*│⛩️ Command ☛* \`${cmd.name}\`\n`;
    text += `*│🏮 Use ☛* ${cmd.use}\n`;
    text += `*╰──────────●●►*\n`;
  }

  text += `\n➠ *Total Commands in ${sub.title}*: ${sub.commands.length}\n\n`;
  text += `*㋛ 𝙿𝙾𝚆𝙴𝚁𝙳 𝙱𝚈 𝙻𝙴𝚂𝙰𝙽𝙳𝚄  〽️Ｄ*`;
  return text;
}

async function showSubMenu(sock, msg, num) {
  const text = buildSubMenuText(num);
  if (!text) return;

  try {
    if (fs.existsSync(subMenuImagePath)) {
      const imageBuffer = fs.readFileSync(subMenuImagePath);
      await sock.sendMessage(
        msg.key.remoteJid,
        { image: imageBuffer, mimetype: 'image/png', caption: text },
        { quoted: msg }
      );
    } else {
      await sock.sendMessage(msg.key.remoteJid, { text }, { quoted: msg });
    }
  } catch (e) {
    await sock.sendMessage(msg.key.remoteJid, { text }, { quoted: msg });
  }
}

module.exports = {
  name: 'menu',
  description: 'Show command list',
  showSubMenu,
  async execute(sock, msg, args) {
    const { getSender } = require('./utils');
    const sender = getSender(msg);
    const senderNumber = sender.split('@')[0];

    const menu =
`*👋 _𝐇𝐄𝐋𝐋𝐎𝐖_* .
🫟 *Wᴇʟᴄᴏᴍᴇ Tᴏ LESANDU-MD*🫟

*╭─「 ꜱᴛᴀᴛᴜꜱ ᴅᴇᴛᴀɪʟꜱ 」*
*│*👾 *\`Bot\`*= *LESANDU-MD*
*│*👤 *\`User\`*= ${senderNumber}
*│*☎️ *\`Owner Number\`*= ${config.ownerNumbers[0]}
*│*⏰ *\`Uptime\`*= ${getUptime()}
*│*📂 *\`Ram\`*= ${getRam()}
*│*📊 *\`Commands\`*= ${countCommands()}
*│*✒️ *\`Prefix\`*= ${config.commandPrefix}
*╰──────────●●►*

🔢 *\`ʀᴇᴘʟʏ ᴛʜᴇ ɴᴜᴍʙᴇʀ ʙᴇʟᴏᴡ\`*🗿

*🔸 1* ❯❯◦ *_OWNER MENU_*
*🔸 2* ❯❯◦ *_DOWNLOAD MENU_*
*🔸 3* ❯❯◦ *_FUN MENU_*
*🔸 4* ❯❯◦ *_MAIN MENU_*
*🔸 5* ❯❯◦ *_CONVERT MENU_*
*🔸 6* ❯❯◦ *_OTHER MENU_*
*🔸 7* ❯❯◦ *_GAMES MENU_*
*🔸 8* ❯❯◦ *_GROUP MENU_*

*㋛ 𝙿𝙾𝚆𝙴𝚁𝙳 𝙱𝚈 𝙻𝙴𝚂𝙰𝙽𝙳𝚄  〽️Ｄ*`;

    try {
      if (fs.existsSync(menuImagePath)) {
        const imageBuffer = fs.readFileSync(menuImagePath);
        await sock.sendMessage(
          msg.key.remoteJid,
          { image: imageBuffer, mimetype: 'image/png', caption: menu },
          { quoted: msg }
        );
      } else {
        await sock.sendMessage(msg.key.remoteJid, { text: menu }, { quoted: msg });
      }
    } catch (e) {
      await sock.sendMessage(msg.key.remoteJid, { text: menu }, { quoted: msg });
    }
  },
};
