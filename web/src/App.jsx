import React, { useCallback, useEffect, useMemo, useState } from 'react';
import MapView from './components/MapView.jsx';
import FeedPanel from './components/FeedPanel.jsx';
import SourceFilter from './components/SourceFilter.jsx';
import { socket } from './socket.js';
import { fetchRecentMessages, fetchSources } from './api.js';

export default function App() {
  const [messages, setMessages] = useState([]);
  const [sources, setSources] = useState([]);
  const [activeSources, setActiveSources] = useState(new Set());
  const [selectedId, setSelectedId] = useState(null);
  const [flyTo, setFlyTo] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    fetchRecentMessages(300).then(setMessages).catch(console.error);
    fetchSources()
      .then((list) => {
        setSources(list);
        setActiveSources(new Set(list.map((s) => s.username)));
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    function onMessage(msg) {
      setMessages((prev) => [msg, ...prev].slice(0, 500));
    }
    function onUpdate(msg) {
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === msg.id);
        if (idx === -1) return [msg, ...prev];
        const copy = [...prev];
        copy[idx] = msg;
        return copy;
      });
    }
    function onBootstrap(list) {
      setMessages((prev) => (prev.length ? prev : list));
    }
    function onConnect() {
      setConnected(true);
    }
    function onDisconnect() {
      setConnected(false);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('message', onMessage);
    socket.on('messageUpdate', onUpdate);
    socket.on('bootstrap', onBootstrap);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('message', onMessage);
      socket.off('messageUpdate', onUpdate);
      socket.off('bootstrap', onBootstrap);
    };
  }, []);

  const visibleMessages = useMemo(
    () => messages.filter((m) => !m.source || !m.source.username || activeSources.has(m.source.username)),
    [messages, activeSources]
  );

  const toggleSource = useCallback((username) => {
    setActiveSources((prev) => {
      const next = new Set(prev);
      if (next.has(username)) next.delete(username);
      else next.add(username);
      return next;
    });
  }, []);

  const handleSelectMessage = useCallback((msg) => {
    setSelectedId(msg.id);
    if (msg.locations && msg.locations.length) {
      setFlyTo({ lat: msg.locations[0].lat, lon: msg.locations[0].lon, key: msg.id });
    }
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Telegram Live Monitor</h1>
        <span className={`status ${connected ? 'online' : 'offline'}`}>
          {connected ? '● Live' : '○ Disconnected'}
        </span>
        <SourceFilter sources={sources} active={activeSources} onToggle={toggleSource} />
      </header>
      <main className="app-main">
        <MapView messages={visibleMessages} flyTo={flyTo} onSelect={handleSelectMessage} />
        <FeedPanel messages={visibleMessages} selectedId={selectedId} onSelect={handleSelectMessage} />
      </main>
    </div>
  );
}
