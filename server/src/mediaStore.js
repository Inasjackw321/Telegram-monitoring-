const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');

fs.mkdirSync(config.mediaDir, { recursive: true });

function typeFor(message) {
  if (message.photo) return 'photo';
  if (message.video) return 'video';
  const mime = message.document && message.document.mimeType;
  if (mime && mime.startsWith('video/')) return 'video';
  if (mime && mime.startsWith('image/')) return 'photo';
  return null; // skip generic documents/audio - keep map/feed focused on visual media
}

function extFor(message, type) {
  const attrs = (message.document && message.document.attributes) || [];
  const fileNameAttr = attrs.find((a) => a.fileName);
  if (fileNameAttr && fileNameAttr.fileName.includes('.')) {
    return fileNameAttr.fileName.split('.').pop().toLowerCase();
  }
  return type === 'video' ? 'mp4' : 'jpg';
}

async function saveMedia(client, message) {
  const type = typeFor(message);
  if (!type) return null;

  const ext = extFor(message, type);
  const filename = `${crypto.randomUUID()}.${ext}`;
  const outputFile = path.join(config.mediaDir, filename);

  await client.downloadMedia(message, { outputFile });

  return { type, url: `/media/${filename}` };
}

module.exports = { saveMedia };
