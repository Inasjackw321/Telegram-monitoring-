const fs = require('fs');
const { TelegramClient, Api } = require('telegram');
const { StringSession } = require('telegram/sessions');
const config = require('./config');
const sources = require('../../shared/sources.json');

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

// Builds the set of channels/groups to listen to: everything already joined
// on the account (if enabled) plus the explicit sources list, joining any
// public channel from that list that isn't already joined.
async function resolveMonitoredEntities(client) {
  const monitored = new Map(); // id string -> { entity, username, title }

  if (config.includeAllDialogs) {
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
  }

  for (const source of sources) {
    try {
      const entity = await client.getEntity(source.username);
      const id = entity.id.toString();
      if (!monitored.has(id)) {
        try {
          await client.invoke(new Api.channels.JoinChannel({ channel: entity }));
          console.log(`Joined @${source.username}`);
        } catch (joinErr) {
          console.warn(`Could not join @${source.username} (may already be joined or private):`, joinErr.message);
        }
        monitored.set(id, {
          entity,
          username: source.username,
          title: entity.title || source.username,
        });
      }
    } catch (err) {
      console.warn(`Could not resolve source @${source.username}:`, err.message);
    }
  }

  return monitored;
}

module.exports = { getClient, resolveMonitoredEntities };
