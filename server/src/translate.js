const config = require('./config');

const LANGUAGE_NAMES = {
  en: 'English', es: 'Spanish', fr: 'French', de: 'German',
  ar: 'Arabic', fa: 'Persian (Farsi)', tr: 'Turkish', ru: 'Russian',
  zh: 'Chinese', ja: 'Japanese', ko: 'Korean', pt: 'Portuguese',
  it: 'Italian', hi: 'Hindi', ur: 'Urdu', he: 'Hebrew',
};

let anthropicClient = null;

function getAnthropicClient() {
  if (!anthropicClient) {
    const Anthropic = require('@anthropic-ai/sdk');
    anthropicClient = new Anthropic({ apiKey: config.anthropicApiKey });
  }
  return anthropicClient;
}

// Best-quality path: Claude Haiku handles Persian/Arabic news idioms and
// political/military jargon far better than raw machine translation.
async function translateWithClaude(text, targetLang) {
  const langName = LANGUAGE_NAMES[targetLang.toLowerCase()] || targetLang;
  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    system:
      `You are a professional news translator. Translate the user's message into ${langName}. ` +
      'Preserve names, numbers, and factual claims exactly. Match the tone and register of the ' +
      'original (formal news writing, propaganda, casual chat, etc. - carry it over, do not ' +
      'sanitize or editorialize). Output ONLY the translation: no preamble, no explanation, no ' +
      'quotation marks around it. If the text is already in the target language, return it unchanged.',
    messages: [{ role: 'user', content: text }],
  });
  const translated = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();
  return { text: translated || text, detectedLang: null };
}

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
// heavy load, in which case configure ANTHROPIC_API_KEY or DEEPL_API_KEY instead.
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

  if (config.anthropicApiKey) {
    try {
      return await translateWithClaude(text, targetLang);
    } catch (err) {
      console.warn('Claude translate failed, falling back:', err.message);
    }
  }

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
