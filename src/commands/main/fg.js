const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { PassThrough } = require('stream');
const fgState = require('../../lib/fg-state');

const BASE_URL = 'https://fitgirl-repacks.site';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

const TEMP_DIR = path.join(__dirname, '../../../temp');

async function searchGames(query) {
  const url = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
  const { data } = await axios.get(url, { headers: HEADERS, timeout: 20000 });
  const $ = cheerio.load(data);
  const results = [];
  $('article').each((i, el) => {
    const titleEl = $(el).find('.entry-title a, h1.entry-title a, h2.entry-title a').first();
    const title = titleEl.text().trim();
    const link = titleEl.attr('href');
    if (title && link) results.push({ title, url: link });
  });
  return results;
}

async function getFuckingFastLinks(pageUrl) {
  const { data } = await axios.get(pageUrl, { headers: HEADERS, timeout: 20000 });
  const $ = cheerio.load(data);
  const links = [];
  const seen = new Set();

  $('li').each((i, el) => {
    const liText = $(el).text();
    if (!liText.includes('FuckingFast') && !liText.includes('Fucking Fast')) return;
    $(el).find('a[href*="fuckingfast.co"]').each((j, a) => {
      const href = $(a).attr('href');
      const label = $(a).text().trim();
      if (href && !seen.has(href)) {
        seen.add(href);
        links.push({ filename: label || `file_${j + 1}`, url: href });
      }
    });
  });

  if (!links.length) {
    $('a[href*="fuckingfast.co"]').each((i, a) => {
      const href = $(a).attr('href');
      const label = $(a).text().trim();
      if (href && !seen.has(href)) {
        seen.add(href);
        links.push({ filename: label || `file_${i + 1}`, url: href });
      }
    });
  }

  return links;
}

async function getDirectDownloadUrl(fuckingfastPageUrl) {
  const { data } = await axios.get(fuckingfastPageUrl, {
    headers: { ...HEADERS, 'Referer': 'https://fitgirl-repacks.site/' },
    timeout: 20000,
  });
  const match = data.match(/window\.open\(['"`](https:\/\/dl\.fuckingfast\.co\/dl\/[^'"`]+)['"`]/);
  if (!match) {
    const match2 = data.match(/href=['"`](https:\/\/dl\.fuckingfast\.co\/dl\/[^'"`]+)['"`]/);
    if (!match2) throw new Error('Could not extract direct download URL');
    return match2[1];
  }
  return match[1];
}

function buildProgressText(filename, partNum, total, done, fileSize, speed, type = 'download') {
  const percent = fileSize > 0 ? Math.round((done / fileSize) * 100) : 0;
  const filled = Math.round(percent / 5);
  const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);
  const doneMB = (done / 1024 / 1024).toFixed(2);
  const totalMB = fileSize > 0 ? (fileSize / 1024 / 1024).toFixed(2) : '?';
  const speedMB = (speed / 1024 / 1024).toFixed(2);
  const icon = type === 'upload' ? '⬆️' : '⬇️';
  const label = type === 'upload' ? 'Sending' : 'Downloading';
  return `${icon} *${label} Part ${partNum}/${total}*\n\n📄 \`${filename}\`\n\n${bar} *${percent}%*\n\n💾 ${doneMB} / ${totalMB} MB\n⚡ ${speedMB} MB/s`;
}

async function downloadAndSendFileToTarget(sock, requesterJid, targetJid, link, partNum, total, msg, gameTitle) {
  const tempFile = path.join(TEMP_DIR, `fg_${Date.now()}_${partNum}.part`);

  const statusMsg = await sock.sendMessage(requesterJid, {
    text: `⬇️ *Downloading Part ${partNum}/${total}*\n\n📄 \`${link.filename}\`\n\n⏳ Getting link...`
  }, { quoted: msg });

  let updateInterval = null;

  try {
    let directUrl;
    try {
      directUrl = await getDirectDownloadUrl(link.url);
    } catch (e) {
      await sock.sendMessage(requesterJid, {
        text: `❌ *[${partNum}/${total}]* Could not get direct link\n_${e.message}_`,
        edit: statusMsg.key,
      });
      return false;
    }

    if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

    const response = await axios({
      method: 'GET',
      url: directUrl,
      responseType: 'stream',
      timeout: 30 * 60 * 1000,
      headers: { ...HEADERS, 'Referer': 'https://fuckingfast.co/' },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    const totalSize = parseInt(response.headers['content-length'] || '0', 10);
    let downloaded = 0;
    let lastDownloaded = 0;
    let lastTime = Date.now();
    let speed = 0;

    updateInterval = setInterval(async () => {
      const now = Date.now();
      const elapsed = (now - lastTime) / 1000;
      speed = elapsed > 0 ? (downloaded - lastDownloaded) / elapsed : 0;
      lastTime = now;
      lastDownloaded = downloaded;
      try {
        await sock.sendMessage(requesterJid, {
          text: buildProgressText(link.filename, partNum, total, downloaded, totalSize, speed),
          edit: statusMsg.key,
        });
      } catch (_) {}
    }, 3000);

    await new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(tempFile);
      response.data.on('data', chunk => { downloaded += chunk.length; });
      response.data.pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', reject);
      response.data.on('error', reject);
    });

    clearInterval(updateInterval);
    updateInterval = null;

    const fileSize = fs.statSync(tempFile).size;
    const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);
    const mimetype = 'application/octet-stream';

    await sock.sendMessage(requesterJid, {
      text: `⬆️ *Sending Part ${partNum}/${total}*\n\n📄 \`${link.filename}\`\n\n⏳ *Uploading to WhatsApp...*\n\n💾 ${fileSizeMB} MB`,
      edit: statusMsg.key,
    });

    const fileBuffer = fs.readFileSync(tempFile);

    await sock.sendMessage(targetJid, {
      document: fileBuffer,
      mimetype,
      fileName: link.filename,
      caption: `*🧩 ${link.filename}*\n\n*${gameTitle || ''}*\n\n*㋛ 𝙿𝙾𝚆𝙴𝚁𝙳 𝙱𝚈 𝙻𝙴𝚂𝙰𝙽𝙳𝚄  〽️Ｄ*`,
    });

    await sock.sendMessage(requesterJid, {
      text: `✅ *[${partNum}/${total}]* *Sent!*`,
      edit: statusMsg.key,
    });

    return true;
  } catch (err) {
    if (updateInterval) clearInterval(updateInterval);
    await sock.sendMessage(requesterJid, {
      text: `❌ *[${partNum}/${total}]* Failed\n_${err.message}_`,
      edit: statusMsg.key,
    });
    return false;
  } finally {
    if (updateInterval) clearInterval(updateInterval);
    try { if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile); } catch (_) {}
  }
}

