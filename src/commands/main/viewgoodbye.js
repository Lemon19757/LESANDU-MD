const welcomeLib = require('./welcome');

module.exports = {
  name: 'viewgoodbye',
  description: 'View the current goodbye message for this group',
  usage: '.viewgoodbye',
  async execute(sock, msg) {
    const id = msg.key.remoteJid;
    if (!id.endsWith('@g.us')) {
      return sock.sendMessage(id, { text: '❌ This command only works in groups.' }, { quoted: msg });
    }
    const current = welcomeLib.getGoodbye(id);
    return sock.sendMessage(id, {
      text: current
        ? `📋 *Current goodbye message:*\n\n${current}`
        : `ℹ️ No custom goodbye message set.\n\nA default message is used automatically.\nSet one with: .setgoodbye <message>`
    }, { quoted: msg });
  }
};
