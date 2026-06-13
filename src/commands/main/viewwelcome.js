const welcomeLib = require('./welcome');

module.exports = {
  name: 'viewwelcome',
  description: 'View the current welcome message for this group',
  usage: '.viewwelcome',
  async execute(sock, msg) {
    const id = msg.key.remoteJid;
    if (!id.endsWith('@g.us')) {
      return sock.sendMessage(id, { text: '❌ This command only works in groups.' }, { quoted: msg });
    }
    const current = welcomeLib.getWelcome(id);
    return sock.sendMessage(id, {
      text: current
        ? `📋 *Current welcome message:*\n\n${current}`
        : `ℹ️ No custom welcome message set.\n\nA default message is used automatically.\nSet one with: .setwelcome <message>`
    }, { quoted: msg });
  }
};
