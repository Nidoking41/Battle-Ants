// Drawn attack effects: the Spitter's acid glob and splash, the Bombardier's
// lobbed shell and blast, and the Exploding ant's mushroom cloud. Each takes
// a progress value from 0 to 1 and returns SVG, so App can drive them all from
// one timer. Shapes are kept chunky (no gradients, hard colour steps) so they
// sit with the pixel art.

import React from 'react';

const ACID = ['#1f5a10', '#3f9a18', '#7fd82a', '#c8ff5a', '#f4ffc0'];
const FIRE = ['#5a1a08', '#a83214', '#f06418', '#ffb428', '#fff0a0'];
const SMOKE = ['#2a2420', '#4a403a', '#6e625a', '#9a8e84'];

// How long each impact effect lasts (ms)
export const EFFECT_DURATION = { acid: 650, blast: 800, mushroom: 1700 };
// How long a projectile is in the air (ms)
export const FLIGHT_TIME = { spitter: 320, bombardier: 450, default: 300 };

const lerp = (a, b, t) => a + (b - a) * t;

// Position along a lobbed arc: straight line plus a parabola of height `peak`
function arcPoint(start, end, t, peak) {
  return { x: lerp(start.x, end.x, t), y: lerp(start.y, end.y, t) - peak * 4 * t * (1 - t) };
}

// Same pseudo-random numbers every frame for a given effect id
function seeded(id, i) {
  let h = 0;
  const s = `${id}:${i}`;
  for (let k = 0; k < s.length; k++) h = (h * 31 + s.charCodeAt(k)) | 0;
  return ((h >>> 0) % 1000) / 1000;
}

/** A glob of acid in flight, with drips trailing behind it. */
export function AcidGlob({ start, end, t }) {
  const peak = 22;
  const head = arcPoint(start, end, t, peak);
  const trail = [0.07, 0.14, 0.21].map(d => arcPoint(start, end, Math.max(0, t - d), peak));
  return (
    <g style={{ pointerEvents: 'none' }}>
      {trail.map((p, i) => (
        <rect key={i} x={p.x - (4 - i)} y={p.y - (4 - i)} width={(4 - i) * 2} height={(4 - i) * 2}
          fill={ACID[2 - Math.min(i, 1)]} opacity={0.8 - i * 0.2} />
      ))}
      <g transform={`translate(${head.x}, ${head.y}) scale(1.6)`}>
        <rect x={-6} y={-5} width={12} height={10} fill={ACID[0]} />
        <rect x={-5} y={-6} width={10} height={12} fill={ACID[0]} />
        <rect x={-4} y={-4} width={8} height={8} fill={ACID[2]} />
        <rect x={-4} y={-4} width={4} height={3} fill={ACID[3]} />
        <rect x={-3} y={-3} width={2} height={2} fill={ACID[4]} />
        {/* A drip hanging off the back of the glob */}
        <rect x={end.x > start.x ? -8 : 6} y={0} width={2} height={3} fill={ACID[1]} />
      </g>
    </g>
  );
}

