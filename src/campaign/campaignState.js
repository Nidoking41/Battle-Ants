import { createInitialGameState, createAnt, createAnthillInProgress, completeAnthill, getSpawningPoolHexes } from '../gameState';
import { HexCoord, hexesInRange, hexDistance, isValidHex, getNeighbors } from '../hexUtils';
import { QueenTiers } from '../antTypes';
import { PLAYER_QUEEN_ID, PLAYER_LARVA_ID, ENEMY_QUEEN_ID } from './levels';
import { parseLayout } from './mapLayout';

// Turn a level definition (levels.js) into a playable game state.
//
// We start from createInitialGameState so the board inherits every structural
// invariant the rest of the code assumes - map, resource nodes, trees, stats,
// armyStrengthHistory - and then reshape only what the level declares. The
// result is a normal 2-player AI game with a `campaign` slice attached; every
// campaign-specific code path elsewhere is gated on that slice existing.

// Sprite colour per hero, so a side's ants match the portrait in its cutscene.
// Mirrors the table in AIGameSetup.js.
const HERO_COLORS = {
  gorlak: '#FF0000',
  sorlorg: '#00FF00',
  skrazzit: '#0000FF',
  thorgrim: '#FFFF00',
  vexxara: '#000000'
};

export function buildCampaignGameState(level) {
  const p1Hero = level.player?.hero || null;
  const p2Hero = level.enemy?.hero || null;
  const state = createInitialGameState({
    playerCount: 2,
    mapSize: level.map?.mapSize || 'small',
    river: false, // campaign levels draw their own water in the level layout
    player1Hero: p1Hero,
    player2Hero: p2Hero,
    ...(p1Hero && HERO_COLORS[p1Hero] ? { player1Color: HERO_COLORS[p1Hero] } : {}),
    ...(p2Hero && HERO_COLORS[p2Hero] ? { player2Color: HERO_COLORS[p2Hero] } : {})
  });

  // A hand-drawn map replaces the generated hexagon entirely: its shape,
  // nodes, trees and leader positions. Must run before anything that places
  // units relative to a leader.
  if (level.map?.layout) {
    applyLayout(state, level);
  }

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
    // false: no queen upgrades on this level (she stays the tier she starts as)
    queenUpgrades: level.player?.queenUpgrades !== false,
    behavior: level.enemy?.behavior || 'ai',
    aiDifficulty: level.enemy?.aiDifficulty || 'easy',
    // What the enemy AI may hatch on this level, e.g. { soldier: 0.6, spitter: 0.4 }.
    // null = the difficulty's normal mix. Read by executeAITurn.
    enemyUnitMix: level.enemy?.unitMix || null,
    // true: enemy combat units march on the player's leader (queen or larva)
    // instead of guarding home first. 'unit:<id>': march on that unit while it
    // lives, then the leader. Read by aiController.
    enemyHunts: level.enemy?.hunt || false,
    // true: hunting units ignore danger entirely and charge (see aiController)
    enemyAggressive: level.enemy?.aggressive || false,
    // true: scouts join the hunt as well (normally they keep scouting).
    enemyHuntsWithScouts: level.enemy?.huntWithScouts || false,
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

const isLeader = a => a.type === 'queen' || a.type === 'queenLarva';
const occupiedAt = (state, h) => Object.values(state.ants).some(a => a.position.q === h.q && a.position.r === h.r);
const leaderOf = (state, pid) => Object.values(state.ants).find(a => a.owner === pid && isLeader(a));
const heroOf = (state, pid) => state.players?.[pid]?.heroId || null;

// Nearest free, on-map hex to `center` (excluding `center` itself), searched
// in rings so placement is deterministic.
function nearestFree(state, center, maxRange = 3) {
  for (let range = 1; range <= maxRange; range++) {
    const ring = hexesInRange(center, range)
      .filter(h => hexDistance(h, center) === range)
      .filter(h => isValidHex(h, state.gridRadius, state.mapShape) && !occupiedAt(state, h))
      .sort((a, b) => (a.q - b.q) || (a.r - b.r));
    if (ring.length) return ring[0];
  }
  return null;
}

// Apply a level's ASCII layout (see mapLayout.js) to a freshly generated state.
function applyLayout(state, level) {
  const layout = parseLayout(level.map.layout, level.map.legend || {});

  state.mapShape = layout.mapShape;
  state.mapHexes = layout.mapHexes;
  state.mapWater = layout.water; // drawn as blue hexes; never part of the mask
  state.gridRadius = layout.gridRadius;

  // The generated nodes and trees are for a hexagon that no longer exists.
  state.resources = {};
  layout.resources.forEach((res, i) => {
    const id = `resource_c${i + 1}`;
    state.resources[id] = { id, type: res.type, position: res.position };
  });
  state.trees = {};
  layout.trees.forEach((pos, i) => {
    const id = `tree_c${i + 1}`;
    state.trees[id] = { id, position: pos, side: pos.r < 0 ? 'north' : 'south' };
  });

  // Move each side's leader to its marker and re-seat its opening units on
  // the nearest free hexes, so the standard opening survives on any shape.
  ['player1', 'player2'].forEach(pid => {
    const queen = leaderOf(state, pid);
    const target = layout.leaders[pid];
    if (!queen) return;
    if (!target) {
      // No marker for this side: the level must be removing its leader
      // (queenTier: null). Drop the generated opening units; applySide
      // handles the leader itself.
      Object.values(state.ants).filter(a => a.owner === pid && !isLeader(a)).forEach(a => { delete state.ants[a.id]; });
      return;
    }
    const followers = Object.values(state.ants).filter(a => a.owner === pid && !isLeader(a));
    followers.forEach(a => { delete state.ants[a.id]; });
    state.ants[queen.id] = { ...queen, position: target };
    // Drones start on the queen's egg spots, one each side, so both flanks'
    // resources are a move away; everything else takes the nearest free hex.
    const eggSpots = queen.type === 'queen'
      ? getSpawningPoolHexes(state.ants[queen.id], getNeighbors, state)
      : [];
    const ordered = [...followers.filter(a => a.type === 'drone'), ...followers.filter(a => a.type !== 'drone')];
    ordered.forEach(a => {
      const spot = a.type === 'drone' && eggSpots.find(h => !occupiedAt(state, h));
      const pos = spot || nearestFree(state, target);
      if (!pos) return; // no room on this map for the opening units
      state.ants[a.id] = { ...a, position: pos };
    });
  });

  // Marker units from the legend
  const counts = {};
  layout.units.forEach(u => {
    counts[u.marker] = (counts[u.marker] || 0) + 1;
    const ant = createAnt(u.type, u.owner, u.position, heroOf(state, u.owner));
    ant.id = `camp_${u.owner}_${u.marker}${counts[u.marker]}`;
    state.ants[ant.id] = ant;
  });
}

// Extra trees at offsets from the player's leader. `dr` is measured toward the
// enemy so a level can say 'two hexes in front of her' regardless of which
// side of the map the player spawned on.
function placeTrees(state, offsets) {
  if (!Array.isArray(offsets) || offsets.length === 0) return;
  const mine = leaderOf(state, 'player1');
  const theirs = leaderOf(state, 'player2');
  if (!mine) return;
  const forward = theirs ? (Math.sign(theirs.position.r - mine.position.r) || -1) : -1;
  const treeAt = h => Object.values(state.trees || {}).some(t => t.position.q === h.q && t.position.r === h.r);
  const nodeAt = h => Object.values(state.resources || {}).some(r => r.position.q === h.q && r.position.r === h.r);
  state.trees = { ...(state.trees || {}) };
  offsets.forEach((o, i) => {
    const pos = new HexCoord(mine.position.q + o.dq, mine.position.r + o.dr * forward);
    if (!isValidHex(pos, state.gridRadius, state.mapShape) || treeAt(pos) || nodeAt(pos)) return;
    if (pos.q === mine.position.q && pos.r === mine.position.r) return;
    const id = `tree_camp_${i + 1}`;
    state.trees[id] = { id, position: pos, side: forward < 0 ? 'south' : 'north' };
  });
}

// Pre-built, completed anthills on this side's nearest free nodes of a type.
// `near: 'enemy'` measures from the other side's leader instead - for a level
// that hands the player a foothold behind the enemy line.
function placeAnthills(state, playerId, defs) {
  if (!Array.isArray(defs) || defs.length === 0) return;
  const otherId = playerId === 'player1' ? 'player2' : 'player1';
  const reinforcedByUpgrade = !!state.players[playerId].upgrades?.anthillDurability;
  const hillAt = h => Object.values(state.anthills || {}).some(a => a.position.q === h.q && a.position.r === h.r);
  state.anthills = { ...(state.anthills || {}) };
  defs.forEach((d, di) => {
    const anchor = (d.near === 'enemy' ? leaderOf(state, otherId) : leaderOf(state, playerId)) || leaderOf(state, playerId);
    if (!anchor) return;
    const nodes = Object.values(state.resources)
      .filter(r => r.type === d.type && !hillAt(r.position))
      .sort((a, b) => hexDistance(a.position, anchor.position) - hexDistance(b.position, anchor.position))
      .slice(0, d.count ?? 1);
    if (nodes.length < (d.count ?? 1)) {
      console.warn(`campaign: only ${nodes.length} free ${d.type} node(s) for ${playerId}'s pre-built anthills`);
    }
    nodes.forEach((res, i) => {
      const hill = completeAnthill(
        createAnthillInProgress(res.id, playerId, res.position, res.type, 2),
        d.reinforced ?? reinforcedByUpgrade
      );
      hill.id = `camp_${playerId}_hill_${d.type}${di + 1}_${i + 1}`;
      state.anthills[hill.id] = hill;
    });
  });
}

function applySide(state, playerId, def, queenId) {
  const heroId = heroOf(state, playerId);
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
    // A pre-set higher tier starts at that tier's full energy.
    const tier = def?.queenTier || 'queen';
    const tierData = QueenTiers[tier];
    const energy = tier !== 'queen' && tierData ? { energy: tierData.maxEnergy, maxEnergy: tierData.maxEnergy } : {};
    const queen = { ...state.ants[oldQueenKey], id: queenId, queenTier: tier, ...energy };
    delete state.ants[oldQueenKey];
    state.ants[queenId] = queen;
  }

  if (def?.resources) {
    state.players[playerId].resources = { ...def.resources };
  }

  // Pre-granted upgrades, e.g. { burrow: 1, meleeAttack: 2 }, so a level can
  // open on its mechanic instead of after an economy phase to afford it.
  if (def?.upgrades) {
    state.players[playerId].upgrades = { ...state.players[playerId].upgrades, ...def.upgrades };
  }

  // Guards: units placed at offsets from the leader (queen or larva). Used for
  // levels that hand the player a fixed force instead of a queen to hatch one.
  if (Array.isArray(def?.guards)) {
    const leader = leaderOf(state, playerId);
    if (leader) {
      const free = h => isValidHex(h, state.gridRadius, state.mapShape) && !occupiedAt(state, h);
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
        const ant = createAnt(g.type, playerId, pos, heroId);
        ant.id = g.id || `camp_${playerId}_guard_${g.type}${i + 1}`;
        state.ants[ant.id] = ant;
      });
    }
  }

  // 'default' (or undefined) keeps the standard opening created by
  // createInitialGameState: 2 drones + 1 scout beside the queen.
  //
  // A list of type names (or { type, id } entries) swaps those opening units
  // slot-for-slot - e.g. ['spitter', 'scout', 'scout'] - keeping the hexes the
  // map chose, so a level can reshape the starting force without knowing
  // which side it spawned on. Explicit [{ type, at: {q, r}, id? }] placements
  // replace every non-leader unit on the side.
  const isSlotEntry = u => typeof u === 'string' || (u && typeof u === 'object' && !u.at);
  if (Array.isArray(def?.units) && def.units.every(isSlotEntry)) {
    // Only the map's own opening units (ant_p<n>_drone1 etc.) are slots - never
    // guards or anything else a level has already placed on this side.
    const slots = Object.values(state.ants)
      .filter(a => a.owner === playerId && a.id.startsWith('ant_p'))
      .sort((a, b) => a.id.localeCompare(b.id));
    slots.forEach(old => delete state.ants[old.id]);
    def.units.forEach((entry, i) => {
      const slot = slots[i];
      if (!slot) return; // more types than opening slots: use `guards` for extras
      const type = typeof entry === 'string' ? entry : entry.type;
      const ant = createAnt(type, playerId, slot.position, heroId);
      ant.id = (typeof entry === 'object' && entry.id) || `camp_${playerId}_${type}${i + 1}`;
      state.ants[ant.id] = ant;
    });
  } else if (Array.isArray(def?.units)) {
    Object.keys(state.ants).forEach(k => {
      if (state.ants[k].owner === playerId && !isLeader(state.ants[k])) delete state.ants[k];
    });
    def.units.forEach((u, i) => {
      const ant = createAnt(u.type, playerId, new HexCoord(u.at.q, u.at.r), heroId);
      ant.id = u.id || `camp_${playerId}_${u.type}${i + 1}`;
      state.ants[ant.id] = ant;
    });
  }

  // Last, so `reinforced` can read the merged upgrades.
  placeAnthills(state, playerId, def?.anthills);
}
