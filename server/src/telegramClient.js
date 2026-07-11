const fs = require('fs');
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const config = require('./config');

let client = null;

async function getClient() {
  if (client) return client;

  if (!config.apiId || !config.apiHash) {
    throw new Error(
      'TELEGRAM_API_ID / TELEGRAM_API_HASH are not set. Copy .env.example to .env and fill them in ' +
        '(get them from https://my.telegram.org).'
    );
  }

  if (!fs.existsSync(config.sessionFile)) {
    throw new Error(
      `No Telegram session found at ${config.sessionFile}. Run "npm run login" first to authenticate.`
    );
  }

  const sessionString = fs.readFileSync(config.sessionFile, 'utf8').trim();
  client = new TelegramClient(new StringSession(sessionString), config.apiId, config.apiHash, {
    connectionRetries: 5,
  });
  await client.connect();
  return client;
}

// Only channels/groups the account is already a member of - no auto-joining
// anything.
async function resolveMonitoredEntities(client) {
  const monitored = new Map(); // id string -> { entity, username, title }

  const dialogs = await client.getDialogs({});
  for (const dialog of dialogs) {
    if (dialog.isChannel || dialog.isGroup) {
      const id = dialog.id ? dialog.id.toString() : null;
      if (id) {
        monitored.set(id, {
          entity: dialog.entity,
          username: dialog.entity && dialog.entity.username,
          title: dialog.title,
        });
      }
    }
  }

  return monitored;
}

module.exports = { getClient, resolveMonitoredEntities };
