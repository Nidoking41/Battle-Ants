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
      idle: { path: 'scout_idle_green.png', frames: 8 },
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

// Map hex color codes to sprite color suffixes
const COLOR_MAP = {
  '#FF0000': 'red',
  '#0000FF': 'blue',
  '#00FF00': 'green',
  '#FFFF00': 'yellow'
};

// Ant types that have colored sprite variants
const COLORED_ANT_TYPES = ['queen', 'scout', 'drone', 'soldier', 'tank', 'spitter', 'healer'];

// Map ant type IDs to their sprite file prefixes
const ANT_TYPE_TO_SPRITE_PREFIX = {
  'queen': 'queen',
  'scout': 'scout',
  'drone': 'drone',
  'soldier': 'marauder',
  'tank': 'bullet',
  'spitter': 'acid',
  'healer': 'weaver'
};

// Helper function to get sprite info for an ant
// playerColor: optional hex color code (e.g., '#FF0000')
export function getSpriteInfo(antType, animation, playerColor = null) {
  const sprites = SpriteConfig.SPRITES[antType];
  if (!sprites || !sprites[animation]) {
    return null;
  }

  let spritePath = sprites[animation].path;

  // If playerColor is provided and this ant type has colored variants
  if (playerColor && COLORED_ANT_TYPES.includes(antType) && animation === 'idle') {
    const colorSuffix = COLOR_MAP[playerColor];
    if (colorSuffix) {
      // Get the sprite prefix (some ant types have different sprite filenames)
      const spritePrefix = ANT_TYPE_TO_SPRITE_PREFIX[antType] || antType;
      // Replace the sprite path with the colored version
      // e.g., queen_idle.png -> queen_idle_red.png
      // or soldier -> marauder_idle_red.png
      spritePath = `${spritePrefix}_idle_${colorSuffix}.png`;
    }
  }

  return {
    ...sprites[animation],
    path: spritePath,
    fullPath: `${process.env.PUBLIC_URL}/sprites/ants/${spritePath}`,
    frameWidth: SpriteConfig.SPRITE_SIZE,
    frameHeight: SpriteConfig.SPRITE_SIZE,
    animationSpeed: SpriteConfig.ANIMATION_SPEEDS[animation] || 100
  };
}
