const welcomeLib = require('./welcome');
const { isAdmin, isOwner, getSender } = require('./utils');

module.exports = {
  name: 'cleargoodbye',
  description: 'Clear the custom goodbye message (resets to default)',
  usage: '.cleargoodbye',
  async execute(sock, msg) {
    const id = msg.key.remoteJid;
    const sender = getSender(msg);
    if (!id.endsWith('@g.us')) {
      return sock.sendMessage(id, { text: '❌ This command only works in groups.' }, { quoted: msg });
    }
    if (!isOwner(sender) && !(await isAdmin(sock, id, sender))) {
      return sock.sendMessage(id, { text: '❌ Only admins can use this command.' }, { quoted: msg });
    }
    const db = welcomeLib.load();
    if (db[id]) { delete db[id].goodbye; welcomeLib.save(db); }
    return sock.sendMessage(id, { text: '🗑️ Goodbye message cleared. Default message will be used.' }, { quoted: msg });
  }
};
