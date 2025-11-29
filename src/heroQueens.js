// Hero Queen definitions
// Each hero provides unique bonuses to units

export const HeroQueens = {
  GORLAK: {
    id: 'gorlak',
    name: 'Gorlak the Crusher',
    description: 'Melee units gain +20% attack, ranged units do 10% less',
    icon: '🗡️',
    portraitImage: 'hero_red.png',
    bonuses: {
      meleeAttackBonus: 0.20,  // +20% attack for melee (rounded up)
      rangedAttackPenalty: -0.10,  // -10% attack for ranged
      bombardierRangePenalty: -1  // Bombardier gets -1 range
    },
    heroAbility: {
      name: 'Crushing Blow',
      description: 'Units gain +20% attack for this turn and melee units can move one extra space',
      attackBonus: 0.20,
      meleeMoveBonus: 1
    }
  },
  SORLORG: {
    id: 'sorlorg',
    name: 'Sorlorg the Precise',
    description: 'Ranged units gain +20% attack, melee units do 10% less',
    icon: '🎯',
    portraitImage: 'hero_green.png',
    bonuses: {
      rangedAttackBonus: 0.20,  // +20% attack for ranged
      meleeAttackPenalty: -0.10  // -10% attack for melee
    },
    heroAbility: {
      name: 'Perfect Aim',
      description: 'Ranged units gain +1 range and +10% damage for this turn',
      rangedRangeBonus: 1,
      rangedDamageBonus: 0.10
    }
  },
  SKRAZZIT: {
    id: 'skrazzit',
    name: 'Skrazzit the Swarm',
    description: 'Units are 25% cheaper but 20% weaker attack, 10% weaker health. Start with 3 spawning spots',
    icon: '🐜',
    portraitImage: 'hero_blue.png',
    bonuses: {
      costMultiplier: 0.75,     // 25% cheaper (0.75x cost)
      attackMultiplier: 0.80,   // 20% weaker attack (0.80x attack)
      healthMultiplier: 0.90,   // 10% weaker health (0.90x health)
      spawningSpotBonus: 1      // +1 spawning spot (starts with 3 instead of 2)
    },
    heroAbility: {
      name: 'Resource Surge',
      description: 'Food and minerals in stock are multiplied by 1.5, units gain +10% attack',
      resourceMultiplier: 1.5,
      attackBonus: 0.10
    }
  },
  THORGRIM: {
    id: 'thorgrim',
    name: 'Thorgrim the Mighty',
    description: 'Units are 25% more expensive but 20% stronger in attack and health',
    icon: '⚔️',
    portraitImage: 'hero_yellow.png',
    bonuses: {
      costMultiplier: 1.25,     // 25% more expensive (1.25x cost)
      attackMultiplier: 1.20,   // 20% stronger attack (1.20x attack)
      healthMultiplier: 1.20    // 20% stronger health (1.20x health)
    },
    heroAbility: {
      name: 'Ironclad',
      description: 'Units gain +2 defense and +2 attack until their next turn',
      defenseBonus: 2,
      attackBonus: 2,
      lastsTurn: true // Lasts until next turn
    }
  },
  VEXXARA: {
    id: 'vexxara',
    name: 'Vexxara the Lifebinder',
    description: 'Healing is 50% cheaper and queens can heal twice per turn',
    icon: '💚',
    portraitImage: 'hero_black.png',
    bonuses: {
      healCostMultiplier: 0.50,  // 50% cheaper healing (0.50x energy cost)
      queenDoubleHeal: true      // Queens can heal twice per turn
    },
    heroAbility: {
      name: 'Divine Restoration',
      description: 'All units restored to full health and energy, gain +10% attack boost',
      fullHeal: true,
      fullEnergy: true,
      attackBonus: 0.10
    }
  }
};

// Helper to get hero by id
export function getHeroById(heroId) {
  return Object.values(HeroQueens).find(h => h.id === heroId) || null;
}