/** Acid hitting the target: a splat, flying droplets and fizzing bubbles. */
export function AcidSplash({ id, at, p }) {
  const fade = 1 - Math.max(0, (p - 0.6) / 0.4);
  const splat = Math.min(1, p / 0.15);
  const drops = Array.from({ length: 8 }, (_, i) => {
    const ang = (i / 8) * Math.PI * 2 + seeded(id, i);
    const dist = 10 + 18 * Math.min(1, p / 0.5) * (0.6 + seeded(id, i + 10) * 0.6);
    return { x: Math.cos(ang) * dist, y: Math.sin(ang) * dist * 0.6 - 10 * Math.sin(Math.min(1, p / 0.5) * Math.PI) };
  });
  return (
    <g transform={`translate(${at.x}, ${at.y})`} style={{ pointerEvents: 'none' }} opacity={fade}>
      <ellipse cx={0} cy={6} rx={16 * splat} ry={7 * splat} fill={ACID[1]} />
      <ellipse cx={-2} cy={5} rx={10 * splat} ry={4 * splat} fill={ACID[2]} />
      <ellipse cx={-4} cy={4} rx={4 * splat} ry={2 * splat} fill={ACID[3]} />
      {drops.map((d, i) => (
        <rect key={i} x={d.x - 2} y={d.y - 2} width={4} height={4} fill={i % 2 ? ACID[2] : ACID[3]} />
      ))}
      {/* Fizzing bubbles rising off the splat */}
      {[0, 1, 2, 3].map(i => {
        const bp = (p * 2 + seeded(id, i + 20)) % 1;
        return (
          <rect key={`b${i}`} x={-10 + i * 6 + seeded(id, i + 30) * 4} y={4 - bp * 22} width={4} height={4}
            fill={ACID[3]} opacity={1 - bp} />
        );
      })}
    </g>
  );
}

/** A Bombardier shell lobbed high, with a sparking fuse and a ground shadow. */
export function Shell({ start, end, t }) {
  const peak = 70;
  const p = arcPoint(start, end, t, peak);
  const ground = { x: lerp(start.x, end.x, t), y: lerp(start.y, end.y, t) };
  const spark = Math.floor(t * 20) % 2;
  return (
    <g style={{ pointerEvents: 'none' }}>
      <ellipse cx={ground.x} cy={ground.y + 8} rx={7 * (0.6 + t * 0.4)} ry={3} fill="#000" opacity={0.3} />
      <g transform={`translate(${p.x}, ${p.y}) scale(1.5)`}>
        <rect x={-6} y={-5} width={12} height={10} fill="#140c08" />
        <rect x={-5} y={-6} width={10} height={12} fill="#140c08" />
        <rect x={-4} y={-4} width={8} height={8} fill="#3a2e28" />
        <rect x={-3} y={-3} width={3} height={2} fill="#7a6a5e" />
        <rect x={2} y={-9} width={2} height={4} fill="#5a3a20" />
        <rect x={1 + spark} y={-12} width={3} height={3} fill={spark ? FIRE[4] : FIRE[3]} />
      </g>
    </g>
  );
}

/** The Bombardier shell landing: flash, fireball, flying dirt and smoke. */
export function Blast({ id, at, p }) {
  const grow = Math.min(1, p / 0.25);
  const fireFade = 1 - Math.min(1, Math.max(0, (p - 0.25) / 0.35));
  const smoke = Math.max(0, (p - 0.2) / 0.8);
  return (
    <g transform={`translate(${at.x}, ${at.y})`} style={{ pointerEvents: 'none' }}>
      {/* Ground shockwave */}
      <ellipse cx={0} cy={8} rx={10 + p * 50} ry={4 + p * 18} fill="none" stroke={FIRE[3]}
        strokeWidth={4 * (1 - p)} opacity={1 - p} />
      {/* Smoke rising after the fire */}
      {[0, 1, 2, 3, 4].map(i => (
        <circle key={`s${i}`} cx={(seeded(id, i) - 0.5) * 30} cy={-smoke * 40 - i * 4}
          r={6 + smoke * 10} fill={SMOKE[i % 3 + 1]} opacity={smoke > 0 ? 0.7 * (1 - smoke) : 0} />
      ))}
      {/* Fireball */}
      <g opacity={fireFade}>
        <circle cx={0} cy={-4} r={30 * grow} fill={FIRE[1]} />
        <circle cx={-3} cy={-7} r={22 * grow} fill={FIRE[2]} />
        <circle cx={-5} cy={-9} r={13 * grow} fill={FIRE[3]} />
        <circle cx={-6} cy={-10} r={6 * grow} fill={FIRE[4]} />
      </g>
      {/* Clods of dirt thrown out */}
      {Array.from({ length: 8 }, (_, i) => {
        const ang = (i / 8) * Math.PI * 2 + seeded(id, i + 5);
        const d = 10 + p * 45 * (0.6 + seeded(id, i + 15) * 0.5);
        return (
          <rect key={`d${i}`} x={Math.cos(ang) * d - 2} y={Math.sin(ang) * d * 0.6 - 30 * Math.sin(p * Math.PI) - 2}
            width={4} height={4} fill={i % 2 ? '#5a3a20' : '#7a5230'} opacity={1 - p} />
        );
      })}
      {/* White flash */}
      {p < 0.12 && <circle cx={0} cy={-4} r={40} fill="#fff" opacity={0.8 * (1 - p / 0.12)} />}
    </g>
  );
}

