const socket = io();
const map = L.map('map').setView([33.5, 44], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);

let messages = [];
let sources = [];
let activeSources = new Set();
let selectedId = null;
let mapMarkers = new Map(); // coord key -> L.Marker

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

async function loadInitial() {
  const [msgs, srcs] = await Promise.all([
    fetch('/api/messages?limit=300').then((r) => r.json()),
    fetch('/api/sources').then((r) => r.json()),
  ]);
  sources = srcs;
  activeSources = new Set(srcs.map((s) => s.username));
  renderSourceFilter();
  messages = msgs;
  renderAll();
}

function renderSourceFilter() {
  const container = document.getElementById('source-filter');
  container.innerHTML = '';
  sources.forEach((s) => {
    const label = el('label', activeSources.has(s.username) ? 'on' : 'off');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = activeSources.has(s.username);
    input.addEventListener('change', () => {
      if (activeSources.has(s.username)) activeSources.delete(s.username);
      else activeSources.add(s.username);
      renderSourceFilter();
      renderAll();
    });
    label.appendChild(input);
    label.appendChild(document.createTextNode(s.username));
    container.appendChild(label);
  });
}

function visibleMessages() {
  return messages.filter((m) => !m.source || !m.source.username || activeSources.has(m.source.username));
}

function renderAll() {
  renderFeed();
  renderMarkers();
}

function dateLabel(d) {
  const now = new Date();
  const startOfDay = (dt) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function renderFeed() {
  const list = document.getElementById('feed-list');
  const visible = visibleMessages()
    .slice()
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  document.getElementById('feed-count').textContent = visible.length;
  list.innerHTML = '';
  list.classList.add('timeline');

  if (!visible.length) {
    list.appendChild(el('div', 'empty', 'Waiting for messages...'));
    return;
  }

  let lastDateKey = null;
  visible.forEach((m) => {
    const d = m.date ? new Date(m.date) : null;
    const dateKey = d ? d.toDateString() : 'unknown';
    if (dateKey !== lastDateKey) {
      const sep = el('div', 'timeline-date-sep');
      sep.appendChild(el('span', null, d ? dateLabel(d) : 'Unknown date'));
      list.appendChild(sep);
      lastDateKey = dateKey;
    }
    list.appendChild(renderTimelineItem(m, d));
  });
}

function renderTimelineItem(m, d) {
  const item = el('div', 'timeline-item' + (m.id === selectedId ? ' selected' : ''));

  const rail = el('div', 'timeline-rail');
  rail.appendChild(el('span', 'timeline-dot'));
  item.appendChild(rail);

  const body = el('div', 'timeline-body');
  body.appendChild(renderCard(m, d));
  item.appendChild(body);

  return item;
}

function renderCard(m, d) {
  const card = el('div', 'message-card' + (m.id === selectedId ? ' selected' : ''));

  const meta = el('div', 'message-meta');
  meta.appendChild(el('span', 'source', (m.source && m.source.title) || 'Unknown'));
  const time = document.createElement('time');
  time.textContent = d ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
  if (d) time.title = d.toLocaleString();
  meta.appendChild(time);
  card.appendChild(meta);

  if (m.media && m.media.type === 'photo') {
    const img = document.createElement('img');
    img.className = 'media';
    img.loading = 'lazy';
    img.src = m.media.url;
    card.appendChild(img);
  } else if (m.media && m.media.type === 'video') {
    const video = document.createElement('video');
    video.className = 'media';
    video.controls = true;
    video.preload = 'metadata';
    video.src = m.media.url;
    card.appendChild(video);
  }

  const textEl = el('p', 'message-text', m.translatedText || m.originalText || '');
  card.appendChild(textEl);

  if (m.locations && m.locations.length) {
    card.appendChild(el('div', 'locations', '📍 ' + m.locations.map((l) => l.name).join(', ')));
  }

  const actions = el('div', 'message-actions');
  if (m.originalText && m.originalText !== m.translatedText) {
    const btn = document.createElement('button');
    btn.textContent = 'Show original';
    let showingOriginal = false;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showingOriginal = !showingOriginal;
      textEl.textContent = showingOriginal ? m.originalText : m.translatedText;
      btn.textContent = showingOriginal ? 'Show translation' : 'Show original';
    });
    actions.appendChild(btn);
  }
  if (m.link) {
    const a = document.createElement('a');
    a.href = m.link;
    a.target = '_blank';
    a.rel = 'noreferrer';
    a.textContent = 'Open in Telegram';
    a.addEventListener('click', (e) => e.stopPropagation());
    actions.appendChild(a);
  }
  card.appendChild(actions);

  card.addEventListener('click', () => selectMessage(m));
  return card;
}

function selectMessage(m) {
  selectedId = m.id;
  renderFeed();
  if (m.locations && m.locations.length) {
    const loc = m.locations[0];
    map.flyTo([loc.lat, loc.lon], Math.max(map.getZoom(), 8), { duration: 1 });
  }
}

function renderMarkers() {
  mapMarkers.forEach((marker) => map.removeLayer(marker));
  mapMarkers.clear();

  const groups = new Map();
  visibleMessages().forEach((m) => {
    (m.locations || []).forEach((loc) => {
      const key = loc.lat.toFixed(2) + ',' + loc.lon.toFixed(2);
      if (!groups.has(key)) groups.set(key, { lat: loc.lat, lon: loc.lon, name: loc.name, messages: [] });
      groups.get(key).messages.push(m);
    });
  });

  groups.forEach((group, key) => {
    const marker = L.marker([group.lat, group.lon]).addTo(map);
    const items = group.messages
      .slice(0, 5)
      .map(
        (m) =>
          `<li data-id="${m.id}"><em>${escapeHtml((m.source && m.source.title) || '')}</em>: ${escapeHtml(
            (m.translatedText || '').slice(0, 120)
          )}${m.link ? ` <a href="${m.link}" target="_blank" rel="noreferrer">open</a>` : ''}</li>`
      )
      .join('');
    marker.bindPopup(
      `<div class="popup"><strong>${escapeHtml(group.name)}</strong>` +
        `<div class="popup-count">${group.messages.length} update(s)</div><ul>${items}</ul></div>`
    );
    marker.on('popupopen', () => {
      document.querySelectorAll('.popup li').forEach((li) => {
        li.addEventListener('click', () => {
          const match = messages.find((mm) => mm.id === li.dataset.id);
          if (match) selectMessage(match);
        });
      });
    });
    mapMarkers.set(key, marker);
  });
}

function setStatus(connected) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = connected ? '● Live' : '○ Disconnected';
  statusEl.className = 'status ' + (connected ? 'online' : 'offline');
}

socket.on('connect', () => setStatus(true));
socket.on('disconnect', () => setStatus(false));

socket.on('bootstrap', (list) => {
  if (!messages.length) {
    messages = list;
    renderAll();
  }
});

socket.on('message', (msg) => {
  messages = [msg, ...messages].slice(0, 500);
  renderAll();
});

socket.on('messageUpdate', (msg) => {
  const idx = messages.findIndex((m) => m.id === msg.id);
  if (idx === -1) messages = [msg, ...messages];
  else messages[idx] = msg;
  renderAll();
});

loadInitial();