// Melee ant types (attackRange === 1)
const MELEE_ANT_TYPES = ['scout', 'soldier', 'tank', 'drone'];

// Ranged ant types (attackRange > 1)
const RANGED_ANT_TYPES = ['spitter', 'bombardier', 'queen'];

// Apply hero bonuses when creating an ant
export function applyHeroBonuses(antStats, antType, heroId) {
  if (!heroId) return antStats;

  const hero = getHeroById(heroId);
  if (!hero) return antStats;

  let modifiedStats = { ...antStats };
  const bonuses = hero.bonuses;

  // Check if melee or ranged
  const isMelee = MELEE_ANT_TYPES.includes(antType);
  const isRanged = RANGED_ANT_TYPES.includes(antType);

  // Apply melee bonuses (Gorlak)
  if (isMelee && bonuses.meleeAttackBonus) {
    modifiedStats.attack = Math.ceil(modifiedStats.attack * (1 + bonuses.meleeAttackBonus));
  }
  if (isMelee && bonuses.meleeHealthBonus) {
    modifiedStats.maxHealth = modifiedStats.maxHealth + bonuses.meleeHealthBonus;
    modifiedStats.health = modifiedStats.health + bonuses.meleeHealthBonus;
  }

  // Apply melee penalties (Sorlorg)
  if (isMelee && bonuses.meleeAttackPenalty) {
    modifiedStats.attack = Math.floor(modifiedStats.attack * (1 + bonuses.meleeAttackPenalty));
  }

  // Apply ranged bonuses (Sorlorg)
  if (isRanged && bonuses.rangedAttackBonus) {
    modifiedStats.attack = Math.floor(modifiedStats.attack * (1 + bonuses.rangedAttackBonus));
  }

  // Apply ranged penalties (Gorlak)
  if (isRanged && bonuses.rangedAttackPenalty) {
    modifiedStats.attack = Math.floor(modifiedStats.attack * (1 + bonuses.rangedAttackPenalty));
  }

  // Apply bombardier range penalty (Gorlak)
  if (antType === 'bombardier' && bonuses.bombardierRangePenalty) {
    modifiedStats.attackRange = Math.max(1, modifiedStats.attackRange + bonuses.bombardierRangePenalty);
  }

  // Apply universal attack multiplier (Skrazzit, Thorgrim)
  if (bonuses.attackMultiplier) {
    modifiedStats.attack = Math.floor(modifiedStats.attack * bonuses.attackMultiplier);
  }

  // Apply universal health multiplier (Skrazzit, Thorgrim)
  if (bonuses.healthMultiplier) {
    modifiedStats.maxHealth = Math.floor(modifiedStats.maxHealth * bonuses.healthMultiplier);
    modifiedStats.health = Math.floor(modifiedStats.health * bonuses.healthMultiplier);
  }

  return modifiedStats;
}

// Apply hero cost modifier when buying/hatching units
export function applyHeroCostModifier(cost, heroId) {
  if (!heroId) return cost;

  const hero = getHeroById(heroId);
  if (!hero || !hero.bonuses.costMultiplier) return cost;

  return {
    food: Math.ceil(cost.food * hero.bonuses.costMultiplier),
    minerals: Math.ceil(cost.minerals * hero.bonuses.costMultiplier)
  };
}

// Get heal energy cost with hero modifier
export function getHealEnergyCost(baseEnergyCost, heroId) {
  if (!heroId) return baseEnergyCost;

  const hero = getHeroById(heroId);
  if (!hero || !hero.bonuses.healCostMultiplier) return baseEnergyCost;

  return Math.ceil(baseEnergyCost * hero.bonuses.healCostMultiplier);
}

// Check if queen can heal twice (Vexxara)
export function canQueenHealTwice(heroId) {
  if (!heroId) return false;

  const hero = getHeroById(heroId);
  return hero?.bonuses?.queenDoubleHeal || false;
}
