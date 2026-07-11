import socket as pysocket
import threading
import time
import webbrowser

import config
import message_store
import telegram_worker
from server import emit_message, run_server


def _wait_for_port(host, port, timeout=15):
    deadline = time.time() + timeout
    while time.time() < deadline:
        with pysocket.socket(pysocket.AF_INET, pysocket.SOCK_STREAM) as s:
            if s.connect_ex((host, port)) == 0:
                return True
        time.sleep(0.2)
    return False


def _run_in_browser(url):
    """Fallback when no desktop window backend is available: keep the
    server running and use a normal browser tab instead of crashing."""
    print()
    print(f'Opening in your browser instead: {url}')
    print('Leave this window open - the app keeps running here. Press Ctrl+C to stop it.')
    webbrowser.open(url)
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print('\nStopped.')


def main():
    config.ensure_credentials()

    message_store.load_recent()
    telegram_worker.set_emit_callback(emit_message)

    threading.Thread(target=run_server, daemon=True).start()
    threading.Thread(target=telegram_worker.run, daemon=True).start()

    if not _wait_for_port('127.0.0.1', config.PORT):
        print(f'Warning: server did not come up on port {config.PORT} in time; opening window anyway.')

    print(
        'If this is your first run, check this terminal for a Telegram login '
        'prompt (phone number / code / 2FA password).'
    )

    url = f'http://127.0.0.1:{config.PORT}'

    try:
        import webview
    except ImportError as err:
        print(f'\nCould not load pywebview ({err}).')
        _run_in_browser(url)
        return

    try:
        webview.create_window('Telegram Live Monitor', url, width=1400, height=900, min_size=(900, 600))
        webview.start()
    except Exception as err:
        print(f'\nCould not open the desktop window ({err}).')
        print('(See the README for how to enable the desktop window backend on this OS.)')
        _run_in_browser(url)


if __name__ == '__main__':
    main()
