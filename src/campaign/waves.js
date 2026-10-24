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
  // Where a wave lands: the map's spawn point `at` ('P' markers) when the map
  // has them, otherwise beside the enemy leader
  const spawns = state.campaign?.waveSpawns || [];
  const anchorOf = wave => (spawns.length ? spawns[(wave.at ?? 0) % spawns.length] : leader?.position);
  // No leader and no spawn points: reinforcements have nowhere to come from.
  if (!leader && spawns.length === 0) return { ...state, campaign: { ...state.campaign, waves: waves.map(w => due.includes(w) ? { ...w, spawned: true } : w) } };

  const taken = h => Object.values(ants).some(a => a.position.q === h.q && a.position.r === h.r);
  const candidatesNear = anchor => hexesInRange(anchor, 3)
    .filter(h => isValidHex(h, state.gridRadius, state.mapShape) && !taken(h))
    .sort((a, b) => hexDistance(a, anchor) - hexDistance(b, anchor));

  let n = 0;
  due.forEach(wave => {
    const candidates = candidatesNear(anchorOf(wave));
    wave.units.forEach(({ type, count = 1 }) => {
      for (let i = 0; i < count; i++) {
        const pos = candidates.shift();
        if (!pos) return; // nest is packed; the rest of this wave is lost
        const ant = createAnt(type, ENEMY, pos, state.players?.[ENEMY]?.heroId || null);
        ant.id = `camp_wave${wave.turn}_${type}${++n}`;
        // An allied hero's troops keep their own colour (wave.color)
        if (wave.color) ant.colorOverride = wave.color;
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

/**
 * Level 8's last stand: when `allOut.after` watch-nests have burned, `units`
 * arrive beside the last nest still standing and the whole enemy army goes
 * for the player's queen - aggressive, scouts too, guards leave their posts,
 * ambushers burst out of the ground and sleeping hunters wake. Fires once.
 */
export function spawnAllOutAttack(state, createAnt) {
  const allOut = state.campaign?.allOut;
  if (!allOut || allOut.fired) return state;
  const nests = Object.values(state.anthills || {}).filter(h => h.isWatchNest);
  if (allOut.nestsAtStart - nests.length < allOut.after) return state;

  const ants = {};
  Object.entries(state.ants).forEach(([id, a]) => {
    ants[id] = a.owner === ENEMY && !a.lost
      ? { ...a, guard: false, dormant: false, isBurrowed: false }
      : a;
  });
  const anchor = nests[0]?.position;
  if (anchor) {
    const taken = h => Object.values(ants).some(a => a.position.q === h.q && a.position.r === h.r);
    const spots = hexesInRange(anchor, 3)
      .filter(h => isValidHex(h, state.gridRadius, state.mapShape) && !taken(h) &&
        !(h.q === anchor.q && h.r === anchor.r))
      .sort((a, b) => hexDistance(a, anchor) - hexDistance(b, anchor));
    let n = 0;
    (allOut.units || []).forEach(({ type, count = 1 }) => {
      for (let i = 0; i < count; i++) {
        const pos = spots.shift();
        if (!pos) return;
        const ant = createAnt(type, ENEMY, pos, state.players?.[ENEMY]?.heroId || null);
        ant.id = `camp_allout_${type}${++n}`;
        ants[ant.id] = ant;
      }
    });
  }
  return {
    ...state,
    ants,
    campaign: {
      ...state.campaign,
      allOut: { ...allOut, fired: true },
      events: [...(state.campaign.events || []), 'allOut'],
      enemyHunts: true,
      enemyAggressive: true,
      enemyHuntsWithScouts: true,
      enemyHoldPosition: false
    }
  };
}

/** Next wave still to come, or null. For the objective strip. */
export function nextWave(campaign, turn) {
  const pending = (campaign?.waves || []).filter(w => !w.spawned && w.turn > turn);
  return pending.length ? pending.reduce((a, b) => (a.turn <= b.turn ? a : b)) : null;
}
