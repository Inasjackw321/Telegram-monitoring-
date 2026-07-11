import requests

import config

_LANGUAGE_NAMES = {
    'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German',
    'ar': 'Arabic', 'fa': 'Persian (Farsi)', 'tr': 'Turkish', 'ru': 'Russian',
    'zh': 'Chinese', 'ja': 'Japanese', 'ko': 'Korean', 'pt': 'Portuguese',
    'it': 'Italian', 'hi': 'Hindi', 'ur': 'Urdu', 'he': 'Hebrew',
}

_anthropic_client = None


def _get_anthropic_client():
    global _anthropic_client
    if _anthropic_client is None:
        import anthropic
        _anthropic_client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)
    return _anthropic_client


def _translate_with_claude(text, target_lang):
    lang_name = _LANGUAGE_NAMES.get(target_lang.lower(), target_lang)
    client = _get_anthropic_client()
    response = client.messages.create(
        model='claude-haiku-4-5',
        max_tokens=1024,
        system=(
            f'You are a professional news translator. Translate the user\'s message into {lang_name}. '
            'Preserve names, numbers, and factual claims exactly. Match the tone and register of the '
            'original (formal news writing, propaganda, casual chat, etc. - carry it over, do not '
            'sanitize or editorialize). Output ONLY the translation: no preamble, no explanation, no '
            'quotation marks around it. If the text is already in the target language, return it unchanged.'
        ),
        messages=[{'role': 'user', 'content': text}],
    )
    translated = ''.join(block.text for block in response.content if block.type == 'text').strip()
    return translated or text, None


def _translate_with_deepl(text, target_lang):
    resp = requests.post(
        'https://api-free.deepl.com/v2/translate',
        headers={'Authorization': f'DeepL-Auth-Key {config.DEEPL_API_KEY}'},
        data={'text': text, 'target_lang': target_lang.upper()},
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    translation = (data.get('translations') or [{}])[0]
    text_out = translation.get('text', text)
    detected = translation.get('detected_source_language')
    return text_out, (detected.lower() if detected else None)


def _translate_with_google_free(text, target_lang):
    resp = requests.get(
        'https://translate.googleapis.com/translate_a/single',
        params={'client': 'gtx', 'sl': 'auto', 'tl': target_lang, 'dt': 't', 'q': text},
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    translated = ''.join(segment[0] for segment in (data[0] or []) if segment[0])
    detected_lang = data[2] if len(data) > 2 else None
    return translated or text, detected_lang


def translate_text(text, target_lang=None):
    target_lang = target_lang or config.TARGET_LANG
    if not text or not text.strip():
        return '', None

    if config.ANTHROPIC_API_KEY:
        try:
            return _translate_with_claude(text, target_lang)
        except Exception as err:
            print(f'Claude translate failed, falling back: {err}')

    if config.DEEPL_API_KEY:
        try:
            return _translate_with_deepl(text, target_lang)
        except Exception as err:
            print(f'DeepL translate failed, falling back to free endpoint: {err}')

    try:
        return _translate_with_google_free(text, target_lang)
    except Exception as err:
        print(f'Translation failed, showing original text: {err}')
        return text, None
