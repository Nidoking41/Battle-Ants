// Sprite configuration for ant animations
// This file defines which sprites to load for each ant type

export const SpriteConfig = {
  // Sprite dimensions (all sprites should be this size)
  SPRITE_SIZE: 32,

  // Animation frame rates (milliseconds per frame)
  ANIMATION_SPEEDS: {
    idle: 300,    // 300ms per frame (slower, more relaxed)
    walk: 180,    // 180ms per frame
    attack: 120,  // 120ms per frame (quick attack)
    death: 180    // 180ms per frame
  },

  // Sprite sheet definitions for each ant type
  // Path is relative to public/sprites/ants/
  SPRITES: {
    queen: {
      idle: { path: 'queen_idle.png', frames: 8 },
      walk: { path: 'queen_walk.png', frames: 8 },
      attack: { path: 'queen_attack.png', frames: 8 }
    },
    scout: {
      idle: { path: 'scout_idle.png', frames: 8 },
      walk: { path: 'scout_walk.png', frames: 8 },
      attack: { path: 'scout_attack.png', frames: 8 }
    },
    soldier: {
      idle: { path: 'soldier_idle.png', frames: 8 },
      walk: { path: 'soldier_walk.png', frames: 8 },
      attack: { path: 'soldier_attack.png', frames: 8 }
    },
    tank: {
      idle: { path: 'tank_idle.png', frames: 8 },
      walk: { path: 'tank_walk.png', frames: 8 },
      attack: { path: 'tank_attack.png', frames: 8 }
    },
    spitter: {
      idle: { path: 'spitter_idle.png', frames: 8 },
      walk: { path: 'spitter_walk.png', frames: 8 },
      attack: { path: 'spitter_attack.png', frames: 8 }
    },
    bomber: {
      idle: { path: 'bomber_idle.png', frames: 10 },
      walk: { path: 'bomber_walk.png', frames: 10 },
      attack: { path: 'bomber_attack.png', frames: 10 }
    },
    bombardier: {
      idle: { path: 'bombardier_idle.png', frames: 8 },
      walk: { path: 'bombardier_walk.png', frames: 8 },
      attack: { path: 'bombardier_attack.png', frames: 8 }
    },
    drone: {
      idle: { path: 'drone_idle.png', frames: 8 },
      walk: { path: 'drone_walk.png', frames: 8 },
      attack: { path: 'drone_attack.png', frames: 8 }
    },
    healer: {
      idle: { path: 'healer_idle.png', frames: 8 },
      walk: { path: 'healer_walk.png', frames: 8 },
      attack: { path: 'healer_attack.png', frames: 8 }
    }
  }
};

// Helper function to get sprite info for an ant
export function getSpriteInfo(antType, animation) {
  const sprites = SpriteConfig.SPRITES[antType];
  if (!sprites || !sprites[animation]) {
    return null;
  }
  return {
    ...sprites[animation],
    fullPath: `${process.env.PUBLIC_URL}/sprites/ants/${sprites[animation].path}`,
    frameWidth: SpriteConfig.SPRITE_SIZE,
    frameHeight: SpriteConfig.SPRITE_SIZE,
    animationSpeed: SpriteConfig.ANIMATION_SPEEDS[animation] || 100
  };
}
