import os
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
