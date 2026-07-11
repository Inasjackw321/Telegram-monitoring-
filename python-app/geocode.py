import json
import re

import config

with open(config.GAZETTEER_FILE, 'r', encoding='utf-8') as f:
    _gazetteer = json.load(f)

# Longest names first, so e.g. "Bandar Abbas" matches before a shorter
# unrelated substring would, and so specific cities are preferred over
# country-level fallbacks.
_entries = sorted(_gazetteer.items(), key=lambda kv: len(kv[0]), reverse=True)
_patterns = [
    (name, coords, re.compile(r'\b' + re.escape(name) + r'\b', re.IGNORECASE)) for name, coords in _entries
]


def extract_locations(text, max_results=3):
    if not text:
        return []
    found = []
    seen_coords = set()

    for name, coords, pattern in _patterns:
        if len(found) >= max_results:
            break
        coord_key = (coords[0], coords[1])
        if coord_key in seen_coords:
            continue
        if pattern.search(text):
            found.append({'name': name, 'lat': coords[0], 'lon': coords[1]})
            seen_coords.add(coord_key)

    return found
