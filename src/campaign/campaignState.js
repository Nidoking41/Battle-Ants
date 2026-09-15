import { createInitialGameState, createAnt } from '../gameState';
import { HexCoord, hexesInRange, hexDistance, isValidHex } from '../hexUtils';
import { PLAYER_QUEEN_ID, PLAYER_LARVA_ID } from './levels';

// Turn a level definition (levels.js) into a playable game state.
//
// We start from createInitialGameState so the board inherits every structural
// invariant the rest of the code assumes - map, resource nodes, trees, stats,
// armyStrengthHistory - and then reshape only what the level declares. The
// result is a normal 2-player AI game with a `campaign` slice attached; every
// campaign-specific code path elsewhere is gated on that slice existing.

const ENEMY_QUEEN_ID = 'camp_p2_queen';

export function buildCampaignGameState(level) {
  const state = createInitialGameState({
    playerCount: 2,
    mapSize: level.map?.mapSize || 'small'
  });

  // Restrict which resource nodes exist. Depleted anthills respawn a node of
  // the same type, so a food-only map stays food-only for the whole level.
  if (Array.isArray(level.map?.resourceTypes)) {
    const allowed = new Set(level.map.resourceTypes);
    state.resources = Object.fromEntries(
      Object.entries(state.resources).filter(([, r]) => allowed.has(r.type))
    );
  }

  applySide(state, 'player1', level.player, PLAYER_QUEEN_ID);
  applySide(state, 'player2', level.enemy, ENEMY_QUEEN_ID);
  placeTrees(state, level.map?.trees);

  state.campaign = {
    levelId: level.id,
    levelName: level.name,
    roster: level.player?.roster || null,
    behavior: level.enemy?.behavior || 'ai',
    aiDifficulty: level.enemy?.aiDifficulty || 'easy',
    // When set, enemy combat units march on the player's Queen Larva instead
    // of guarding their own queen first. Read by aiController.
    enemyHunts: !!level.enemy?.hunt,
    // The force you start with, for the end-of-level "kept alive" count.
    startingUnitIds: Object.values(state.ants)
      .filter(a => a.owner === 'player1' && a.type !== 'queen' && a.type !== 'queenLarva')
      .map(a => a.id),
    // Scripted reinforcements; spawnDueWaves flips `spawned` as they land.
    waves: (level.enemy?.waves || []).map(w => ({ ...w, spawned: false })),
    // Running totals for `gather` objectives, so spending never un-completes one.
    gathered: { food: 0, minerals: 0 },
    objectives: (level.objectives || []).map(o => ({ ...o, status: 'pending' }))
  };

  return state;
}

// Extra trees at offsets from the player's leader. `dr` is measured toward the
// enemy so a level can say 'two hexes in front of her' regardless of which
// side of the map the player spawned on.
function placeTrees(state, offsets) {
  if (!Array.isArray(offsets) || offsets.length === 0) return;
  const leaderOf = pid => Object.values(state.ants).find(
    a => a.owner === pid && (a.type === 'queen' || a.type === 'queenLarva')
  );
  const mine = leaderOf('player1');
  const theirs = leaderOf('player2');
  if (!mine) return;
  const forward = theirs ? (Math.sign(theirs.position.r - mine.position.r) || -1) : -1;
  const treeAt = h => Object.values(state.trees || {}).some(t => t.position.q === h.q && t.position.r === h.r);
  state.trees = { ...(state.trees || {}) };
  offsets.forEach((o, i) => {
    const pos = new HexCoord(mine.position.q + o.dq, mine.position.r + o.dr * forward);
    if (!isValidHex(pos, state.gridRadius, state.mapShape) || treeAt(pos)) return;
    if (pos.q === mine.position.q && pos.r === mine.position.r) return;
    const id = `tree_camp_${i + 1}`;
    state.trees[id] = { id, position: pos, side: forward < 0 ? 'south' : 'north' };
  });
}

