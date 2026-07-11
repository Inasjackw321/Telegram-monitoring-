const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const repoRoot = path.resolve(__dirname, '../../');

function resolveFromRoot(value, fallback) {
  return path.resolve(repoRoot, value || fallback);
}

module.exports = {
  apiId: parseInt(process.env.TELEGRAM_API_ID || '0', 10),
  apiHash: process.env.TELEGRAM_API_HASH || '',
  sessionFile: resolveFromRoot(process.env.TELEGRAM_SESSION_FILE, 'server/data/session.txt'),
  port: parseInt(process.env.PORT || '4000', 10),
  targetLang: process.env.TRANSLATE_TARGET_LANG || 'en',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  deeplApiKey: process.env.DEEPL_API_KEY || '',
  backfillLimit: parseInt(process.env.BACKFILL_LIMIT || '15', 10),
  backfillHours: parseInt(process.env.BACKFILL_HOURS || '24', 10),
  mediaDir: resolveFromRoot(process.env.MEDIA_DIR, 'server/media'),
};
