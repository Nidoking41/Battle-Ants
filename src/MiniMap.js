import React from 'react';
import { hexToPixel } from './hexUtils';

// Mini map (bottom of the left panel): the outline of every hex on the board,
// your units as green dots and enemy units as red dots. Fog of war applies:
// hexes you cannot see are dark, and enemies in the fog are not shown (the
// caller passes the fog-filtered ants). The white box is what the main view
// shows; click or drag on the mini map to move the camera there.

const HEX = 50; // the board's hex size (App.js hexSize)
const CORNERS = [[1, 0], [0.5, -0.866], [-0.5, -0.866], [-1, 0], [-0.5, 0.866], [0.5, 0.866]];
const outline = (x, y, s) => CORNERS.map(([cx, cy]) => `${(x + cx * s).toFixed(1)},${(y + cy * s).toFixed(1)}`).join(' ');

export default function MiniMap({ hexes, water = [], visibleHexes, ants, myPlayerId, teammates, view, onJump, width = 184 }) {
  const all = [...hexes, ...water];
  if (all.length === 0) return null;
  const pts = all.map(h => hexToPixel(h, HEX));
  const minX = Math.min(...pts.map(p => p.x)) - HEX;
  const maxX = Math.max(...pts.map(p => p.x)) + HEX;
  const minY = Math.min(...pts.map(p => p.y)) - HEX;
  const maxY = Math.max(...pts.map(p => p.y)) + HEX;
  const w = maxX - minX;
  const h = maxY - minY;
  // Tall maps would take over the panel: cap the height, keep the shape
  const height = Math.min(width * (h / w), 200);
  const isMine = owner => owner === myPlayerId || (teammates && teammates.has(owner));
  const seen = hex => !visibleHexes || visibleHexes.has(`${hex.q},${hex.r}`);

  const jumpTo = (e) => {
    if (!onJump) return;
    const box = e.currentTarget.getBoundingClientRect();
    // the SVG keeps its aspect ratio (xMidYMid meet): work out the drawn area
    const scale = Math.min(box.width / w, box.height / h);
    const offX = (box.width - w * scale) / 2;
    const offY = (box.height - h * scale) / 2;
    const px = e.touches ? e.touches[0].clientX : e.clientX;
    const py = e.touches ? e.touches[0].clientY : e.clientY;
    onJump({ x: minX + (px - box.left - offX) / scale, y: minY + (py - box.top - offY) / scale });
  };

  return (
    <svg
      className="minimap"
      width={width}
      height={height}
      viewBox={`${minX} ${minY} ${w} ${h}`}
      style={{ display: 'block', background: '#0d0d0d', border: '2px solid #444', borderRadius: '6px', cursor: 'pointer', touchAction: 'none' }}
      onMouseDown={e => { e.preventDefault(); jumpTo(e); }}
      onMouseMove={e => { if (e.buttons === 1) jumpTo(e); }}
      onTouchStart={jumpTo}
      onTouchMove={jumpTo}
    >
      {water.map(hex => {
        const { x, y } = hexToPixel(hex, HEX);
        return <polygon key={`w${hex.q},${hex.r}`} points={outline(x, y, HEX - 2)} fill="#24507a" />;
      })}
      {hexes.map(hex => {
        const { x, y } = hexToPixel(hex, HEX);
        return (
          <polygon
            key={`${hex.q},${hex.r}`}
            points={outline(x, y, HEX - 2)}
            fill={seen(hex) ? '#4e5a3c' : '#1e1e1e'}
            stroke={seen(hex) ? '#7a8a60' : '#3a3a3a'}
            strokeWidth="6"
          />
        );
      })}
      {Object.values(ants || {}).map(ant => {
        if (!ant?.position) return null;
        const { x, y } = hexToPixel(ant.position, HEX);
        const mine = isMine(ant.owner);
        return <circle key={ant.id} cx={x} cy={y} r={HEX * 0.55} fill={mine ? '#3cff5a' : '#ff3434'} stroke="#000" strokeWidth="6" />;
      })}
      {view && (
        <rect x={view.x} y={view.y} width={view.width} height={view.height}
          fill="none" stroke="#fff" strokeWidth={Math.max(8, w / 120)} opacity="0.85" pointerEvents="none" />
      )}
    </svg>
  );
}
