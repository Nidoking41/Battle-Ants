// Scripted enemy reinforcements for campaign levels.
//
// A level declares `enemy.waves: [{ turn, units: [{ type, count }] }]`. At the
// start of each new round, any wave whose turn has arrived spawns its units on
// the free hexes nearest the enemy's leader (queen or larva), then is marked
// spawned so it never fires twice. This makes a level's pressure deterministic
// instead of depending on whether the AI's economy happened to get going.
//
// Called from the campaign hook at the end of endTurn in gameState.js.

import { hexesInRange, hexDistance, isValidHex } from '../hexUtils';

const ENEMY = 'player2';

export function spawnDueWaves(state, createAnt) {
  const waves = state.campaign?.waves;
  if (!Array.isArray(waves) || waves.length === 0) return state;

  const due = waves.filter(w => !w.spawned && state.turn >= w.turn);
  if (due.length === 0) return state;

  const ants = { ...state.ants };
  const leader = Object.values(ants).find(
    a => a.owner === ENEMY && (a.type === 'queen' || a.type === 'queenLarva')
  );
  // No leader left to rally to: reinforcements have nowhere to come from.
  if (!leader) return { ...state, campaign: { ...state.campaign, waves: waves.map(w => due.includes(w) ? { ...w, spawned: true } : w) } };

  const taken = h => Object.values(ants).some(a => a.position.q === h.q && a.position.r === h.r);
  const candidates = hexesInRange(leader.position, 3)
    .filter(h => isValidHex(h, state.gridRadius, state.mapShape) && !taken(h))
    .sort((a, b) => hexDistance(a, leader.position) - hexDistance(b, leader.position));

  let n = 0;
  due.forEach(wave => {
    wave.units.forEach(({ type, count = 1 }) => {
      for (let i = 0; i < count; i++) {
        const pos = candidates.shift();
        if (!pos) return; // nest is packed; the rest of this wave is lost
        const ant = createAnt(type, ENEMY, pos);
        ant.id = `camp_wave${wave.turn}_${type}${++n}`;
        ants[ant.id] = ant;
      }
    });
  });

  return {
    ...state,
    ants,
    campaign: {
      ...state.campaign,
      waves: waves.map(w => due.includes(w) ? { ...w, spawned: true } : w)
    }
  };
}

/** Next wave still to come, or null. For the objective strip. */
export function nextWave(campaign, turn) {
  const pending = (campaign?.waves || []).filter(w => !w.spawned && w.turn > turn);
  return pending.length ? pending.reduce((a, b) => (a.turn <= b.turn ? a : b)) : null;
}
