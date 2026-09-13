import { getAntTypeById } from './antTypes';

// Unit experience and ranks.
//
// Every unit hatches as a Recruit and ranks up by landing killing blows. Each
// rank grants a flat percentage boost to attack and max health, so a veteran
// unit that has survived several fights is meaningfully better than a fresh one.

export const RANKS = [
  { id: 'recruit', name: 'Recruit', minXp: 0, bonus: 0.00, icon: '' },
  { id: 'veteran', name: 'Veteran', minXp: 30, bonus: 0.05, icon: '▲' },
  { id: 'hero', name: 'Hero', minXp: 90, bonus: 0.10, icon: '★' },
  { id: 'legend', name: 'Legend', minXp: 200, bonus: 0.15, icon: '✦' }
];

// Ceiling on the underdog multiplier. Without it, a drone killing a Bullet Ant
// would jump straight to Legend from a single lucky finishing blow.
const MAX_UNDERDOG_RATIO = 3;

// Minerals are scarcer than food, so weight them higher when valuing a unit.
const MINERAL_WEIGHT = 1.4;

/**
 * What a unit is "worth" - the basis for both the XP it grants when killed and
 * the underdog ratio when it does the killing. Derived from cost so that
 * rebalancing unit costs keeps experience values in step automatically.
 */
export function getUnitWorth(antTypeId) {
  const type = getAntTypeById(antTypeId);
  if (!type || !type.cost) return 10;
  const worth = type.cost.food + type.cost.minerals * MINERAL_WEIGHT;
  // Queens cost nothing but are the most valuable target on the board.
  return Math.max(10, Math.round(worth || 40));
}

/**
 * XP awarded for a killing blow. Killing something more valuable than yourself
 * scales the reward up, so a scout finishing a Bullet Ant is a career moment
 * and a Bullet Ant swatting a drone is barely worth noting.
 */
export function getXpForKill(killerTypeId, victimTypeId) {
  const victimWorth = getUnitWorth(victimTypeId);
  const killerWorth = getUnitWorth(killerTypeId);
  const ratio = Math.min(MAX_UNDERDOG_RATIO, Math.max(1, victimWorth / killerWorth));
  return Math.round(victimWorth * ratio);
}

/** The rank an XP total corresponds to. */
export function getRankForXp(xp = 0) {
  let current = RANKS[0];
  for (const rank of RANKS) {
    if (xp >= rank.minXp) current = rank;
  }
  return current;
}

/** Stat multiplier from a unit's rank, e.g. 1.05 for a Veteran. */
export function getRankMultiplier(ant) {
  if (!ant) return 1;
  return 1 + getRankForXp(ant.xp || 0).bonus;
}

/** XP still needed for the next rank, or null when already a Legend. */
export function getXpToNextRank(xp = 0) {
  const next = RANKS.find(r => xp < r.minXp);
  return next ? next.minXp - xp : null;
}

/**
 * Award XP for a kill and apply any resulting promotion.
 *
 * Ranking up raises maxHealth, and the unit is healed by the same amount it
 * gained so a promotion never leaves it proportionally more wounded than it
 * was a moment earlier.
 *
 * Returns { ant, promoted, from, to } - `ant` is a new object, never mutated.
 */
export function awardKillXp(killer, victimTypeId) {
  if (!killer) return { ant: killer, promoted: false };

  const beforeRank = getRankForXp(killer.xp || 0);
  const gained = getXpForKill(killer.type, victimTypeId);
  const xp = (killer.xp || 0) + gained;
  const afterRank = getRankForXp(xp);

  const updated = { ...killer, xp, kills: (killer.kills || 0) + 1 };

  if (afterRank.id !== beforeRank.id) {
    const type = getAntTypeById(killer.type);
    const baseMax = type ? type.maxHealth : killer.maxHealth;
    const newMax = Math.round(baseMax * (1 + afterRank.bonus));
    const healthGain = newMax - (killer.maxHealth || baseMax);
    updated.maxHealth = newMax;
    updated.health = Math.min(newMax, (killer.health || 0) + Math.max(0, healthGain));
  }

  return {
    ant: updated,
    promoted: afterRank.id !== beforeRank.id,
    from: beforeRank,
    to: afterRank,
    gained
  };
}
