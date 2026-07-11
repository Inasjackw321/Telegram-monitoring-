import os
import re
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / '.env')


def _resolve(value, fallback):
    p = Path(value or fallback)
    if not p.is_absolute():
        p = ROOT / p
    return p


# Shared Telegram API credentials (same ones used by the Node app - get them
# from https://my.telegram.org). The Python app keeps its own login session
# and port so it can run independently of (or alongside) the Node app.
API_ID = int(os.getenv('TELEGRAM_API_ID', '0') or '0')
API_HASH = os.getenv('TELEGRAM_API_HASH', '')

SESSION_FILE = _resolve(os.getenv('PY_SESSION_FILE'), 'python-app/data/session')
DATA_DIR = SESSION_FILE.parent
MEDIA_DIR = _resolve(os.getenv('PY_MEDIA_DIR'), 'python-app/media')

PORT = int(os.getenv('PY_PORT', '4300'))

TARGET_LANG = os.getenv('TRANSLATE_TARGET_LANG', 'en')
DEEPL_API_KEY = os.getenv('DEEPL_API_KEY', '')
INCLUDE_ALL_DIALOGS = os.getenv('INCLUDE_ALL_DIALOGS', 'true').lower() != 'false'

SOURCES_FILE = ROOT / 'shared' / 'sources.json'
GAZETTEER_FILE = ROOT / 'shared' / 'gazetteer.json'


def _write_env_value(key, value):
    env_path = ROOT / '.env'
    example_path = ROOT / '.env.example'

    if env_path.exists():
        lines = env_path.read_text(encoding='utf-8').splitlines()
    elif example_path.exists():
        lines = example_path.read_text(encoding='utf-8').splitlines()
    else:
        lines = []

    found = False
    for i, line in enumerate(lines):
        if line.strip().startswith(f'{key}='):
            lines[i] = f'{key}={value}'
            found = True
            break
    if not found:
        lines.append(f'{key}={value}')

    env_path.write_text('\n'.join(lines) + '\n', encoding='utf-8')


def reset_credentials():
    """Clear a rejected api_id/api_hash pair (in memory and in .env) so
    ensure_credentials() will prompt for them again."""
    global API_ID, API_HASH
    API_ID = 0
    API_HASH = ''
    _write_env_value('TELEGRAM_API_ID', '')
    _write_env_value('TELEGRAM_API_HASH', '')


def ensure_credentials():
    """Prompt for the Telegram API ID/hash right here in the console if
    they're not already configured, and save them to .env so this only
    ever happens once per machine."""
    global API_ID, API_HASH

    if API_ID and API_HASH:
        return

    print()
    print('=' * 60)
    print('Telegram API credentials needed (one-time setup)')
    print('=' * 60)
    print('Get these for free at https://my.telegram.org :')
    print('  1. Log in with the phone number of the account to monitor')
    print('  2. Click "API development tools"')
    print('  3. Create an app (any name/description is fine)')
    print('  4. Copy the "api_id" and "api_hash" values shown there')
    print()

    while not API_ID:
        raw = input('Paste your api_id (a number, e.g. 1234567): ').strip().strip('"\'')
        if raw.isdigit() and int(raw) > 0:
            API_ID = int(raw)
        else:
            print("That doesn't look like a valid api_id - it should be just digits. Try again.")

    while not API_HASH:
        raw = input('Paste your api_hash (32 letters/numbers): ').strip().strip('"\'')
        if re.fullmatch(r'[0-9a-fA-F]{32}', raw):
            API_HASH = raw
        else:
            print(
                "That doesn't look like a valid api_hash - it should be exactly 32 letters/numbers "
                "(e.g. 0123456789abcdef0123456789abcdef)."
            )
            print('Make sure you copied the "api_hash" field, not the api_id or app name, and with no extra spaces.')

    _write_env_value('TELEGRAM_API_ID', str(API_ID))
    _write_env_value('TELEGRAM_API_HASH', API_HASH)
    print()
    print("Saved - you won't be asked for these again on this computer.")
    print()
