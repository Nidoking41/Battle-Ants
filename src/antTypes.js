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
    cost: { food: 30, minerals: 25 },
    hatchTime: 2,
    maxHealth: 80,
    attack: 15,
    defense: 2,
    moveSpeed: 2,
    moveRange: 2,
    attackRange: 1,
    resourceGatherRate: 0.5,
    description: 'Slow and expensive, but incredibly durable.',
    icon: '🛡️🐜'
  },

  SPITTER: {
    id: 'spitter',
    name: 'Acid Spitter',
    cost: { food: 15, minerals: 10 },
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
    cost: { food: 10, minerals: 10 },
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
  ANTHILL_BUILD_COST: 10, // Food cost to start building an anthill
  ANTHILL_PASSIVE_INCOME: {
    food: 7,  // Per turn for food anthills
    minerals: 7  // Per turn for mineral anthills
  },
  // Queen Energy System
  QUEEN_BASE_ENERGY: 100,
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
    description: '+20% Attack for melee units (min +1)',
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
    description: '+20% Attack for ranged units (min +1)',
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
    description: '+20% Defense for all units (min +1)',
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
  }
};

// Queen Upgrade Tiers
export const QueenTiers = {
  queen: {
    id: 'queen',
    name: 'Queen',
    spawningSpots: 2,
    eggCostReduction: 0,
    maxEnergy: 100,
    energyRegen: 15,
    foodIncome: 5,
    icon: '👑🐜'
  },
  broodQueen: {
    id: 'broodQueen',
    name: 'Brood Queen',
    spawningSpots: 4,
    eggCostReduction: 5,
    maxEnergy: 125,
    energyRegen: 20,
    foodIncome: 8,
    cost: { food: 20, minerals: 15 },
    icon: '👑👑🐜'
  },
  swarmQueen: {
    id: 'swarmQueen',
    name: 'Swarm Queen',
    spawningSpots: 6,
    eggCostReduction: 10,
    maxEnergy: 150,
    energyRegen: 25,
    foodIncome: 11,
    cost: { food: 40, minerals: 30 },
    icon: '👑👑👑🐜'
  }
};
