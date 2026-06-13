const fs = require('fs');
const path = require('path');

const SETTINGS_PATH = path.join(__dirname, '../../settings.json');

const DEFAULTS = {
  mode:           process.env.MODE           || 'public',
  antiBad:        process.env.ANTI_BAD       === 'false' ? false : (process.env.ANTI_BAD === 'true' ? true : false),
  antiLink:       process.env.ANTI_LINK      || 'false',
  autoReact:      process.env.AUTO_REACT     === 'true',
  welcomeGoodbye: process.env.WELCOME_GOODBYE !== 'false',
  antiDelete:     process.env.ANTI_DELETE    || 'false',
  badWords: [
    'හුත්තා','පකයා','හුත්','පක','බිජ්ජ','පුක','පකා',
    'වේසයා','වේස','හුකනවා','හුකපන්','බිජු','හුත්ත','fuck','ass'
  ]
};

function load() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')) };
    }
  } catch (e) {}
  return { ...DEFAULTS };
}

function save(data) {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2));
}

function get(key) {
  return load()[key];
}

function set(key, value) {
  const s = load();
  s[key] = value;
  save(s);
}

function getAll() {
  return load();
}

module.exports = { load, save, get, set, getAll, DEFAULTS };
