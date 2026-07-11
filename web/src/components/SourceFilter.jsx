import React from 'react';

export default function SourceFilter({ sources, active, onToggle }) {
  if (!sources.length) return null;
  return (
    <div className="source-filter">
      {sources.map((s) => (
        <label key={s.username} className={active.has(s.username) ? 'on' : 'off'}>
          <input type="checkbox" checked={active.has(s.username)} onChange={() => onToggle(s.username)} />
          {s.username}
        </label>
      ))}
    </div>
  );
}
