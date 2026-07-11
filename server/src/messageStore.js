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
      const deduped = new Map();
      for (const line of lines) {
        const msg = JSON.parse(line);
        deduped.set(msg.id, msg); // keep the last (most recent) occurrence
      }
      buffer = Array.from(deduped.values()).slice(-MAX_BUFFER);
      console.log(`Loaded ${buffer.length} message(s) from history.`);
    }
  } catch (err) {
    console.warn('Could not load message history:', err.message);
  }
}

function add(message) {
  // Backfill re-runs on every restart and can re-fetch messages already
  // known from a previous run (or a message the live handler already
  // caught) - update in place instead of growing the log with duplicates.
  const idx = buffer.findIndex((m) => m.id === message.id);
  if (idx >= 0) {
    buffer[idx] = message;
    return;
  }

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
