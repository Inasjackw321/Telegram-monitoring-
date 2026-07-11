const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const { NewMessage } = require('telegram/events');
const { EditedMessage } = require('telegram/events/EditedMessage');

const config = require('./config');
const { getClient, resolveMonitoredEntities } = require('./telegramClient');
const { translateText } = require('./translate');
const { extractLocations } = require('./geocode');
const { saveMedia } = require('./mediaStore');
const store = require('./messageStore');
const state = require('./state');

store.loadRecent();

const app = express();
app.use(cors());
app.use('/media', express.static(config.mediaDir));

app.get('/api/messages', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 200, 1000);
  res.json(store.getRecent(limit));
});

app.get('/api/sources', (req, res) => {
  res.json(state.getMonitoredSources());
});

// Serve the built frontend in production (after `npm run build`).
const webDist = path.resolve(__dirname, '../../web/dist');
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/media')) return next();
    res.sendFile(path.join(webDist, 'index.html'));
  });
}

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

io.on('connection', (socket) => {
  socket.emit('bootstrap', store.getRecent(200));
});

async function processMessage(client, message, isEdit, knownSource, notify = true) {
  try {
    let username;
    let title;
    let chatId;
    if (knownSource) {
      ({ username, title } = knownSource);
      chatId = message.chatId ? message.chatId.toString() : 'unknown';
    } else {
      const chat = await message.getChat();
      username = (chat && chat.username) || null;
      title = (chat && (chat.title || chat.username)) || 'Unknown';
      chatId = chat && chat.id ? chat.id.toString() : 'unknown';
    }

    const text = message.message || '';
    let translatedText = text;
    let detectedLang = null;
    if (text.trim()) {
      const result = await translateText(text, config.targetLang);
      translatedText = result.text;
      detectedLang = result.detectedLang;
    }

    let media = null;
    if (message.media) {
      try {
        media = await saveMedia(client, message);
      } catch (err) {
        console.error('Media download failed:', err.message);
      }
    }

    const locations = extractLocations(`${translatedText}\n${text}`);

    const payload = {
      id: `${chatId}_${message.id}`,
      chatId,
      messageId: message.id,
      source: { username, title },
      date: new Date(message.date * 1000).toISOString(),
      originalText: text,
      translatedText: translatedText || text,
      detectedLang,
      media,
      locations,
      link: username ? `https://t.me/${username}/${message.id}` : null,
      edited: !!isEdit,
    };

    if (isEdit) {
      store.update(payload);
      if (notify) io.emit('messageUpdate', payload);
    } else {
      store.add(payload);
      if (notify) io.emit('message', payload);
    }
  } catch (err) {
    console.error('Failed to process message:', err);
  }
}

// On startup, load each monitored channel's recent history so the timeline
// isn't empty until new messages happen to arrive - without this, the app
// would only ever show messages sent after it started.
async function backfillHistory(client, monitored) {
  if (config.backfillLimit <= 0) return;

  const cutoff = Date.now() - config.backfillHours * 60 * 60 * 1000;
  console.log(
    `Backfilling up to ${config.backfillLimit} recent message(s) per channel (last ${config.backfillHours}h)...`
  );

  let total = 0;
  for (const entry of monitored.values()) {
    const label = entry.username || entry.title;
    try {
      const messages = await client.getMessages(entry.entity, { limit: config.backfillLimit });
      for (const message of messages) {
        if (message.date && message.date * 1000 < cutoff) break; // newest-first, rest are older
        if (!message.message && !message.media) continue;
        await processMessage(client, message, false, { username: entry.username, title: entry.title }, false);
        total += 1;
      }
    } catch (err) {
      console.warn(`Could not backfill @${label}:`, err.message);
    }
  }

  console.log(`Backfill complete: ${total} message(s) loaded.`);
}

async function main() {
  const client = await getClient();
  console.log('Connected to Telegram.');

  const monitored = await resolveMonitoredEntities(client);
  console.log(`Monitoring ${monitored.size} channel(s)/group(s):`);
  for (const entry of monitored.values()) {
    console.log(`  - ${entry.title}${entry.username ? ` (@${entry.username})` : ''}`);
  }

  state.setMonitoredSources(
    Array.from(monitored.values())
      .filter((entry) => entry.username)
      .map((entry) => ({ username: entry.username, title: entry.title }))
  );

  const chatEntities = Array.from(monitored.values()).map((entry) => entry.entity);
  const eventFilter = chatEntities.length ? { chats: chatEntities } : {};

  client.addEventHandler(async (event) => {
    await processMessage(client, event.message, false);
  }, new NewMessage(eventFilter));

  client.addEventHandler(async (event) => {
    await processMessage(client, event.message, true);
  }, new EditedMessage(eventFilter));

  // Fire-and-forget: don't block startup on backfilling every channel.
  backfillHistory(client, monitored).catch((err) => console.error('Backfill failed:', err));

  server.listen(config.port, () => {
    console.log(`Server listening on http://localhost:${config.port}`);
  });
}

main().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
