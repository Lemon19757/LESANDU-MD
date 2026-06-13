module.exports = {
  botName:      process.env.BOT_NAME      || 'Lesandu-MD',
  ownerName:    process.env.OWNER_NAME    || 'Lesandu Biman',
  ownerNumber:  process.env.OWNER_NUMBER  || '94770175250',
  ownerNumbers: [(process.env.OWNER_NUMBER || '94770175250')],
  commandPrefix: process.env.COMMAND_PREFIX || '.',
  sessionName:  process.env.SESSION_NAME  || 'session',

  // AI
  geminiApiKey: process.env.GEMINI_API_KEY || '',

  // Database file paths
  databaseFiles: {
    alerts:       'alerts.json',
    schedules:    'schedules.json',
    birthdays:    'birthdays.json',
    points:       'points.json',
    autoresponder:'autoresponder.json',
    welcome:      'welcome.json'
  },

  // Background polling intervals (in milliseconds)
  polling: {
    priceAlerts:        60 * 1000,
    scheduledMessages:  60 * 1000,
    birthdayReminders:  60 * 1000
  },

  // Game settings
  games: {
    tictactoe:  { turnTimeout: 60 * 1000, pointsForWin: 5 },
    quiz:       { timeout: 30 * 1000, pointsForCorrect: 3 },
    tebakangka: { timeout: 30 * 1000, pointsForCorrect: 2 },
    tebakkata:  { timeout: 60 * 1000, pointsForCorrect: 3 }
  },

  // API settings
  api: {
    coingecko:     { baseUrl: 'https://api.coingecko.com/api/v3', timeout: 10000 },
    imageDownload: { timeout: 30000 }
  },

  // Input validation limits
  validation: {
    maxMessageLength:  1000,
    maxTriggerLength:  100,
    maxResponseLength: 1000,
    maxSymbolLength:   10,
    minPrice:          0.01
  },

  // File processing
  fileProcessing: {
    maxFileSize:           2 * 1024 * 1024 * 1024,
    supportedImageFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    supportedVideoFormats: ['mp4', 'avi', 'mov', 'mkv']
  }
};