async function downloadAndSendFile(sock, jid, link, partNum, total, msg, gameTitle) {
  const tempFile = path.join(TEMP_DIR, `fg_${Date.now()}_${partNum}.part`);

  const statusMsg = await sock.sendMessage(jid, {
    text: `⬇️ *Downloading Part ${partNum}/${total}*\n\n📄 \`${link.filename}\`\n\n⏳ Getting link...`
  }, { quoted: msg });

  let updateInterval = null;

  try {
    let directUrl;
    try {
      directUrl = await getDirectDownloadUrl(link.url);
    } catch (e) {
      await sock.sendMessage(jid, {
        text: `❌ *[${partNum}/${total}]* Could not get direct link\n_${e.message}_`,
        edit: statusMsg.key,
      });
      return false;
    }

    if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

    const response = await axios({
      method: 'GET',
      url: directUrl,
      responseType: 'stream',
      timeout: 30 * 60 * 1000,
      headers: { ...HEADERS, 'Referer': 'https://fuckingfast.co/' },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    const totalSize = parseInt(response.headers['content-length'] || '0', 10);
    let downloaded = 0;
    let lastDownloaded = 0;
    let lastTime = Date.now();
    let speed = 0;

    updateInterval = setInterval(async () => {
      const now = Date.now();
      const elapsed = (now - lastTime) / 1000;
      speed = elapsed > 0 ? (downloaded - lastDownloaded) / elapsed : 0;
      lastTime = now;
      lastDownloaded = downloaded;
      try {
        await sock.sendMessage(jid, {
          text: buildProgressText(link.filename, partNum, total, downloaded, totalSize, speed),
          edit: statusMsg.key,
        });
      } catch (_) {}
    }, 3000);

    await new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(tempFile);
      response.data.on('data', chunk => { downloaded += chunk.length; });
      response.data.pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', reject);
      response.data.on('error', reject);
    });

    clearInterval(updateInterval);
    updateInterval = null;

    const fileSize = fs.statSync(tempFile).size;
    const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);
    const mimetype = 'application/octet-stream';

    await sock.sendMessage(jid, {
      text: `⬆️ *Sending Part ${partNum}/${total}*\n\n📄 \`${link.filename}\`\n\n⏳ *Uploading to WhatsApp...*\n\n💾 ${fileSizeMB} MB`,
      edit: statusMsg.key,
    });

    const fileBuffer = fs.readFileSync(tempFile);

    await sock.sendMessage(jid, {
      document: fileBuffer,
      mimetype,
      fileName: link.filename,
      caption: `*🧩 ${link.filename}*\n\n*${gameTitle || ''}*\n\n*㋛ 𝙿𝙾𝚆𝙴𝚁𝙳 𝙱𝚈 𝙻𝙴𝚂𝙰𝙽𝙳𝚄  〽️Ｄ*`,
    }, { quoted: msg });

    await sock.sendMessage(jid, {
      text: `✅ *[${partNum}/${total}]* *Sent!*`,
      edit: statusMsg.key,
    });

    return true;
  } catch (err) {
    if (updateInterval) clearInterval(updateInterval);
    await sock.sendMessage(jid, {
      text: `❌ *[${partNum}/${total}]* Failed\n_${err.message}_`,
      edit: statusMsg.key,
    });
    return false;
  } finally {
    if (updateInterval) clearInterval(updateInterval);
    try { if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile); } catch (_) {}
  }
}

