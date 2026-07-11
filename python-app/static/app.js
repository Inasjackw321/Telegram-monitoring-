const socket = io();

const AVATAR_PALETTE = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#6366f1'];

let messages = [];
let sources = [];
let activeSources = new Set();
let lastArrivedId = null;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function colorForSource(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

function initialsForSource(name) {
  const clean = (name || '?').replace(/[^a-zA-Z0-9]/g, '');
  return (clean.slice(0, 2) || name.slice(0, 2) || '?').toUpperCase();
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
  renderFeed();
}

function renderSourceFilter() {
  const container = document.getElementById('source-filter');
  container.innerHTML = '';
  sources.forEach((s) => {
    const label = el('label', activeSources.has(s.username) ? 'on' : 'off');
    const dot = el('span', 'source-dot');
    dot.style.background = colorForSource(s.username);
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = activeSources.has(s.username);
    input.addEventListener('change', () => {
      if (activeSources.has(s.username)) activeSources.delete(s.username);
      else activeSources.add(s.username);
      renderSourceFilter();
      renderFeed();
    });
    label.appendChild(input);
    label.appendChild(dot);
    label.appendChild(document.createTextNode(s.username));
    container.appendChild(label);
  });
}

function visibleMessages() {
  return messages.filter((m) => !m.source || !m.source.username || activeSources.has(m.source.username));
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
  const isNew = m.id === lastArrivedId;
  const item = el('div', 'timeline-item' + (isNew ? ' new' : ''));

  const rail = el('div', 'timeline-rail');
  rail.appendChild(el('span', 'timeline-dot'));
  item.appendChild(rail);

  const body = el('div', 'timeline-body');
  body.appendChild(renderCard(m, d));
  item.appendChild(body);

  return item;
}

function renderCard(m, d) {
  const card = el('div', 'message-card');
  const sourceTitle = (m.source && m.source.title) || 'Unknown';

  const meta = el('div', 'message-meta');
  const identity = el('div', 'message-identity');
  const avatar = el('span', 'avatar', initialsForSource(sourceTitle));
  avatar.style.background = colorForSource(sourceTitle);
  identity.appendChild(avatar);
  identity.appendChild(el('span', 'source', sourceTitle));
  meta.appendChild(identity);
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
    btn.addEventListener('click', () => {
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
    actions.appendChild(a);
  }
  card.appendChild(actions);

  return card;
}

function setStatus(connected) {
  const statusEl = document.getElementById('status');
  statusEl.innerHTML = '';
  statusEl.appendChild(el('span', 'status-dot'));
  statusEl.appendChild(document.createTextNode(connected ? 'Live' : 'Disconnected'));
  statusEl.className = 'status ' + (connected ? 'online' : 'offline');
}

socket.on('connect', () => setStatus(true));
socket.on('disconnect', () => setStatus(false));

socket.on('bootstrap', (list) => {
  if (!messages.length) {
    messages = list;
    renderFeed();
  }
});

socket.on('message', (msg) => {
  messages = [msg, ...messages].slice(0, 500);
  lastArrivedId = msg.id;
  renderFeed();
});

socket.on('messageUpdate', (msg) => {
  const idx = messages.findIndex((m) => m.id === msg.id);
  if (idx === -1) messages = [msg, ...messages];
  else messages[idx] = msg;
  renderFeed();
});

loadInitial();
