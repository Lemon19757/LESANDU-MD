const startTime = Date.now();

function formatUptime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (days > 0) parts.push(`*${days}d*`);
  if (hours > 0) parts.push(`*${hours}h*`);
  if (minutes > 0) parts.push(`*${minutes}m*`);
  parts.push(`*${seconds}s*`);

  return parts.join(' ');
}

module.exports = {
  name: 'uptime',
  description: 'Show how long the bot has been running',
  async execute(sock, msg, args) {
    const elapsed = Date.now() - startTime;
    const uptime = formatUptime(elapsed);
    const text = `⏱️ *Bot Uptime*\n\n🟢 Running for: ${uptime}`;
    await sock.sendMessage(msg.key.remoteJid, { text }, { quoted: msg });
  },
};
