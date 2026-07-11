import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Vite doesn't resolve Leaflet's default marker image paths automatically.
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function FlyToHandler({ flyTo }) {
  const map = useMap();
  useEffect(() => {
    if (flyTo) {
      map.flyTo([flyTo.lat, flyTo.lon], Math.max(map.getZoom(), 8), { duration: 1 });
    }
  }, [flyTo, map]);
  return null;
}

export default function MapView({ messages, flyTo, onSelect }) {
  const groups = useMemo(() => {
    const map = new Map();
    for (const msg of messages) {
      for (const loc of msg.locations || []) {
        const key = `${loc.lat.toFixed(2)},${loc.lon.toFixed(2)}`;
        if (!map.has(key)) {
          map.set(key, { lat: loc.lat, lon: loc.lon, name: loc.name, messages: [] });
        }
        map.get(key).messages.push(msg);
      }
    }
    return Array.from(map.values());
  }, [messages]);

  return (
    <div className="map-container">
      <MapContainer center={[33.5, 44]} zoom={5} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FlyToHandler flyTo={flyTo} />
        {groups.map((group) => (
          <Marker key={`${group.lat},${group.lon}`} position={[group.lat, group.lon]}>
            <Popup maxWidth={280}>
              <div className="popup">
                <strong>{group.name}</strong>
                <div className="popup-count">{group.messages.length} update(s)</div>
                <ul>
                  {group.messages.slice(0, 5).map((m) => (
                    <li key={m.id} onClick={() => onSelect(m)}>
                      <em>{m.source && m.source.title}</em>: {(m.translatedText || '').slice(0, 120)}
                      {m.link && (
                        <>
                          {' '}
                          <a href={m.link} target="_blank" rel="noreferrer">
                            open
                          </a>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
