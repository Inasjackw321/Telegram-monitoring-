// One-time interactive login. Run with `npm run login` (from repo root)
// or `npm run login -w server`. Prompts for phone number / code / 2FA
// password in the terminal, then saves a session string so the main
// server can connect without any further interaction.
const fs = require('fs');
const path = require('path');
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const input = require('input');
const config = require('./config');

(async () => {
  if (!config.apiId || !config.apiHash) {
    console.error(
      'Set TELEGRAM_API_ID and TELEGRAM_API_HASH in your .env file first ' +
        '(get them from https://my.telegram.org -> API development tools).'
    );
    process.exit(1);
  }

  console.log('Logging in to Telegram...');

  const client = new TelegramClient(new StringSession(''), config.apiId, config.apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => await input.text('Phone number (with country code, e.g. +15551234567): '),
    password: async () => await input.text('2FA password (leave blank if you have none): '),
    phoneCode: async () => await input.text('Login code sent to your Telegram app: '),
    onError: (err) => console.error(err),
  });

  const sessionString = client.session.save();
  fs.mkdirSync(path.dirname(config.sessionFile), { recursive: true });
  fs.writeFileSync(config.sessionFile, sessionString, { mode: 0o600 });

  console.log(`\nLogin successful. Session saved to ${config.sessionFile}`);
  console.log('Keep this file secret - it grants full access to the account, like a password.');
  console.log('You can now start the app with "npm run dev" (or "npm start" for production).');

  await client.disconnect();
  process.exit(0);
})().catch((err) => {
  console.error('Login failed:', err);
  process.exit(1);
});
