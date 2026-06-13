const welcomeLib = require('./welcome');
const { isAdmin, isOwner, getSender } = require('./utils');

module.exports = {
  name: 'setwelcome',
  description: 'Set a custom welcome message for this group (admin only)',
  usage: '.setwelcome <message>  |  placeholders: @user @group',
  async execute(sock, msg, args) {
    const id = msg.key.remoteJid;
    const sender = getSender(msg);
    if (!id.endsWith('@g.us')) {
      return sock.sendMessage(id, { text: '❌ This command only works in groups.' }, { quoted: msg });
    }
    if (!isOwner(sender) && !(await isAdmin(sock, id, sender))) {
      return sock.sendMessage(id, { text: '❌ Only admins can use this command.' }, { quoted: msg });
    }
    const message = args.join(' ').trim();
    if (!message) {
      return sock.sendMessage(id, {
        text: `*Usage:* .setwelcome <message>\n\n*Placeholders:*\n• \`@user\` — mentions the new member\n• \`@group\` — inserts the group name\n\n*Example:*\n.setwelcome Welcome @user to @group! 🎉\n\n_Toggle on/off: .setting → option 5_`
      }, { quoted: msg });
    }
    if (message.length > 1000) return sock.sendMessage(id, { text: '❌ Message too long. Max 1000 characters.' }, { quoted: msg });
    const db = welcomeLib.load();
    db[id] = db[id] || {};
    db[id].welcome = message;
    welcomeLib.save(db);
    return sock.sendMessage(id, {
      text: `✅ *Welcome message set!*\n\n_Preview:_\n${message.replace(/@user/g, '@Member').replace(/@group/g, 'this group')}`
    }, { quoted: msg });
  }
};
