// Ant type definitions with stats and abilities

export const AntTypes = {
  QUEEN: {
    id: 'queen',
    name: 'Queen',
    cost: { food: 0, minerals: 0 }, // Queens start on the map
    hatchTime: 0,
    maxHealth: 100,
    attack: 15,
    defense: 5,
    moveSpeed: 1,
    moveRange: 1,
    attackRange: 2, // Queens can attack 2 spaces away
    resourceGatherRate: 0,
    description: 'The heart of your colony. If she dies, you lose!',
    icon: '👑🐜'
  },

  SCOUT: {
    id: 'scout',
    name: 'Scout Ant',
    cost: { food: 15, minerals: 0 },
    hatchTime: 1, // turns
    maxHealth: 25,
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
    name: 'Soldier Ant',
    cost: { food: 20, minerals: 5 },
    hatchTime: 1,
    maxHealth: 45,
    attack: 10,
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
    name: 'Tank Ant',
    cost: { food: 30, minerals: 15 },
    hatchTime: 2,
    maxHealth: 80,
    attack: 20,
    defense: 2,
    moveSpeed: 2,
    moveRange: 2,
    attackRange: 1,
    resourceGatherRate: 0.5,
    description: 'Expensive, but incredibly strong and durable.',
    icon: '🛡️🐜'
  },

  SPITTER: {
    id: 'spitter',
    name: 'Acid Spitter',
    cost: { food: 15, minerals: 7 },
    hatchTime: 2,
    maxHealth: 25,
    attack: 12,
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
    name: 'Acid Bomber',
    cost: { food: 10, minerals: 9 },
    hatchTime: 2,
    maxHealth: 40,
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
    attack: 15,
    defense: 0,
    moveSpeed: 1,
    moveRange: 1,
    attackRange: 3,
    minAttackRange: 2, // Cannot attack adjacent enemies
    cannotMoveAndAttack: true, // Cannot move and attack in same turn
    resourceGatherRate: 0,
    description: 'Long-range artillery. Cannot attack adjacent enemies or move and shoot.',
    icon: '🎯🐜'
  },

  DRONE: {
    id: 'drone',
    name: 'Worker Drone',
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
  }
};

export const ResourceTypes = {
  FOOD: 'food',
  MINERALS: 'minerals'
};

export const GameConstants = {
  MOVES_PER_TURN: 3,
  STARTING_RESOURCES: {
    food: 25,
    minerals: 0
  },
  HEX_GRID_SIZE: 10, // 10x10 hex grid
  RESOURCE_SPAWN_COUNT: 6, // number of resource nodes on map
  ANTHILL_BUILD_PROGRESS_REQUIRED: 2, // Number of drone actions needed to complete an anthill
  ANTHILL_BUILD_COST: 5, // Food cost to start building an anthill
  ANTHILL_PASSIVE_INCOME: {
    food: 8,  // Per turn for food anthills
    minerals: 6 // Per turn for mineral anthills
  },
  // Queen energy system
  QUEEN_BASE_ENERGY: 5,
  QUEEN_BASE_ENERGY_REGEN: 5,
  EGG_LAY_ENERGY_COST: 1,
  HEAL_ENERGY_COST: 2,
  HEAL_AMOUNT: 15,
  QUEEN_BASE_FOOD_INCOME: 5,
  // Tree bonuses
  TREE_DEFENSE_BONUS: 2,
  // Cannibalism upgrade
  CANNIBALISM_FOOD_GAIN: 5,
  CANNIBALISM_MINERAL_GAIN: 2,
  // Map sizes for multiplayer
  TRIANGLE_SIDE_LENGTH: 15, // 3-player triangle map (15 hexes per side)
  SQUARE_SIZE: 16 // 4-player square map (16x12 hexes, ~149 hexes)
};

export const Upgrades = {
  MELEE_ATTACK: {
    id: 'meleeAttack',
    name: 'Melee Attack',
    description: '+1 Attack for melee units',
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
    description: '+1 Attack for ranged units',
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
    description: '+1 Defense for all units',
    icon: '🛡️',
    maxTier: 3,
    costs: [
      { food: 20, minerals: 15 }, // Tier 1
      { food: 25, minerals: 20 }, // Tier 2
      { food: 30, minerals: 25 }  // Tier 3
    ]
  }
};

// Map shapes for multiplayer
export const MapShape = {
  RECTANGLE: 'rectangle', // 2-player (10x10)
  TRIANGLE: 'triangle',   // 3-player (equilateral triangle, 15 hexes per side)
  SQUARE: 'square'        // 4-player (square/diamond shape)
};

// Team identifiers
export const Teams = {
  NONE: null,
  TEAM_A: 'A',
  TEAM_B: 'B'
};

// Queen tier progression
export const QueenTiers = {
  queen: {
    name: 'Queen',
    spawningSpots: 2,
    maxEnergy: 50,
    foodIncome: 5
  },
  broodQueen: {
    name: 'Brood Queen',
    spawningSpots: 4,
    maxEnergy: 75,
    foodIncome: 6,
    cost: { food: 25, minerals: 15 }
  },
  swarmQueen: {
    name: 'Swarm Queen',
    spawningSpots: 6,
    maxEnergy: 100,
    foodIncome: 7,
    cost: { food: 30, minerals: 20 }
  }
};
