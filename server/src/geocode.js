const gazetteer = require('../../shared/gazetteer.json');

// Longest names first, so e.g. "Bandar Abbas" matches before a shorter
// unrelated substring would, and so specific cities are preferred over
// country-level fallbacks.
const entries = Object.entries(gazetteer).sort((a, b) => b[0].length - a[0].length);

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const patterns = entries.map(([name, coords]) => ({
  name,
  coords,
  regex: new RegExp(`\\b${escapeRegex(name)}\\b`, 'i'),
}));

function extractLocations(text, max = 3) {
  if (!text) return [];
  const found = [];
  const seenCoords = new Set();

  for (const { name, coords, regex } of patterns) {
    if (found.length >= max) break;
    const coordKey = `${coords[0]},${coords[1]}`;
    if (seenCoords.has(coordKey)) continue;
    if (regex.test(text)) {
      found.push({ name, lat: coords[0], lon: coords[1] });
      seenCoords.add(coordKey);
    }
  }

  return found;
}

module.exports = { extractLocations };
