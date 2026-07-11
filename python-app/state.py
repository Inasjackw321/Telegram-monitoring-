"""Tiny shared state between telegram_worker.py and server.py, avoiding a
circular import between the two."""

_monitored_sources = []


def set_monitored_sources(sources):
    global _monitored_sources
    _monitored_sources = sources


def get_monitored_sources():
    return _monitored_sources
