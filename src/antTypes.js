// Ant type definitions with stats and abilities

export const AntTypes = {
  QUEEN: {
    id: 'queen',
    name: 'Queen',
    cost: { food: 0, minerals: 0 }, // Queens start on the map
    hatchTime: 0,
    maxHealth: 60,
    attack: 6,
    defense: 2,
    moveSpeed: 1,
    moveRange: 1,
    attackRange: 2, // Queens can attack 2 spaces away
    resourceGatherRate: 0,
    // Reveal ability
    revealEnergyCost: 30,
    description: 'The heart of your colony. If she dies, you lose!',
    icon: '👑🐜'
  },

  SCOUT: {
    id: 'scout',
    name: 'Scout Ant',
    cost: { food: 15, minerals: 0 },
    hatchTime: 1, // turns
    maxHealth: 20,
    attack: 8,
    defense: 0,
    moveSpeed: 3,
    moveRange: 3,
    attackRange: 1,
    resourceGatherRate: 3,
    description: 'Fast, cheap, and weak. Perfect for early game exploration.',
    icon: '🏃🐜'
  },

  SOLDIER: {
    id: 'soldier',
    name: 'Marauder Ant',
    cost: { food: 20, minerals: 5 },
    hatchTime: 1,
    maxHealth: 35,
    attack: 12,
    defense: 1,
    moveSpeed: 2,
    moveRange: 2,
    attackRange: 1,
    resourceGatherRate: 3,
    description: 'Balanced fighter with good health and damage.',
    icon: '⚔️🐜'
  },

  TANK: {
    id: 'tank',
    name: 'Bullet Ant',
    cost: { food: 35, minerals: 25 },
    hatchTime: 2,
    maxHealth: 65,
    attack: 15,
    defense: 2,
    moveSpeed: 2,
    moveRange: 2,
    attackRange: 1,
    resourceGatherRate: 0.5,
    requiresQueenTier: 'swarmQueen', // Locked behind Swarm Queen
    description: 'Slow and expensive, but incredibly durable. Requires Swarm Queen.',
    icon: '🛡️🐜'
  },

  SPITTER: {
    id: 'spitter',
    name: 'Acid Ant',
    cost: { food: 15, minerals: 10 },
    hatchTime: 1,
    maxHealth: 25,
    attack: 8,
    defense: 0,
    attackRange: 2,
    moveSpeed: 2,
    moveRange: 2,
    resourceGatherRate: 0.5,
    description: 'Ranged glass cannon. High damage from a distance but fragile.',
    icon: '💧🐜'
  },

  BOMBER: {
    id: 'bomber',
    name: 'Exploding Ant',
    cost: { food: 10, minerals: 10 },
    hatchTime: 1,
    maxHealth: 15,
    attack: 20,
    defense: 0,
    moveSpeed: 2,
    moveRange: 2,
    attackRange: 2,
    splashDamage: true,
    splashRadius: 1, // affects adjacent hexes
    resourceGatherRate: 0.5,
    description: 'Deals splash damage to enemies in a small radius.',
    icon: '💣🐜'
  },

  BOMBARDIER: {
    id: 'bombardier',
    name: 'Bombardier',
    cost: { food: 25, minerals: 20 },
    hatchTime: 2,
    maxHealth: 30,
    attack: 15, // Focus fire damage
    splashAttack: 8, // Splash damage
    defense: 0,
    moveSpeed: 1,
    moveRange: 1,
    attackRange: 3,
    minAttackRange: 2, // Cannot attack adjacent enemies
    cannotMoveAndAttack: true, // Cannot move and attack in same turn
    hasDualAttackModes: true, // New property to indicate dual attack modes
    splashRadius: 1, // 3-hex area (center + adjacent hexes)
    resourceGatherRate: 0,
    requiresQueenTier: 'swarmQueen', // Locked behind Swarm Queen
    description: 'Long-range artillery with Focus Fire (15 dmg) or Splash (8 dmg, 3-hex area). Cannot attack adjacent enemies or move and shoot. Requires Swarm Queen.',
    icon: '🎯🐜'
  },

  DRONE: {
    id: 'drone',
    name: 'Drone',
    cost: { food: 10, minerals: 0 },
    hatchTime: 1,
    maxHealth: 15,
    attack: 5,
    defense: 0,
    moveSpeed: 2,
    moveRange: 2,
    attackRange: 1,
    canBuildAnthill: true, // Drones can build anthills on resource nodes
    resourceGatherRate: 5,
    description: 'Poor combatant but can build anthills to generate passive income.',
    icon: '⛏️🐜'
  },

  HEALER: {
    id: 'healer',
    name: 'Weaver Ant',
    cost: { food: 20, minerals: 15 },
    hatchTime: 1,
    maxHealth: 20,
    attack: 0, // Cannot attack
    defense: 1,
    moveSpeed: 2,
    moveRange: 2,
    attackRange: 0, // No attack range
    resourceGatherRate: 0,
    requiresQueenTier: 'broodQueen', // Locked behind Brood Queen
    // Energy system for abilities
    maxEnergy: 50,
    startingEnergy: 10,
    energyRegen: 10,
    // Abilities
    healRange: 1, // Melee range healing
    healAmount: 20,
    healEnergyCost: 20,
    ensnareRange: 3,
    ensnareDuration: 3, // turns
    ensnareEnergyCost: 30,
    description: 'Support unit that can heal allies and ensnare enemies. Requires Brood Queen.',
    icon: '✨🐜'
  },

  CORDYPHAGE: {
    id: 'cordyphage',
    name: 'Cordyphage',
    cost: { food: 25, minerals: 20 },
    hatchTime: 2,
    maxHealth: 25,
    attack: 0, // Cannot attack
    defense: 1,
    moveSpeed: 2,
    moveRange: 2,
    attackRange: 0, // No attack range
    resourceGatherRate: 0,
    requiresQueenTier: 'swarmQueen', // Locked behind Swarm Queen
    // Energy system for abilities
    maxEnergy: 50,
    startingEnergy: 10,
    energyRegen: 10,
    // Abilities
    cordycepsRange: 2, // Range for mind control
    cordycepsEnergyCost: 50, // Expensive ability
    plagueRange: 3, // Range for plague
    plagueDuration: 3, // turns
    plagueHealthLoss: 0.20, // 20% health per turn
    plagueEnergyCost: 35,
    description: 'Dark spellcaster that can mind control enemies with Cordyceps Purge and inflict Plague. Requires Swarm Queen.',
    icon: '☠️🐜'
  }
};

