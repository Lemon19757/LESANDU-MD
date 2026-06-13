const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../../polls.json');
function load() { if (!fs.existsSync(dbPath)) return {}; return JSON.parse(fs.readFileSync(dbPath)); }
function save(data) { fs.writeFileSync(dbPath, JSON.stringify(data, null, 2)); }

module.exports = {
  name: 'vote',
  description: 'Vote on the active poll in this chat',
  usage: '.vote <option>',
  async execute(sock, msg, args) {
    const id = msg.key.remoteJid;
    const db = load();

    if (!db[id]) {
      return sock.sendMessage(id, { text: '❌ There is no active poll in this chat. Start one with *.poll*.' }, { quoted: msg });
    }

    const option = args.join(' ').trim();
    if (!option) {
      const poll = db[id];
      let hint = `*📊 Active Poll: ${poll.question}*\n\nOptions:\n`;
      poll.options.forEach((opt, i) => { hint += `${i + 1}. ${opt}\n`; });
      hint += '\nUse *.vote <option>* to cast your vote.';
      return sock.sendMessage(id, { text: hint }, { quoted: msg });
    }

    const poll = db[id];
    const match = poll.options.find(opt => opt.toLowerCase() === option.toLowerCase());
    if (!match) {
      let err = `❌ *"${option}"* is not a valid option.\n\nChoose from:\n`;
      poll.options.forEach((opt, i) => { err += `${i + 1}. ${opt}\n`; });
      return sock.sendMessage(id, { text: err }, { quoted: msg });
    }

    const voter = msg.key.participant || msg.key.remoteJid;
    db[id].votes = db[id].votes || {};
    const previous = db[id].votes[voter];
    db[id].votes[voter] = match;
    save(db);

    const reply = previous
      ? `✅ Your vote changed from *${previous}* → *${match}*.`
      : `✅ Your vote for *${match}* has been recorded!`;

    return sock.sendMessage(id, { text: reply }, { quoted: msg });
  },
};
