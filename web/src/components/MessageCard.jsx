import React, { useState } from 'react';

export default function MessageCard({ message, selected, onSelect }) {
  const [showOriginal, setShowOriginal] = useState(false);
  const hasTranslation = message.originalText && message.originalText !== message.translatedText;
  const text = showOriginal ? message.originalText : message.translatedText;

  return (
    <div className={`message-card ${selected ? 'selected' : ''}`} onClick={onSelect}>
      <div className="message-meta">
        <span className="source">{(message.source && message.source.title) || 'Unknown'}</span>
        <time>{new Date(message.date).toLocaleString()}</time>
      </div>

      {message.media && message.media.type === 'photo' && (
        <img className="media" src={message.media.url} loading="lazy" alt="" />
      )}
      {message.media && message.media.type === 'video' && (
        <video className="media" src={message.media.url} controls preload="metadata" />
      )}

      {text && <p className="message-text">{text}</p>}

      {message.locations && message.locations.length > 0 && (
        <div className="locations">📍 {message.locations.map((l) => l.name).join(', ')}</div>
      )}

      <div className="message-actions">
        {hasTranslation && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowOriginal((v) => !v);
            }}
          >
            {showOriginal ? 'Show translation' : 'Show original'}
          </button>
        )}
        {message.link && (
          <a href={message.link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
            Open in Telegram
          </a>
        )}
      </div>
    </div>
  );
}
