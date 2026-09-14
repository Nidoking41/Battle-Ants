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

  state.campaign = {
    levelId: level.id,
    levelName: level.name,
    roster: level.player?.roster || null,
    behavior: level.enemy?.behavior || 'ai',
    aiDifficulty: level.enemy?.aiDifficulty || 'easy',
    // When set, enemy combat units march on the player's Queen Larva instead
    // of guarding their own queen first. Read by aiController.
    enemyHunts: !!level.enemy?.hunt,
    // Running totals for `gather` objectives, so spending never un-completes one.
    gathered: { food: 0, minerals: 0 },
    objectives: (level.objectives || []).map(o => ({ ...o, status: 'pending' }))
  };

  return state;
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
  if (Array.isArray(def?.units)) {
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
