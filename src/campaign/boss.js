// The infected old queen (campaign level 12): her three boss powers.
//
// She never moves; on her side's turn, before her army acts, runBossPowers
// applies whichever powers are due:
//   - Spore burst, every SPORE_EVERY rounds: every enemy ant next to her
//     takes SPORE_DAMAGE, ignoring defence.
//   - Second wind, once, the first turn she is at half health or less: two
//     more cordyceped Termites dig up beside her.
//   - Mind control, every MIND_EVERY rounds: the enemy ant with the most
//     health within MIND_RANGE hexes joins her side. Never a queen.
// Ants that die stay dead - nothing rises again.

import { hexDistance, hexesInRange, isValidHex } from '../hexUtils';

export const BOSS_TYPE = 'oldQueen';
export const SPORE_EVERY = 3;
export const SPORE_DAMAGE = 15;
export const MIND_EVERY = 4;
export const MIND_RANGE = 3;

const isQueenLike = a => a.type === 'queen' || a.type === 'queenLarva' || a.type === BOSS_TYPE;

/** Next round (from `turn` on) a power that fires every `every` rounds goes off. */
export function nextBossRound(turn, every) {
  return Math.ceil(Math.max(1, turn) / every) * every;
}

export function runBossPowers(state, aiPlayer, createAnt) {
  const boss = Object.values(state.ants || {}).find(a => a.owner === aiPlayer && a.type === BOSS_TYPE);
  if (!boss) return state;
  const turn = state.turn || 1;
  const events = [];
  const ants = { ...state.ants };
  let campaign = { ...(state.campaign || {}) };

  // Second wind
  if (!campaign.bossSecondWind && boss.health <= boss.maxHealth / 2) {
    const taken = h => Object.values(ants).some(a => a.position.q === h.q && a.position.r === h.r);
    const spots = hexesInRange(boss.position, 3)
      .filter(h => isValidHex(h, state.gridRadius, state.mapShape) && !taken(h))
      .sort((a, b) => hexDistance(a, boss.position) - hexDistance(b, boss.position))
      .slice(0, 2);
    spots.forEach((pos, i) => {
      const t = createAnt('termite', aiPlayer, pos, state.players?.[aiPlayer]?.heroId || null);
      t.id = `camp_boss_termite${i + 1}`;
      ants[t.id] = t;
    });
    campaign.bossSecondWind = true;
    events.push('Second wind! Two more Termites dig up beside the old queen.');
  }

  // Spore burst
  if (turn % SPORE_EVERY === 0) {
    const hit = Object.values(ants).filter(a => a.owner !== aiPlayer && hexDistance(a.position, boss.position) === 1);
    hit.forEach(a => {
      const health = a.health - SPORE_DAMAGE;
      if (health <= 0) delete ants[a.id];
      else ants[a.id] = { ...a, health };
    });
    events.push(hit.length
      ? `Spore burst! ${hit.length} of your ants next to the old queen took ${SPORE_DAMAGE} damage.`
      : 'Spore burst! Nothing was close enough to catch it.');
  }

  // Mind control
  if (turn % MIND_EVERY === 0) {
    const victim = Object.values(ants)
      .filter(a => a.owner !== aiPlayer && !isQueenLike(a) && hexDistance(a.position, boss.position) <= MIND_RANGE)
      .sort((a, b) => (b.health - a.health) || a.id.localeCompare(b.id))[0];
    if (victim) {
      ants[victim.id] = { ...victim, owner: aiPlayer, colorOverride: undefined, isBurrowed: false, hasMoved: true, hasAttacked: true };
      events.push(`Mind control! The old queen takes one of your ants.`);
    } else {
      events.push('Mind control! But none of your ants were close enough to take.');
    }
  }

  campaign.bossLog = events;
  return { ...state, ants, campaign };
}
