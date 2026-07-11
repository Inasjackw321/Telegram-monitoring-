import requests

import config


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
