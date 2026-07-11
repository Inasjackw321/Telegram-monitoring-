import json

import config

MAX_BUFFER = 1000
_buffer = []


def _log_file():
    return config.DATA_DIR / 'messages.jsonl'


def load_recent():
    global _buffer
    log_file = _log_file()
    if not log_file.exists():
        return
    try:
        lines = log_file.read_text(encoding='utf-8').strip().splitlines()
        _buffer = [json.loads(line) for line in lines[-MAX_BUFFER:] if line]
        print(f'Loaded {len(_buffer)} message(s) from history.')
    except Exception as err:
        print(f'Could not load message history: {err}')


def add(message):
    _buffer.append(message)
    if len(_buffer) > MAX_BUFFER:
        _buffer.pop(0)
    try:
        config.DATA_DIR.mkdir(parents=True, exist_ok=True)
        with open(_log_file(), 'a', encoding='utf-8') as f:
            f.write(json.dumps(message) + '\n')
    except Exception as err:
        print(f'Could not persist message: {err}')


def update(message):
    for i, existing in enumerate(_buffer):
        if existing['id'] == message['id']:
            _buffer[i] = message
            return
    _buffer.append(message)


def get_recent(limit=200):
    return list(reversed(_buffer[-limit:]))
