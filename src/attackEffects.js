// Pixel-art attack effects: the Spitter's acid glob and splash, the
// Bombardier's lobbed shell and blast, the Exploding ant's mushroom cloud
// and shockwaves, and the mandible bite every melee unit uses. Each one plays frames from a sprite sheet in
// public/sprites/effects (frames side by side), shown at 2x like the ants.
// Each takes a progress value from 0 to 1, so App can drive them all from one
// timer.

import React from 'react';

const SCALE = 2;

// Sprite sheets: frame size in art pixels and number of frames
const SHEETS = {
  acid_glob: { w: 14, h: 12, frames: 2 },
  acid_splash: { w: 32, h: 24, frames: 6 },
  shell: { w: 12, h: 14, frames: 2 },
  blast: { w: 48, h: 44, frames: 7 },
  mushroom: { w: 48, h: 64, frames: 10 },
  shockwave: { w: 128, h: 48, frames: 6 },
  // one sheet per player colour: bite_red, bite_green, bite_blue, bite_yellow, bite_black
  bite_red: { w: 36, h: 32, frames: 7 },
  bite_green: { w: 36, h: 32, frames: 7 },
  bite_blue: { w: 36, h: 32, frames: 7 },
  bite_yellow: { w: 36, h: 32, frames: 7 },
  bite_black: { w: 36, h: 32, frames: 7 }
};

// Attack timings (ms). Everything here plays at 1.5x its original length, and
// the Exploding ant's blast at 2x.
export const ATTACK_TIMING = {
  windUp: 300,     // a ranged unit's shake before its shot leaves
  lunge: 450,      // a melee unit's lunge
  meleeHit: 600,   // when a melee blow's damage lands
  rangedHit: 750,  // when a ranged shot's damage lands
  spikes: 1350,    // a burrowed Marauder's spikes
  shakeLight: 450, // screen shake from a Bombardier shell
  shakeStrong: 1200 // screen shake from an Exploding ant
};
// How long each impact effect lasts. The bite snaps shut about 510ms in.
export const EFFECT_DURATION = { acid: 750, blast: 1050, mushroom: 3400, bite: 900 };
// How long a projectile is in the air
export const FLIGHT_TIME = { spitter: 480, bombardier: 600, default: 450 };

// Bite size by the damage it deals: Skrazzit's un-upgraded Drone (3) is the
// smallest, Thorgrim's fully upgraded Bullet Ant (35) is huge.
const BITE_DAMAGE = { min: 3, max: 35 };
const BITE_SCALE = { min: 0.6, max: 2.6 };
export function biteScale(damage) {
  const t = Math.max(0, Math.min(1, ((damage || 0) - BITE_DAMAGE.min) / (BITE_DAMAGE.max - BITE_DAMAGE.min)));
  return BITE_SCALE.min + t * (BITE_SCALE.max - BITE_SCALE.min);
}

const lerp = (a, b, t) => a + (b - a) * t;

// Position along a lobbed arc: straight line plus a parabola of height `peak`
function arcPoint(start, end, t, peak) {
  return { x: lerp(start.x, end.x, t), y: lerp(start.y, end.y, t) - peak * 4 * t * (1 - t) };
}

const frameAt = (name, p) => Math.min(SHEETS[name].frames - 1, Math.floor(p * SHEETS[name].frames));

/**
 * One frame of a sprite sheet. (ax, ay) is the art pixel that lands on (x, y);
 * flip mirrors it left to right around that point.
 */
function Frame({ name, frame, x, y, ax, ay, flip = false, opacity = 1 }) {
  const { w, h, frames } = SHEETS[name];
  return (
    <g transform={`translate(${x}, ${y})${flip ? ' scale(-1, 1)' : ''}`} opacity={opacity} style={{ pointerEvents: 'none' }}>
      <svg x={-ax * SCALE} y={-ay * SCALE} width={w * SCALE} height={h * SCALE} viewBox={`${frame * w} 0 ${w} ${h}`} overflow="hidden">
        <image
          href={`${process.env.PUBLIC_URL}/sprites/effects/${name}.png`}
          width={w * frames}
          height={h}
          style={{ imageRendering: 'pixelated' }}
        />
      </svg>
    </g>
  );
}

/** A glob of acid in flight, wobbling as it goes. */
export function AcidGlob({ start, end, t }) {
  const head = arcPoint(start, end, t, 22);
  return <Frame name="acid_glob" frame={Math.floor(t * 8) % 2} x={head.x} y={head.y} ax={8} ay={6} flip={end.x < start.x} />;
}

/** Acid hitting the target: a splat, droplets and fizzing bubbles. */
export function AcidSplash({ at, p }) {
  return <Frame name="acid_splash" frame={frameAt('acid_splash', p)} x={at.x} y={at.y + 6} ax={16} ay={17} />;
}

/** A Bombardier shell lobbed high, with a sparking fuse. */
export function Shell({ start, end, t }) {
  const p = arcPoint(start, end, t, 70);
  return <Frame name="shell" frame={Math.floor(t * 12) % 2} x={p.x} y={p.y} ax={6} ay={8} flip={end.x < start.x} />;
}

/** The Bombardier shell landing: fireball, flying dirt, then smoke. */
export function Blast({ at, p }) {
  return <Frame name="blast" frame={frameAt('blast', p)} x={at.x} y={at.y + 4} ax={24} ay={30} />;
}

/** The Exploding ant going off: shockwaves rolling out and a mushroom cloud. */
export function MushroomCloud({ at, p }) {
  const wave = p / 0.5; // the shockwaves play in the first half
  return (
    <g style={{ pointerEvents: 'none' }}>
      {wave < 1 && <Frame name="shockwave" frame={frameAt('shockwave', wave)} x={at.x} y={at.y + 8} ax={64} ay={24} />}
      <Frame name="mushroom" frame={frameAt('mushroom', p)} x={at.x} y={at.y + 10} ax={24} ay={58} />
    </g>
  );
}

/**
 * Two mandibles open wide, then snap shut on the target, in the attacker's
 * colour ('red', 'green', 'blue', 'yellow' or 'black'). Always drawn side-on:
 * the jaws reach back toward whichever side the attacker (`from`) is on and
 * meet on the target (`at`). `scale` comes from biteScale.
 */
export function Bite({ at, from, p, scale = 1, color = 'red' }) {
  const name = SHEETS[`bite_${color}`] ? `bite_${color}` : 'bite_red';
  const flip = from.x > at.x;
  return (
    <g transform={`translate(${at.x}, ${at.y}) scale(${flip ? -scale : scale}, ${scale})`} style={{ pointerEvents: 'none' }}>
      <Frame name={name} frame={frameAt(name, p)} x={0} y={0} ax={25} ay={16} />
    </g>
  );
}