/** The Exploding ant going off: flash, shockwaves along the ground and a mushroom cloud. */
export function MushroomCloud({ id, at, p, hexSize }) {
  const rise = Math.min(1, p / 0.55);            // the cloud climbs, then hangs
  const fade = 1 - Math.max(0, (p - 0.65) / 0.35);
  const capY = -20 - rise * 70;
  const capR = 14 + rise * 18;
  const hot = Math.max(0, 1 - p / 0.45);         // fire colours cool into smoke
  const tone = (fire, smoke) => (hot > 0.5 ? fire : hot > 0.15 ? FIRE[1] : smoke);
  return (
    <g transform={`translate(${at.x}, ${at.y})`} style={{ pointerEvents: 'none' }}>
      {/* Shockwaves rolling out across the ground */}
      {[0, 0.12, 0.24].map((delay, i) => {
        const w = Math.max(0, Math.min(1, (p - delay) / 0.6));
        return w > 0 && w < 1 ? (
          <ellipse key={`w${i}`} cx={0} cy={6} rx={w * hexSize * (2.6 - i * 0.4)} ry={w * hexSize * (1.2 - i * 0.2)}
            fill="none" stroke={i === 0 ? '#fff4c0' : FIRE[3]} strokeWidth={6 * (1 - w)} opacity={1 - w} />
        ) : null;
      })}
      <g opacity={fade}>
        {/* Base: a ring of dust where the stem meets the ground */}
        <ellipse cx={0} cy={4} rx={18 + rise * 22} ry={6 + rise * 6} fill={tone(FIRE[2], SMOKE[2])} />
        {/* Stem */}
        <rect x={-6 - rise * 2} y={capY} width={12 + rise * 4} height={-capY + 4} fill={tone(FIRE[2], SMOKE[1])} />
        <rect x={-3} y={capY} width={4} height={-capY} fill={tone(FIRE[3], SMOKE[2])} />
        {/* A ring around the stem, part way up */}
        <ellipse cx={0} cy={capY * 0.5} rx={10 + rise * 6} ry={4} fill={tone(FIRE[2], SMOKE[2])} />
        {/* Cap: billowing puffs */}
        {[-1, -0.5, 0, 0.5, 1].map((k, i) => (
          <circle key={`c${i}`} cx={k * capR * 0.9} cy={capY + Math.abs(k) * 6 + (seeded(id, i) - 0.5) * 4}
            r={capR * (0.55 + (1 - Math.abs(k)) * 0.25)} fill={tone(FIRE[1], SMOKE[1])} />
        ))}
        {[-0.5, 0, 0.5].map((k, i) => (
          <circle key={`h${i}`} cx={k * capR * 0.8 - 2} cy={capY - capR * 0.25} r={capR * 0.45}
            fill={tone(FIRE[3], SMOKE[3])} />
        ))}
        {hot > 0.3 && <circle cx={-4} cy={capY - capR * 0.3} r={capR * 0.25} fill={FIRE[4]} />}
      </g>
      {/* Blinding flash at the start */}
      {p < 0.1 && <circle cx={0} cy={-10} r={hexSize * 1.4} fill="#fff" opacity={0.9 * (1 - p / 0.1)} />}
    </g>
  );
}
