const config = require('./config');

// Optional, higher-quality/rate-limit-safe path if the user configured a DeepL key.
async function translateWithDeepL(text, targetLang) {
  const resp = await fetch('https://api-free.deepl.com/v2/translate', {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${config.deeplApiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ text, target_lang: targetLang.toUpperCase() }),
  });
  if (!resp.ok) throw new Error(`DeepL error ${resp.status}`);
  const data = await resp.json();
  const t = data.translations && data.translations[0];
  return {
    text: (t && t.text) || text,
    detectedLang: (t && t.detected_source_language && t.detected_source_language.toLowerCase()) || null,
  };
}

// Default path: no API key required. Uses the same public endpoint the
// Google Translate web widget uses. Best-effort - may be rate limited under
// heavy load, in which case configure DEEPL_API_KEY instead.
async function translateWithGoogleFree(text, targetLang) {
  const url =
    'https://translate.googleapis.com/translate_a/single' +
    `?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Google translate error ${resp.status}`);
  const data = await resp.json();
  const translated = (data[0] || []).map((segment) => segment[0]).join('');
  const detectedLang = data[2] || null;
  return { text: translated || text, detectedLang };
}

async function translateText(text, targetLang = config.targetLang) {
  if (!text || !text.trim()) return { text: '', detectedLang: null };

  if (config.deeplApiKey) {
    try {
      return await translateWithDeepL(text, targetLang);
    } catch (err) {
      console.warn('DeepL translate failed, falling back to free endpoint:', err.message);
    }
  }

  try {
    return await translateWithGoogleFree(text, targetLang);
  } catch (err) {
    console.warn('Translation failed, showing original text:', err.message);
    return { text, detectedLang: null };
  }
}

module.exports = { translateText };
