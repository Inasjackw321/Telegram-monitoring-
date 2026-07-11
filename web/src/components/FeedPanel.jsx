import React from 'react';
import MessageCard from './MessageCard.jsx';

export default function FeedPanel({ messages, selectedId, onSelect }) {
  return (
    <aside className="feed-panel">
      <div className="feed-header">Live Feed ({messages.length})</div>
      <div className="feed-list">
        {messages.map((msg) => (
          <MessageCard key={msg.id} message={msg} selected={msg.id === selectedId} onSelect={() => onSelect(msg)} />
        ))}
        {messages.length === 0 && <div className="empty">Waiting for messages...</div>}
      </div>
    </aside>
  );
}