export const ResourceTypes = {
  FOOD: 'food',
  MINERALS: 'minerals'
};

export const GameConstants = {
  MOVES_PER_TURN: 3,
  STARTING_RESOURCES: {
    food: 35,
    minerals: 0
  },
  HEX_GRID_SIZE: 10, // 10x10 hex grid
  RESOURCE_SPAWN_COUNT: 6, // number of resource nodes on map
  TREE_COUNT_SMALL_MEDIUM: 6, // trees on small/medium maps (3 north, 3 south, mirrored)
  TREE_COUNT_LARGE: 8, // trees on large maps (4 north, 4 south, mirrored)
  TREE_DEFENSE_BONUS: 1, // defense bonus for ants on tree hexes
  ANTHILL_BUILD_PROGRESS_REQUIRED: 2, // Number of drone actions needed to complete an anthill
  ANTHILL_BUILD_COST: 5, // Food cost to start building an anthill
  ANTHILL_PASSIVE_INCOME: {
    food: 6,  // Per turn for food anthills
    minerals: 8  // Per turn for mineral anthills
  },
  // Queen Energy System
  QUEEN_BASE_ENERGY: 75,
  QUEEN_BASE_ENERGY_REGEN: 15,
  EGG_LAY_ENERGY_COST: 20,
  HEAL_ENERGY_COST: 25,
  HEAL_AMOUNT: 20,
  BASE_SPAWNING_SPOTS: 2,
  // Queen Passive Income
  QUEEN_BASE_FOOD_INCOME: 5,
  // Cannibalism
  CANNIBALISM_FOOD_GAIN: 3,
  CANNIBALISM_MINERAL_GAIN: 3
};

