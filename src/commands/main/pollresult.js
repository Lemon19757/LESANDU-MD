const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../../polls.json');
function load() { if (!fs.existsSync(dbPath)) return {}; return JSON.parse(fs.readFileSync(dbPath)); }

module.exports = {
  name: 'pollresult',
  description: 'Show results of the active poll in this chat',
  usage: '.pollresult',
  async execute(sock, msg, args) {
    const id = msg.key.remoteJid;
    const db = load();

    if (!db[id]) {
      return sock.sendMessage(id, { text: '❌ There is no active poll in this chat.' }, { quoted: msg });
    }

    const poll = db[id];
    const votes = poll.votes || {};
    const totalVotes = Object.keys(votes).length;

    const tally = {};
    poll.options.forEach(opt => { tally[opt] = 0; });
    Object.values(votes).forEach(v => { tally[v] = (tally[v] || 0) + 1; });

    const sorted = poll.options.slice().sort((a, b) => tally[b] - tally[a]);
    const winner = sorted[0];

    let text = `*📊 Poll Results: ${poll.question}*\n`;
    text += `Total votes: ${totalVotes}\n\n`;

    poll.options.forEach(opt => {
      const count = tally[opt] || 0;
      const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
      const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
      const crown = opt === winner && totalVotes > 0 ? ' 👑' : '';
      text += `*${opt}*${crown}\n${bar} ${count} vote${count !== 1 ? 's' : ''} (${pct}%)\n\n`;
    });

    if (totalVotes === 0) {
      text += '_No votes yet. Use .vote <option> to participate._';
    }

    return sock.sendMessage(id, { text }, { quoted: msg });
  },
};
