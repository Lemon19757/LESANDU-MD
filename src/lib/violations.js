const fs = require('fs');
const path = require('path');

const VIOLATIONS_PATH = path.join(__dirname, '../../violations.json');
const MAX_WARNS = 4;

function load() {
  try {
    if (fs.existsSync(VIOLATIONS_PATH)) {
      return JSON.parse(fs.readFileSync(VIOLATIONS_PATH, 'utf8'));
    }
  } catch (e) {}
  return {};
}

function save(data) {
  fs.writeFileSync(VIOLATIONS_PATH, JSON.stringify(data, null, 2));
}

function getCount(jid, sender, type) {
  return load()[jid]?.[sender]?.[type] || 0;
}

function increment(jid, sender, type) {
  const db = load();
  if (!db[jid]) db[jid] = {};
  if (!db[jid][sender]) db[jid][sender] = {};
  db[jid][sender][type] = (db[jid][sender][type] || 0) + 1;
  save(db);
  return db[jid][sender][type];
}

function decrement(jid, sender, type) {
  const db = load();
  if (!db[jid]?.[sender]?.[type]) return 0;
  db[jid][sender][type] = Math.max(0, db[jid][sender][type] - 1);
  save(db);
  return db[jid][sender][type];
}

function reset(jid, sender, type) {
  const db = load();
  if (db[jid]?.[sender]?.[type] !== undefined) {
    db[jid][sender][type] = 0;
    save(db);
  }
}

function resetAll(jid, sender) {
  const db = load();
  if (db[jid]?.[sender]) {
    delete db[jid][sender];
    save(db);
  }
}

module.exports = { MAX_WARNS, getCount, increment, decrement, reset, resetAll };