export const Upgrades = {
  MELEE_ATTACK: {
    id: 'meleeAttack',
    name: 'Melee Attack',
    description: '+10% Attack for melee units (min +1)',
    icon: '⚔️',
    maxTier: 3,
    costs: [
      { food: 20, minerals: 15 }, // Tier 1
      { food: 25, minerals: 20 }, // Tier 2
      { food: 30, minerals: 25 }  // Tier 3
    ]
  },
  RANGED_ATTACK: {
    id: 'rangedAttack',
    name: 'Ranged Attack',
    description: '+10% Attack for ranged units (min +1)',
    icon: '🏹',
    maxTier: 3,
    costs: [
      { food: 20, minerals: 15 }, // Tier 1
      { food: 25, minerals: 20 }, // Tier 2
      { food: 30, minerals: 25 }  // Tier 3
    ]
  },
  DEFENSE: {
    id: 'defense',
    name: 'Defense',
    description: '+10% Defense for all units (min +1)',
    icon: '🛡️',
    maxTier: 3,
    costs: [
      { food: 20, minerals: 15 }, // Tier 1
      { food: 25, minerals: 20 }, // Tier 2
      { food: 30, minerals: 25 }  // Tier 3
    ]
  },
  CANNIBALISM: {
    id: 'cannibalism',
    name: 'Cannibalism',
    description: '+3 Food and +3 Minerals when melee units kill',
    icon: '🍖',
    maxTier: 1,
    costs: [
      { food: 15, minerals: 10 }  // Tier 1
    ]
  },
  BURROW: {
    id: 'burrow',
    name: 'Burrow',
    description: 'Unlock burrow ability for all units (except Tank/Bombardier)',
    icon: '🕳️',
    maxTier: 1,
    costs: [
      { food: 15, minerals: 15 }  // Tier 1
    ]
  },
  CONNECTED_TUNNELS: {
    id: 'connectedTunnels',
    name: 'Connected Tunnels',
    description: 'Units on anthills can teleport to other friendly anthills',
    icon: '🌀',
    maxTier: 1,
    requiresQueenTier: 'swarmQueen', // Locked behind Swarm Queen
    costs: [
      { food: 15, minerals: 15 }  // Tier 1
    ]
  },
  CORDYCEPS_PURGE: {
    id: 'cordycepsPurge',
    name: 'Cordyceps Purge',
    description: 'Unlocks mind control ability for Weaver Ants (35⚡, Range 2)',
    icon: '🧠',
    maxTier: 1,
    requiresQueenTier: 'swarmQueen', // Locked behind Swarm Queen
    costs: [
      { food: 20, minerals: 20 } // Single expensive unlock
    ]
  },
  REVEAL: {
    id: 'reveal',
    name: 'Pheromone Pulse',
    description: 'Unlocks Pheromone Pulse ability for Queens (30⚡). Reveals any hex and its 6 adjacent hexes. Detects burrowed units for 1 turn.',
    icon: '👁️',
    maxTier: 1,
    costs: [
      { food: 15, minerals: 15 }
    ]
  }
};

// Queen Upgrade Tiers
export const QueenTiers = {
  queen: {
    id: 'queen',
    name: 'Queen',
    spawningSpots: 2,
    maxEnergy: 75,
    energyRegen: 15,
    foodIncome: 5,
    icon: '👑🐜'
  },
  broodQueen: {
    id: 'broodQueen',
    name: 'Brood Queen',
    spawningSpots: 4,
    maxEnergy: 100,
    energyRegen: 20,
    foodIncome: 6,
    cost: { food: 20, minerals: 15 },
    icon: '👑👑🐜'
  },
  swarmQueen: {
    id: 'swarmQueen',
    name: 'Swarm Queen',
    spawningSpots: 6,
    maxEnergy: 125,
    energyRegen: 25,
    foodIncome: 7,
    cost: { food: 30, minerals: 20 },
    icon: '👑👑👑🐜'
  }
};
