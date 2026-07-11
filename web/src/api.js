export async function fetchRecentMessages(limit = 300) {
  const res = await fetch(`/api/messages?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to load messages');
  return res.json();
}

export async function fetchSources() {
  const res = await fetch('/api/sources');
  if (!res.ok) throw new Error('Failed to load sources');
  return res.json();
}
