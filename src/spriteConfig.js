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

  // Sprite sheet definitions for each ant type.
  // Path is relative to public/sprites/ants/<folder>/ (see ANT_TYPE_TO_FOLDER).
  //
  // These entries describe the UNCOLORED sheets. In an actual game every ant
  // has a player color, and getSpriteInfo() below swaps in the `_idle_<color>`
  // sheet for every animation, because colored walk/attack sheets have not been
  // drawn yet. Only Drone and Bombardier have uncolored walk/attack sheets on
  // disk; the other types fall back to idle, which is why entries here point at
  // the idle sheet rather than a file that does not exist.
  SPRITES: {
    queen: {
      idle: { path: 'queen_idle_red.png', frames: 8 },
      walk: { path: 'queen_idle_red.png', frames: 8 },
      attack: { path: 'queen_idle_red.png', frames: 8 }
    },
    // Campaign Queen Larva has no sheet yet, so it renders as its emoji icon.
    // When art exists, add a queenLarva entry here (Queen/larva_idle_<color>.png,
    // 8 frames of 32px) plus 'queenLarva' in the three maps below.
    scout: {
      idle: { path: 'scout_idle_green.png', frames: 10 },
      walk: { path: 'scout_idle_green.png', frames: 10 },
      attack: { path: 'scout_idle_green.png', frames: 10 }
    },
    soldier: {
      idle: { path: 'marauder_idle_red.png', frames: 8 },
      walk: { path: 'marauder_idle_red.png', frames: 8 },
      attack: { path: 'marauder_idle_red.png', frames: 8 }
    },
    tank: {
      idle: { path: 'bullet_idle_red.png', frames: 8 },
      walk: { path: 'bullet_idle_red.png', frames: 8 },
      attack: { path: 'bullet_idle_red.png', frames: 8 }
    },
    spitter: {
      idle: { path: 'acid_idle.png', frames: 8 },
      walk: { path: 'acid_idle.png', frames: 8 },
      attack: { path: 'acid_idle.png', frames: 8 }
    },
    bomber: {
      idle: { path: 'exploding_idle_red.png', frames: 8 },
      walk: { path: 'exploding_idle_red.png', frames: 8 },
      attack: { path: 'exploding_idle_red.png', frames: 8 }
    },
    bombardier: {
      // The only types with real walk/attack sheets on disk.
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
      idle: { path: 'weaver_idle_red.png', frames: 8 },
      walk: { path: 'weaver_idle_red.png', frames: 8 },
      attack: { path: 'weaver_idle_red.png', frames: 8 }
    },
    cordyphage: {
      // cordyphage_idle.png is a single 32x32 frame, not a sheet.
      idle: { path: 'cordyphage_idle_red.png', frames: 8 },
      walk: { path: 'cordyphage_idle_red.png', frames: 8 },
      attack: { path: 'cordyphage_idle_red.png', frames: 8 }
    },
    dead: {
      idle: { path: 'dead_ant.png', frames: 1 },
      walk: { path: 'dead_ant.png', frames: 1 },
      attack: { path: 'dead_ant.png', frames: 1 }
    },
    egg: {
      idle: { path: 'egg_idle_red.png', frames: 8 }
    }
  }
};

// Map hex color codes to sprite color suffixes
const COLOR_MAP = {
  '#FF0000': 'red',
  '#0000FF': 'blue',
  '#00FF00': 'green',
  '#FFFF00': 'yellow',
  '#000000': 'black'
};

// Ant types that have colored sprite variants
const COLORED_ANT_TYPES = ['queen', 'scout', 'drone', 'soldier', 'tank', 'spitter', 'healer', 'bomber', 'bombardier', 'cordyphage', 'egg'];

// Map ant type IDs to their sprite file prefixes
const ANT_TYPE_TO_SPRITE_PREFIX = {
  'queen': 'queen',
  'scout': 'scout',
  'drone': 'drone',
  'soldier': 'marauder',
  'tank': 'bullet',
  'spitter': 'acid',
  'healer': 'weaver',
  'bomber': 'exploding',
  'bombardier': 'bombardier',
  'cordyphage': 'cordyphage',
  'egg': 'egg'
};

// Map ant type IDs to their folder names
const ANT_TYPE_TO_FOLDER = {
  'queen': 'Queen',
  'scout': 'Scout',
  'drone': 'Drone',
  'soldier': 'Marauder',
  'tank': 'Bullet',
  'spitter': 'Acid',
  'healer': 'Weaver',
  'bomber': 'Exploding',
  'bombardier': 'Bombardier',
  'cordyphage': 'Cordyceps',
  'egg': 'Eggs',
  'dead': 'Misc' // dead_ant.png lives in Misc/, not the sprites root
};

// Helper function to get sprite info for an ant
// playerColor: optional hex color code (e.g., '#FF0000')
export function getSpriteInfo(antType, animation, playerColor = null) {
  const sprites = SpriteConfig.SPRITES[antType];
  if (!sprites || !sprites[animation]) {
    return null;
  }

  let spritePath = sprites[animation].path;
  let frameCount = sprites[animation].frames;
  let frameSize = SpriteConfig.SPRITE_SIZE;

  // Get folder name for this ant type
  const folderName = ANT_TYPE_TO_FOLDER[antType] || '';

  // If playerColor is provided and this ant type has colored variants
  // Always use colored idle sprite (even for walk/attack) until colored variants exist for those animations
  if (playerColor && COLORED_ANT_TYPES.includes(antType)) {
    const colorSuffix = COLOR_MAP[playerColor];
    if (colorSuffix) {
      // Get the sprite prefix (some ant types have different sprite filenames)
      const spritePrefix = ANT_TYPE_TO_SPRITE_PREFIX[antType] || antType;
      // Use colored idle sprite for all animations (colored walk/attack sprites don't exist yet)
      spritePath = `${spritePrefix}_idle_${colorSuffix}.png`;
      // Scout colored idle sprites have 10 frames, all others have 8 frames
      frameCount = antType === 'scout' ? 10 : 8;
      // The black and blue egg sheets were exported at 64px per frame while
      // every other sheet is 32px. Report their real size so frame offsets
      // line up instead of sampling the middle of each frame.
      if (antType === 'egg' && (colorSuffix === 'black' || colorSuffix === 'blue')) {
        frameSize = 64;
      }
    }
  }

  // Build full path with folder structure
  const fullPath = folderName
    ? `${process.env.PUBLIC_URL}/sprites/ants/${folderName}/${spritePath}`
    : `${process.env.PUBLIC_URL}/sprites/ants/${spritePath}`;

  return {
    ...sprites[animation],
    frames: frameCount,
    path: spritePath,
    fullPath: fullPath,
    frameWidth: frameSize,
    frameHeight: frameSize,
    animationSpeed: SpriteConfig.ANIMATION_SPEEDS[animation] || 100
  };
}
