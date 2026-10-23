import React, { useMemo } from 'react';
import { getMapsForSize } from './scrimmageMaps';
import { parseLayout } from '../campaign/mapLayout';
import { getMapWaterHexes, HexCoord } from '../hexUtils';

// Map choice for the Scrimmage setup screens: one small picture per map for
// the chosen size, and the picked map's description underneath.

const SQRT3 = Math.sqrt(3);
const GRID_RADIUS = { small: 4, medium: 5, large: 6 };

// Everything a thumbnail draws, as { land, water, food, minerals, trees, cliffs, queens }
function thumbData(map) {
  if (map.layout) {
    const l = parseLayout(map.layout);
    const at = type => l.resources.filter(r => r.type === type).map(r => r.position);
    return {
      land: l.mapHexes,
      water: l.water,
      food: at('food'),
      minerals: at('minerals'),
      trees: l.trees,
      cliffs: Object.keys(l.mapShape.cliffs || {}).map(k => { const [q, r] = k.split(',').map(Number); return { q, r }; }),
      queens: [l.leaders.player1, l.leaders.player2].filter(Boolean)
    };
  }
  // Classic: the hexagon with its lake (small) or river (medium, large)
  const radius = GRID_RADIUS[map.size] || 6;
  const water = getMapWaterHexes(radius, radius <= 4 ? 'lake' : 'river');
  const wet = new Set(water.map(w => `${w.q},${w.r}`));
  const land = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      if (Math.abs(q + r) <= radius && !wet.has(`${q},${r}`)) land.push(new HexCoord(q, r));
    }
  }
  return { land, water, food: [], minerals: [], trees: [], cliffs: [], queens: [new HexCoord(0, radius - 1), new HexCoord(0, -(radius - 1))] };
}

function MapThumb({ map, size = 84 }) {
  const data = useMemo(() => thumbData(map), [map]);
  const all = [...data.land, ...data.water];
  const pts = all.map(h => ({ x: 1.5 * h.q, y: SQRT3 * (h.r + h.q / 2) }));
  const minX = Math.min(...pts.map(p => p.x)) - 1, maxX = Math.max(...pts.map(p => p.x)) + 1;
  const minY = Math.min(...pts.map(p => p.y)) - 1, maxY = Math.max(...pts.map(p => p.y)) + 1;
  const key = h => `${h.q},${h.r}`;
  const sets = {
    food: new Set(data.food.map(key)),
    minerals: new Set(data.minerals.map(key)),
    trees: new Set(data.trees.map(key)),
    cliffs: new Set(data.cliffs.map(key)),
    queens: new Set(data.queens.map(key))
  };
  const colorOf = h => {
    const k = key(h);
    if (sets.queens.has(k)) return '#f2f2f2';
    if (sets.food.has(k)) return '#d9583f';
    if (sets.minerals.has(k)) return '#9a9ad8';
    if (sets.trees.has(k)) return '#2f7a2f';
    if (sets.cliffs.has(k)) return '#6e5e4c';
    return '#a07c50';
  };
  const hexPoints = h => {
    const cx = 1.5 * h.q, cy = SQRT3 * (h.r + h.q / 2);
    return [0, 1, 2, 3, 4, 5].map(i => `${cx + Math.cos(Math.PI / 3 * i)},${cy + Math.sin(Math.PI / 3 * i)}`).join(' ');
  };
  return (
    <svg width={size} height={size} viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} preserveAspectRatio="xMidYMid meet">
      {data.water.map(h => <polygon key={`w${key(h)}`} points={hexPoints(h)} fill="#3d6ea8" stroke="#24456b" strokeWidth="0.15" />)}
      {data.land.map(h => <polygon key={key(h)} points={hexPoints(h)} fill={colorOf(h)} stroke="#3a2c1c" strokeWidth="0.15" />)}
    </svg>
  );
}

export default function MapPicker({ mapSize, mapId, onSelect }) {
  const maps = getMapsForSize(mapSize);
  const selected = maps.find(m => m.id === mapId) || maps[0];
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
        {maps.map(m => (
          <button
            key={m.id}
            onClick={() => onSelect(m.id)}
            title={m.description}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2px',
              padding: '4px 2px',
              fontSize: '11px',
              fontWeight: 'bold',
              background: selected.id === m.id ? 'linear-gradient(145deg, #8a8a8a, #6a6a6a)' : 'linear-gradient(145deg, #4a4a4a, #2a2a2a)',
              color: '#e0e0e0',
              border: selected.id === m.id ? '2px solid #aaa' : '2px solid #666',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            <MapThumb map={m} size={52} />
            {m.name}
          </button>
        ))}
      </div>
      <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#cfcfcf', lineHeight: 1.35 }}>{selected.description}</p>
    </div>
  );
}