function applySide(state, playerId, def, queenId) {
  const oldQueenKey = Object.keys(state.ants).find(
    k => state.ants[k].type === 'queen' && state.ants[k].owner === playerId
  );

  // queenTier: null means this side has no queen at all.
  if (def && def.queenTier === null) {
    if (oldQueenKey) delete state.ants[oldQueenKey];
  } else if (def && def.queenTier === 'larva' && oldQueenKey) {
    // Replace the queen with a Queen Larva on the same hex, so the camera,
    // starting units and spawn geometry all stay where the map put them.
    const larvaId = playerId === 'player1' ? PLAYER_LARVA_ID : `camp_${playerId}_larva`;
    const larva = createAnt('queenLarva', playerId, state.ants[oldQueenKey].position);
    larva.id = larvaId;
    delete state.ants[oldQueenKey];
    state.ants[larvaId] = larva;
  } else if (oldQueenKey) {
    // Re-key the queen to a stable id so objectives can reference it directly.
    const queen = { ...state.ants[oldQueenKey], id: queenId, queenTier: def?.queenTier || 'queen' };
    delete state.ants[oldQueenKey];
    state.ants[queenId] = queen;
  }

  if (def?.resources) {
    state.players[playerId].resources = { ...def.resources };
  }

  // Guards: units placed at offsets from the leader (queen or larva). Used for
  // levels that hand the player a fixed force instead of a queen to hatch one.
  if (Array.isArray(def?.guards)) {
    const leader = Object.values(state.ants).find(
      a => a.owner === playerId && (a.type === 'queen' || a.type === 'queenLarva')
    );
    if (leader) {
      const free = h =>
        isValidHex(h, state.gridRadius, state.mapShape) &&
        !Object.values(state.ants).some(a => a.position.q === h.q && a.position.r === h.r);
      def.guards.forEach((g, i) => {
        let pos = new HexCoord(leader.position.q + g.offset.dq, leader.position.r + g.offset.dr);
        if (!free(pos)) {
          // Requested hex is taken or off the map: nearest free hex around the
          // leader instead, so a guard is never silently dropped.
          const fallback = hexesInRange(leader.position, 2)
            .filter(free)
            .sort((a, b) => hexDistance(a, leader.position) - hexDistance(b, leader.position))[0];
          if (!fallback) return;
          pos = fallback;
        }
        const ant = createAnt(g.type, playerId, pos);
        ant.id = `camp_${playerId}_guard_${g.type}${i + 1}`;
        state.ants[ant.id] = ant;
      });
    }
  }

  // 'default' (or undefined) keeps the standard opening created by
  // createInitialGameState: 2 drones + 1 scout beside the queen.
  //
  // A list of type names swaps those opening units slot-for-slot - e.g.
  // ['spitter', 'scout', 'scout'] - keeping the hexes the map chose, so a level
  // can reshape the starting force without knowing which side it spawned on.
  if (Array.isArray(def?.units) && def.units.every(u => typeof u === 'string')) {
    // Only the map's own opening units (ant_p<n>_drone1 etc.) are slots - never
    // guards or anything else a level has already placed on this side.
    const slots = Object.values(state.ants)
      .filter(a => a.owner === playerId && a.id.startsWith('ant_p'))
      .sort((a, b) => a.id.localeCompare(b.id));
    slots.forEach(old => delete state.ants[old.id]);
    def.units.forEach((type, i) => {
      const slot = slots[i];
      if (!slot) return; // more types than opening slots: use `guards` for extras
      const ant = createAnt(type, playerId, slot.position);
      ant.id = `camp_${playerId}_${type}${i + 1}`;
      state.ants[ant.id] = ant;
    });
  } else if (Array.isArray(def?.units)) {
    Object.keys(state.ants).forEach(k => {
      if (state.ants[k].owner === playerId && state.ants[k].type !== 'queen') delete state.ants[k];
    });
    def.units.forEach((u, i) => {
      const ant = createAnt(u.type, playerId, new HexCoord(u.at.q, u.at.r));
      ant.id = u.id || `camp_${playerId}_${u.type}${i + 1}`;
      state.ants[ant.id] = ant;
    });
  }
}