module.exports = {
  name: 'fg',
  description: 'Search FitGirl repacks and send game files via FuckingFast mirror',

  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;

    if (!args.length) {
      return sock.sendMessage(jid, {
        text: `🎮 *FitGirl Repack Downloader*\n\nUsage: *.fg <game name>*\nExample: *.fg far cry 3*\n\n_Finds and sends all game parts directly via FuckingFast mirror._`
      }, { quoted: msg });
    }

    const query = args.join(' ');
    await sock.sendMessage(jid, { react: { text: '🔍', key: msg.key } });

    let results;
    try {
      results = await searchGames(query);
    } catch (e) {
      await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
      return sock.sendMessage(jid, { text: `❌ Search failed: ${e.message}` }, { quoted: msg });
    }

    if (!results.length) {
      await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
      return sock.sendMessage(jid, {
        text: `❌ No results found for *"${query}"*.\n_Try a different game name._`
      }, { quoted: msg });
    }

    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
    fgState.setState(jid, { phase: 'select', results });

    let text = `*★❮𝗟 𝗘 𝗦 𝗔 𝗡 𝗗 𝗨  𝗚 𝗔 𝗠 𝗘  𝗭 𝗢 𝗡 𝗘 ❯★*\n\n`;
    text += `👽 Entered Name || ${query}\n\n`;
    text += `🔢 Reply below number\n\n\n`;
    text += `*[Search Results]*\n\n`;
    results.slice(0, 10).forEach((r, i) => {
      text += `*🔸 ${i + 1}* ❯❯◦ *${r.title}*\n`;
    });
    text += `\n*㋛ 𝙿𝙾𝚆𝙴𝚁𝙳 𝙱𝚈 𝙻𝙴𝚂𝙰𝙽𝙳𝚄  〽️Ｄ*`;

    return sock.sendMessage(jid, { text }, { quoted: msg });
  },

  async handleSelect(sock, jid, msg, num) {
    const state = fgState.getState(jid);
    if (!state || state.phase !== 'select') return false;

    const idx = num - 1;
    if (idx < 0 || idx >= Math.min(state.results.length, 10)) return false;

    const game = state.results[idx];
    await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

    let links;
    try {
      links = await getFuckingFastLinks(game.url);
    } catch (e) {
      fgState.clearState(jid);
      await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
      await sock.sendMessage(jid, { text: `❌ Failed to fetch links: ${e.message}` }, { quoted: msg });
      return true;
    }

    if (!links.length) {
      fgState.clearState(jid);
      await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
      await sock.sendMessage(jid, {
        text: `❌ No FuckingFast mirror links found for *${game.title}*.\n_This game may not have a FuckingFast mirror yet._`
      }, { quoted: msg });
      return true;
    }

    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
    fgState.setState(jid, { phase: 'parts', gameTitle: game.title, links });

    let text = `📦 *${game.title}*\n\n`;
    text += `⚡ *FuckingFast Mirror — ${links.length} file(s)*\n\n\n`;

    links.forEach((l, i) => {
      text += `*🔸 ${i + 1}* ❯❯◦ *_${l.filename}_*\n`;
    });

    text += `\n━━━━━━━━━━━━━━━━━━━━`;
    text += `\n_Reply *.send* to send all ${links.length} file(s) here._`;
    text += `\n_Reply *.send main* to send only main .rar parts here._`;
    text += `\n_Reply *.sfg <number>* to send a specific part here._`;
    text += `\n_Reply *.ffg +94XXXXXXXXX* to send all parts to a number's inbox._`;
    text += `\n_Reply *.ffg Group Name* to send all parts to a group._`;
    text += `\n\n*㋛ 𝙿𝙾𝚆𝙴𝚁𝙳 𝙱𝚈 𝙻𝙴𝚂𝙰𝙽𝙳𝚄  〽️Ｄ*`;

    await sock.sendMessage(jid, { text }, { quoted: msg });
    return true;
  },

  async handleSfg(sock, jid, msg, num) {
    const state = fgState.getState(jid);
    if (!state || state.phase !== 'parts') return false;

    const { gameTitle, links } = state;

    if (num < 1 || num > links.length) {
      await sock.sendMessage(jid, {
        text: `❌ Invalid part number *${num}*.\n_Choose between 1 and ${links.length}._`
      }, { quoted: msg });
      return true;
    }

    const link = links[num - 1];

    await sock.sendMessage(jid, {
      text: `📥 *Download Start!*\n\n🎮 *${gameTitle}*\n\n📁 Sending: *Part ${num}/${links.length}*`
    }, { quoted: msg });

    fgState.clearStop(jid);

    if (fgState.isStopped(jid)) {
      await sock.sendMessage(jid, { text: `🛑 *Stopped before starting.*` }, { quoted: msg });
      fgState.clearStop(jid);
      return true;
    }

    const ok = await downloadAndSendFile(sock, jid, link, num, links.length, msg, gameTitle);

    if (!ok) {
      await sock.sendMessage(jid, {
        text: `❌ *Part ${num} failed to send.*\n_Try again or pick a different part._`
      }, { quoted: msg });
    }

    return true;
  },

  async handleSend(sock, jid, msg, mainOnly) {
    const state = fgState.getState(jid);
    if (!state || state.phase !== 'parts') return false;

    const { gameTitle, links } = state;
    let filesToSend = mainOnly
      ? links.filter(l => l.filename.match(/\.part\d+\.rar/i))
      : links;

    if (!filesToSend.length) {
      filesToSend = links;
    }

    fgState.clearState(jid);
    fgState.clearStop(jid);

    fgState.setState(jid, { phase: 'sending', gameTitle, total: filesToSend.length });

    await sock.sendMessage(jid, {
      text: `📥 *Download Start!*\n\n🎮 *${gameTitle}*\n\n📁 Sending: *All ${filesToSend.length} parts* (${filesToSend.length} files)`
    }, { quoted: msg });

    let success = 0;
    let fail = 0;
    let stopped = false;

    for (let i = 0; i < filesToSend.length; i++) {
      if (fgState.isStopped(jid)) {
        stopped = true;
        break;
      }
      const ok = await downloadAndSendFile(sock, jid, filesToSend[i], i + 1, filesToSend.length, msg, gameTitle);
      if (ok) success++; else fail++;
    }

    fgState.clearState(jid);
    fgState.clearStop(jid);

    if (stopped) {
      await sock.sendMessage(jid, {
        text: `🛑 *Stopped!*\n📦 *${gameTitle}*\n\n✔️ Sent: ${success}/${filesToSend.length}\n_Download cancelled by .stop command._`
      }, { quoted: msg });
    } else {
      const summary = `✅ *Done!*\n📦 *${gameTitle}*\n\n`
        + `✔️ Sent: ${success}/${filesToSend.length}\n`
        + (fail ? `❌ Failed: ${fail}/${filesToSend.length}\n` : '')
        + `\n_All files sent directly to this chat._`;
      await sock.sendMessage(jid, { text: summary }, { quoted: msg });
    }
    return true;
  },

  async handleFfg(sock, jid, msg, targetArg) {
    const state = fgState.getState(jid);
    if (!state || state.phase !== 'parts') return false;

    const { gameTitle, links } = state;
    const arg = targetArg.trim();

    let targetJid = null;
    let targetLabel = arg;

    const phoneMatch = arg.match(/^\+?(\d[\d\s\-()]{6,})$/);
    if (phoneMatch) {
      const cleaned = phoneMatch[1].replace(/[\s\-()]/g, '');
      targetJid = `${cleaned}@s.whatsapp.net`;
      targetLabel = `+${cleaned}`;
    } else {
      try {
        const groups = await sock.groupFetchAllParticipating();
        const entries = Object.entries(groups);
        const exact = entries.find(([, g]) =>
          g.subject && g.subject.toLowerCase() === arg.toLowerCase()
        );
        if (exact) {
          targetJid = exact[0];
          targetLabel = exact[1].subject;
        } else {
          const fuzzy = entries.find(([, g]) =>
            g.subject && g.subject.toLowerCase().includes(arg.toLowerCase())
          );
          if (fuzzy) {
            targetJid = fuzzy[0];
            targetLabel = fuzzy[1].subject;
          }
        }
      } catch (e) {
        await sock.sendMessage(jid, {
          text: `❌ Could not fetch groups: ${e.message}`
        }, { quoted: msg });
        return true;
      }
    }

    if (!targetJid) {
      await sock.sendMessage(jid, {
        text: `❌ Target not found: *${arg}*\n_Check the phone number or make sure the bot is in that group._`
      }, { quoted: msg });
      return true;
    }

    await sock.sendMessage(jid, {
      text: `📥 *Download Start!*\n\n🎮 *${gameTitle}*\n\n📁 Sending: *All ${links.length} parts* (${links.length} files) → ${targetLabel}`
    }, { quoted: msg });

    fgState.clearStop(jid);
    fgState.setState(jid, { phase: 'ffg_sending', gameTitle, targetLabel, total: links.length });

    let success = 0;
    let fail = 0;
    let stopped = false;

    for (let i = 0; i < links.length; i++) {
      if (fgState.isStopped(jid)) {
        stopped = true;
        break;
      }
      const ok = await downloadAndSendFileToTarget(sock, jid, targetJid, links[i], i + 1, links.length, msg, gameTitle);
      if (ok) success++; else fail++;
    }

    fgState.clearState(jid);
    fgState.clearStop(jid);

    if (stopped) {
      await sock.sendMessage(jid, {
        text: `🛑 *Stopped!*\n_Sent ${success}/${links.length} parts to ${targetLabel}_`
      }, { quoted: msg });
    } else {
      await sock.sendMessage(jid, {
        text: `✅ *Done! Sent to* ${targetLabel}\n📦 *${gameTitle}*\n\n✔️ Sent: ${success}/${links.length}` +
          (fail ? `\n❌ Failed: ${fail}/${links.length}` : '')
      }, { quoted: msg });
    }

    return true;
  },

  async handleStopFfg(sock, jid, msg) {
    const state = fgState.getState(jid);
    if (state && state.phase === 'ffg_sending') {
      fgState.requestStop(jid);
      await sock.sendMessage(jid, {
        text: `🛑 *Stop requested!*\nWaiting for current file to finish, then cancelling send to *${state.targetLabel || 'target'}*...`
      }, { quoted: msg });
      return true;
    }
    await sock.sendMessage(jid, {
      text: `ℹ️ No active *.ffg* send to stop.`
    }, { quoted: msg });
    return true;
  },

  async handleStop(sock, jid, msg) {
    const state = fgState.getState(jid);
    if (state && (state.phase === 'sending' || state.phase === 'ffg_sending')) {
      fgState.requestStop(jid);
      await sock.sendMessage(jid, {
        text: `🛑 *Stop requested!*\nWaiting for current file to finish, then cancelling...`
      }, { quoted: msg });
      return true;
    }
    fgState.clearState(jid);
    await sock.sendMessage(jid, {
      text: `ℹ️ No active download to stop.`
    }, { quoted: msg });
    return true;
  },

  getDirectDownloadUrl,
  getFuckingFastLinks,
  searchGames,
};
