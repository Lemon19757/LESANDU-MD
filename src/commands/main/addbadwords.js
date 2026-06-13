const settings = require('../../lib/settings');
const { isOwner, getSender } = require('./utils');

module.exports = {
  name: 'addbadwords',
  description: 'Manage the bad words list (owner only)',
  usage: '.addbadwords <word1> <word2> ... | .addbadwords list | .addbadwords remove <word>',
  async execute(sock, msg, args) {
    const sender = getSender(msg);
    const jid = msg.key.remoteJid;

    if (!isOwner(sender)) {
      return sock.sendMessage(jid, { text: '❌ This command is for the *owner* only.' }, { quoted: msg });
    }

    if (!args.length || args[0].toLowerCase() === 'list') {
      const words = settings.get('badWords') || [];
      if (!words.length) {
        return sock.sendMessage(jid, { text: '📋 The bad words list is *empty*.' }, { quoted: msg });
      }
      const list = words.map((w, i) => `${i + 1}. ${w}`).join('\n');
      return sock.sendMessage(jid, {
        text: `📋 *Bad Words List* (${words.length} words):\n\n${list}\n\n_Use_ *.addbadwords remove <word>* _to remove one._`
      }, { quoted: msg });
    }

    if (args[0].toLowerCase() === 'remove') {
      const word = args.slice(1).join(' ').trim().toLowerCase();
      if (!word) {
        return sock.sendMessage(jid, { text: '❌ Please specify a word to remove.\nUsage: *.addbadwords remove <word>*' }, { quoted: msg });
      }
      const words = settings.get('badWords') || [];
      const idx = words.findIndex(w => w.toLowerCase() === word);
      if (idx === -1) {
        return sock.sendMessage(jid, { text: `❌ *"${word}"* was not found in the bad words list.` }, { quoted: msg });
      }
      words.splice(idx, 1);
      settings.set('badWords', words);
      return sock.sendMessage(jid, { text: `✅ Removed *"${word}"* from the bad words list.\n📋 Total: ${words.length} words` }, { quoted: msg });
    }

    if (args[0].toLowerCase() === 'clear') {
      settings.set('badWords', []);
      return sock.sendMessage(jid, { text: '✅ Bad words list has been *cleared*.' }, { quoted: msg });
    }

    // Add words
    const words = settings.get('badWords') || [];
    const newWords = args.map(w => w.toLowerCase().trim()).filter(w => w.length > 0);
    const added = [];
    const skipped = [];

    for (const w of newWords) {
      if (words.includes(w)) {
        skipped.push(w);
      } else {
        words.push(w);
        added.push(w);
      }
    }

    if (added.length > 0) settings.set('badWords', words);

    let reply = '';
    if (added.length > 0) reply += `✅ *Added ${added.length} word(s):*\n${added.map(w => `• ${w}`).join('\n')}\n`;
    if (skipped.length > 0) reply += `\n⚠️ *Already in list (skipped):*\n${skipped.map(w => `• ${w}`).join('\n')}\n`;
    reply += `\n📋 Total bad words: *${words.length}*`;

    return sock.sendMessage(jid, { text: reply }, { quoted: msg });
  },
};
