const fs = require('fs');
const path = require('path');
const config = require('./config');

const LOG_FILE = path.join(path.dirname(config.sessionFile), 'messages.jsonl');
const MAX_BUFFER = 1000;

let buffer = [];

function loadRecent() {
  try {
    if (fs.existsSync(LOG_FILE)) {
      const lines = fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n').filter(Boolean);
      buffer = lines.slice(-MAX_BUFFER).map((line) => JSON.parse(line));
      console.log(`Loaded ${buffer.length} message(s) from history.`);
    }
  } catch (err) {
    console.warn('Could not load message history:', err.message);
  }
}

function add(message) {
  buffer.push(message);
  if (buffer.length > MAX_BUFFER) buffer.shift();
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFileSync(LOG_FILE, JSON.stringify(message) + '\n');
  } catch (err) {
    console.warn('Could not persist message:', err.message);
  }
}

function update(message) {
  const idx = buffer.findIndex((m) => m.id === message.id);
  if (idx >= 0) {
    buffer[idx] = message;
  } else {
    buffer.push(message);
  }
}

function getRecent(limit = 200) {
  return buffer.slice(-limit).reverse(); // newest first
}

module.exports = { loadRecent, add, update, getRecent };
