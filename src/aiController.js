import { AntTypes, GameConstants, getAntTypeById, meetsQueenTier } from './antTypes';
import { getMovementRange, getMovementRangeWithPaths, hexDistance, HexCoord, getNeighbors, isValidHex, hasMapWater } from './hexUtils';
import { moveAnt, canAttack } from './combatSystem';
import {
  canAfford,
  deductCost,
  createEgg,
  hasEnoughEnergy,
  getEggLayCost,
  getSpawningPoolHexes,
  buildAnthill,
  canAffordUpgrade,
  purchaseUpgrade,
  canAffordQueenUpgrade,
  upgradeQueen,
  deductEnergy,
  healAlly,
  activateHeroAbility
} from './gameState';

/** Drop any malformed ant entries (e.g. a dead unit re-inserted with only flags). */
export function sanitizeAnts(ants) {
  const clean = {};
  for (const [id, a] of Object.entries(ants || {})) {
    if (a && a.id && a.position && typeof a.position.q === 'number') clean[id] = a;
  }
  return clean;
}

/**
 * Helper function to compare hex positions
 */
function hexEquals(pos1, pos2) {
  if (!pos1 || !pos2) return false;
  return pos1.q === pos2.q && pos1.r === pos2.r;
}

/**
 * AI Controller for computer opponents
 * Difficulty levels: easy, medium, hard
 */

/**
 * Analyze game state to determine AI strategy
 */
function analyzeGameState(gameState, aiPlayer, difficulty) {
  const aiAnts = liveAnts(gameState).filter(ant => ant.owner === aiPlayer);
  const enemyAnts = liveAnts(gameState).filter(ant => ant.owner !== aiPlayer);

  const combatUnits = aiAnts.filter(ant =>
    ant.type !== 'queen' && ant.type !== 'drone' && ant.type !== 'healer'
  );
  const drones = aiAnts.filter(ant => ant.type === 'drone');
  const anthills = Object.values(gameState.anthills || {}).filter(h => h.owner === aiPlayer);

  const enemyCombatUnits = enemyAnts.filter(ant =>
    ant.type !== 'queen' && ant.type !== 'drone' && ant.type !== 'healer'
  );

  const armyStrength = combatUnits.length;
  const enemyArmyStrength = enemyCombatUnits.length;
  const economicPower = drones.length + anthills.length * 2;

  // Determine game phase
  let phase = 'early'; // early, mid, late
  if (gameState.turn > 15) phase = 'mid';
  if (gameState.turn > 30) phase = 'late';

  // Determine strategy
  let shouldAttack = false;
  let shouldExpand = true;
  let shouldDefend = false;

  if (phase === 'early') {
    // Early game: focus on economy and scouting, but attack if opportunity arises
    shouldExpand = true;
    shouldAttack = armyStrength >= 2; // Attack with any combat units
  } else if (phase === 'mid') {
    // Mid game: build army and expand
    shouldExpand = drones.length < 3 || anthills.length < 2;
    shouldAttack = armyStrength >= 2; // Attack with any combat units
  } else {
    // Late game: aggressive push
    shouldAttack = armyStrength >= 1; // Attack with any combat units
    shouldExpand = economicPower < 8;
  }

  // Check if under threat (enemy units near queen)
  const aiQueen = aiAnts.find(ant => ant.type === 'queen');
  if (aiQueen) {
    const threatsNearQueen = enemyAnts.filter(enemy =>
      hexDistance(enemy.position, aiQueen.position) <= 4
    );
    if (threatsNearQueen.length > 0) {
      shouldDefend = true;
      shouldAttack = false; // Pull back to defend
    }
  }

  return {
    phase,
    armyStrength,
    economicPower,
    shouldAttack,
    shouldExpand,
    shouldDefend,
    enemyArmyStrength
  };
}

// AI Difficulty configurations
const AI_CONFIG = {
  easy: {
    thinkTime: 500, // ms delay for moves (makes it feel more natural)
    gatherPriority: 0.7, // 70% focus on gathering
    combatPriority: 0.3, // 30% focus on combat
    buildAnthills: true,
    upgradeFrequency: 0.1, // Rarely upgrades
    unitMix: {
      scout: 0.25,
      drone: 0.35,
      soldier: 0.3,
      spitter: 0.1
    }
  },
  medium: {
    thinkTime: 300,
    gatherPriority: 0.5,
    combatPriority: 0.5,
    buildAnthills: true,
    upgradeFrequency: 0.6,
    unitMix: {
      scout: 0.1,
      drone: 0.25,
      soldier: 0.35,
      spitter: 0.2,
      healer: 0.1
    }
  },
  hard: {
    thinkTime: 200,
    gatherPriority: 0.4,
    combatPriority: 0.6,
    buildAnthills: true,
    upgradeFrequency: 1.0, // Always spends surplus rather than sitting on it
    unitMix: {
      // Drone-heavy early economy converts into a Marauder core; bombers and
      // bullet ants arrive once minerals allow.
      scout: 0.05,
      drone: 0.25,
      soldier: 0.3,
      spitter: 0.15,
      tank: 0.15,
      bomber: 0.1
    }
  }
};

/**
 * The difficulty config, with a campaign level's unit-mix override applied.
 * A level that sets enemy.unitMix gets a STRICT mix: the AI hatches only the
 * listed types, and the hardcoded "first scout" / "drone when no minerals"
 * rules in chooseUnitToProduce are skipped unless the mix allows that type.
 */
export function resolveAIConfig(gameState, difficulty) {
  const base = AI_CONFIG[difficulty] || AI_CONFIG.medium;
  const mix = gameState?.campaign?.enemyUnitMix;
  return mix ? { ...base, unitMix: mix, strictMix: true } : base;
}

/**
 * Campaign hunt target for the AI side, or null when the level has not set
 * enemy.hunt. `true` = the player's leader (queen or larva); 'unit:<id>' =
 * that unit while it lives, then the leader.
 */
export function huntTarget(state, aiPlayer) {
  const hunt = state?.campaign?.enemyHunts;
  if (!hunt) return null;
  const enemies = Object.values(state.ants || {}).filter(a => a.owner !== aiPlayer && a.position);
  if (typeof hunt === 'string' && hunt.startsWith('unit:')) {
    const unit = state.ants[hunt.slice(5)];
    if (unit && unit.owner !== aiPlayer && unit.position) return unit.position;
  }
  const leader = enemies.find(a => a.type === 'queen') || enemies.find(a => a.type === 'queenLarva');
  return leader ? leader.position : null;
}

/**
 * Main AI execution function
 * @param {Object} gameState - Current game state
 * @param {string} aiPlayer - AI player ID ('player1' or 'player2')
 * @param {string} difficulty - 'easy', 'medium', or 'hard'
 * @returns {Object} Object with gameState and movements array for animation
 */
export async function executeAITurn(gameState, aiPlayer, difficulty = 'easy') {
  try {
    const config = resolveAIConfig(gameState, difficulty);
    let state = { ...gameState, ants: sanitizeAnts(gameState.ants) };
    let movements = []; // Track all movements for animation
    let combatActions = []; // Track all combat actions for animation

    console.log(`AI (${aiPlayer}, ${difficulty}) starting turn ${state.turn}`);

    // DEBUG: Check what the AI can see
    const allAnts = Object.values(state.ants || {});
    const aiAnts = allAnts.filter(ant => ant.owner === aiPlayer);
    const aiQueen = aiAnts.find(ant => ant.type === 'queen');
    console.log(`AI sees ${allAnts.length} total ants, ${aiAnts.length} are mine`);
    console.log(`AI queen:`, aiQueen ? `found at (${aiQueen.position.q}, ${aiQueen.position.r})` : 'NOT FOUND');
    console.log(`AI resources:`, state.players?.[aiPlayer]?.resources);
    console.log(`AI eggs:`, Object.values(state.eggs || {}).filter(e => e.owner === aiPlayer).length);

    // DEBUG: Check movement flags at start of AI turn
    console.log('=== AI UNIT FLAGS AT START OF TURN ===');
    aiAnts.forEach(ant => {
      console.log(`${ant.id} (${ant.type}): hasMoved=${ant.hasMoved}, hasAttacked=${ant.hasAttacked}, hasBuilt=${ant.hasBuilt}`);
    });

    // Analyze game state to determine strategy
    const strategy = analyzeGameState(state, aiPlayer, difficulty);
    console.log(`AI strategy: ${strategy.phase}, army strength: ${strategy.armyStrength}, economic power: ${strategy.economicPower}`);

    // Wait a bit to make AI feel more natural
    await delay(config.thinkTime);

    // Phase 0: Fire the hero ability the moment it is charged.
    // Every ability either buffs this turn's movement, range and combat or
    // boosts the stockpile before it gets spent, so holding it back only wastes
    // charge. activateHeroAbility is a no-op when power is short or it is
    // already running, so calling unconditionally is safe.
    const beforeHero = state;
    state = activateHeroAbility(state, aiPlayer);
    if (state !== beforeHero) {
      console.log(`AI activated hero ability: ${state.players[aiPlayer]?.heroId}`);
    }

    // Phase 1: Hatch eggs
    state = hatchEggsIfReady(state, aiPlayer);

    // Phase 2: Move and use units (do this BEFORE laying eggs to free up spawn spots)
    const unitActionResult = performUnitActions(state, aiPlayer, config, strategy);
    state = unitActionResult.state;
    movements = unitActionResult.movements;
    combatActions = unitActionResult.combatActions || []; // Collect combat actions

    // Phase 3: Queen actions (lay eggs, heal) - now spawn spots are free
    state = performQueenActions(state, aiPlayer, config, strategy);

    // Phase 4: Consider upgrades
    if (Math.random() < config.upgradeFrequency) {
      state = considerUpgrades(state, aiPlayer);
    }

    console.log(`AI (${aiPlayer}) ending turn with ${movements.length} movements and ${combatActions.length} combat actions`);

    return { gameState: state, movements, combatActions };
  } catch (error) {
    console.error('AI turn error:', error);
    console.error('Error stack:', error.stack);
    // Return the original game state if AI fails
    return { gameState, movements: [], combatActions: [] };
  }
}

/**
 * Hatch any eggs that are ready
 */
function hatchEggsIfReady(gameState, aiPlayer) {
  const eggs = Object.values(gameState.eggs).filter(
    egg => egg.owner === aiPlayer && egg.turnsRemaining === 0
  );

  let state = { ...gameState };

  for (const egg of eggs) {
    // Skip eggs without a valid antType
    if (!egg.antType) {
      console.warn('Egg missing antType, skipping:', egg);
      continue;
    }

    // Create the ant
    const antId = `ant_ai_${Date.now()}_${Math.random()}`;
    const antType = getAntTypeById(egg.antType);

    state.ants[antId] = {
      id: antId,
      type: egg.antType,
      owner: aiPlayer,
      position: egg.position,
      health: antType.maxHealth,
      hasMoved: false,
      hasAttacked: false,
      energy: antType.startingEnergy !== undefined ? antType.startingEnergy : (antType.maxEnergy || 0),
      isBurrowed: false
    };

    // Remove egg
    delete state.eggs[egg.id];
  }

  return state;
}

/**
 * Queen actions: lay eggs, heal units
 */
function performQueenActions(gameState, aiPlayer, config, strategy) {
  let state = { ...gameState };
  let queen = Object.values(state.ants).find(
    ant => ant.type === 'queen' && ant.owner === aiPlayer
  );

  if (!queen) {
    console.log('No queen found, skipping queen actions');
    return state;
  }

  const playerState = state.players[aiPlayer];
  console.log('Queen actions - checking energy and resources:', {
    energy: queen.energy,
    resources: playerState.resources
  });

  // Get the energy cost to lay an egg
  const eggEnergyCost = getEggLayCost(queen);
  console.log('Egg energy cost:', eggEnergyCost);

  // Try to lay eggs if we have energy and spawn spots
  const hasEnergy = hasEnoughEnergy(queen, eggEnergyCost);
  console.log('Has enough energy to lay egg?', hasEnergy);

  let eggsLaid = 0;
  while (hasEnoughEnergy(queen, eggEnergyCost)) {
    // Get available spawning pool hexes (filter out occupied ones)
    const allSpawningHexes = getSpawningPoolHexes(queen, getNeighbors, gameState);
    const spawningPool = allSpawningHexes.filter(hex => {
      // Custom maps: a spawn spot beside void is not a spawn spot
      if (!isValidHex(hex, state.gridRadius || 6, state.mapShape || 'rectangle')) return false;
      const occupied = Object.values(state.ants).some(a => hexEquals(a.position, hex)) ||
                      Object.values(state.eggs).some(e => hexEquals(e.position, hex)) ||
                      Object.values(state.trees || {}).some(t => hexEquals(t.position, hex));
      return !occupied;
    });

    console.log(`Spawning pool has ${spawningPool.length} available spots`);

    // No spawn spots available
    if (spawningPool.length === 0) {
      console.log('No spawn spots available, breaking');
      break;
    }

    console.log('Egg energy cost (rechecking):', eggEnergyCost);

    // Decide what unit to produce based on difficulty AND strategy
    const unitType = chooseUnitToProduce(state, aiPlayer, config, strategy);
    if (!unitType) {
      console.log('Nothing in the unit mix is affordable, breaking');
      break;
    }
    const antTypeCost = getAntTypeById(unitType).cost;
    console.log(`Chosen unit type: ${unitType}, cost:`, antTypeCost);

    // Check if we can afford the ant type.
    //
    // Anthills cost food to start, and a drone standing on a node with no food in
    // the bank just idles there. Early on that is the whole game: minerals are the
    // scarce resource (3 nodes a side vs 5 food) and every combat unit needs them,
    // so a queen that spends the last food on units strands her own economy.
    // Hold back enough to fund the drones that are still looking for a node.
    const unclaimedDrones = Object.values(state.ants).filter(a =>
      a.owner === aiPlayer && a.type === 'drone'
    ).length;
    const buildReserve = state.turn <= 8
      ? Math.min(unclaimedDrones, 2) * GameConstants.ANTHILL_BUILD_COST
      : 0;
    // Read resources from `state`, not the turn-start `playerState` snapshot -
    // this loop lays several eggs and each one has already been deducted.
    const liveResources = state.players[aiPlayer].resources;
    const spendableFood = liveResources.food - buildReserve;

    if (spendableFood < antTypeCost.food || liveResources.minerals < antTypeCost.minerals) {
      console.log(`Holding ${buildReserve} food in reserve for anthills, cannot afford ${unitType}`);
      break;
    }

    // Choose spawn position (first available spot)
    const spawnPos = spawningPool[0];
    console.log('Laying egg at position:', spawnPos);

    // Create the egg
    const newEgg = createEgg(unitType, aiPlayer, spawnPos, state.turn);

    // Deduct resources from player
    const updatedPlayerResources = {
      food: liveResources.food - antTypeCost.food,
      minerals: liveResources.minerals - antTypeCost.minerals
    };

    // Deduct energy from queen
    const updatedQueen = {
      ...queen,
      energy: queen.energy - eggEnergyCost
    };

    // Update state
    state = {
      ...state,
      eggs: {
        ...state.eggs,
        [newEgg.id]: newEgg
      },
      players: {
        ...state.players,
        [aiPlayer]: {
          ...state.players[aiPlayer],
          resources: updatedPlayerResources
        }
      },
      ants: {
        ...state.ants,
        [queen.id]: updatedQueen
      }
    };

    // Update our local queen reference for the next iteration
    queen = updatedQueen;

    eggsLaid++;
    console.log(`Successfully laid egg #${eggsLaid}, queen energy now: ${updatedQueen.energy}`);
  }

  console.log(`Queen actions complete - laid ${eggsLaid} eggs`);
  return state;
}

/**
 * Is one more drone any use? A drone's only job is to raise an anthill on a
 * free resource node. This counts the free nodes on our side of the map
 * (nearer our queen than any enemy leader) and compares them with the drones
 * we already have spare - drones not in the middle of building, plus drone
 * eggs still to hatch. Without this check the AI kept hatching drones with
 * nothing to do: they wandered round the queen, stood on her egg spots, and
 * choked off everything else she could have hatched.
 */
export function anotherDroneIsUseful(gameState, aiPlayer) {
  const ants = liveAnts(gameState);
  const queen = findQueen(gameState, aiPlayer);
  if (!queen) return false;
  const enemyLeaders = ants.filter(a => a.owner !== aiPlayer && (a.type === 'queen' || a.type === 'queenLarva'));
  const anthills = Object.values(gameState.anthills || {});
  const hillAt = pos => anthills.find(h => hexEquals(h.position, pos));

  const freeNodes = Object.values(gameState.resources || {}).filter(node => {
    if (!node.position || hillAt(node.position)) return false;
    const toUs = hexDistance(node.position, queen.position);
    return enemyLeaders.every(l => toUs <= hexDistance(node.position, l.position));
  }).length;

  const spareDrones = ants.filter(a => {
    if (a.owner !== aiPlayer || a.type !== 'drone') return false;
    const hill = hillAt(a.position);
    return !(hill && hill.owner === aiPlayer && !hill.isComplete); // busy building
  }).length;
  const droneEggs = Object.values(gameState.eggs || {}).filter(e => e.owner === aiPlayer && e.antType === 'drone').length;

  return freeNodes > spareDrones + droneEggs;
}

/**
 * Choose which unit type to produce based on AI strategy
 */
export function chooseUnitToProduce(gameState, aiPlayer, config, strategy) {
  // The AI obeys the same queen-tier unlocks as a player. A campaign level's
  // strict mix is exempt: the level chose those units on purpose.
  if (!config.strictMix) {
    const aiQueen = Object.values(gameState.ants).find(a => a.type === 'queen' && a.owner === aiPlayer);
    const unlocked = Object.entries(config.unitMix)
      .filter(([type]) => meetsQueenTier(getAntTypeById(type)?.requiresQueenTier, aiQueen?.queenTier));
    config = { ...config, unitMix: Object.fromEntries(unlocked) };
  }
  const playerState = gameState.players[aiPlayer];
  const resources = playerState.resources;
  // Under a strict (campaign) mix the fixed opening rules only apply to types
  // the level actually allows.
  const allowed = type => !config.strictMix || !!config.unitMix[type];

  // Count current units
  const unitCounts = {};
  Object.values(gameState.ants).forEach(ant => {
    if (ant.owner === aiPlayer && ant.type !== 'queen') {
      unitCounts[ant.type] = (unitCounts[ant.type] || 0) + 1;
    }
  });

  const droneCount = unitCounts['drone'] || 0;
  const scoutCount = unitCounts['scout'] || 0;
  // Only hatch a drone when there is a free node for it to build on
  const droneUseful = anotherDroneIsUseful(gameState, aiPlayer);

  // Strategic unit production
  //
  // A scout costs 15 food - the bulk of the 25 the AI opens with - and cannot
  // build anthills. Buying one first left nothing to fund the two starting
  // drones, so they idled on nodes they could not claim. Vision is worth having,
  // just not before the economy exists: wait until minerals are coming in.
  const hasMineralIncome = Object.values(gameState.anthills || {}).some(
    h => h.owner === aiPlayer && h.resourceType === 'minerals' && h.isComplete
  );
  if (scoutCount === 0 && hasMineralIncome && AntTypes.SCOUT && allowed('scout') &&
      resources.food >= AntTypes.SCOUT.cost.food &&
      resources.minerals >= AntTypes.SCOUT.cost.minerals) {
    console.log('Building first scout for vision');
    return 'scout';
  }

  // Before minerals are online, more drones is the only play that improves the
  // position - every combat unit is gated behind mineral income.
  if (!hasMineralIncome && droneCount < 4 && droneUseful && allowed('drone') &&
      resources.food >= AntTypes.DRONE.cost.food) {
    console.log('No mineral income yet: building drone');
    return 'drone';
  }

  // Expansion phase: prioritize drones
  if (strategy.shouldExpand && droneCount < 4 && droneUseful && allowed('drone')) {
    if (resources.food >= AntTypes.DRONE.cost.food &&
        resources.minerals >= AntTypes.DRONE.cost.minerals) {
      console.log('Expansion: building drone');
      return 'drone';
    }
  }

  // Under attack or attacking: prioritize combat units
  if (strategy.shouldDefend || strategy.shouldAttack) {
    console.log('Combat mode: prioritizing combat units');
    // Favor combat units from the mix
    const combatUnitMix = {};
    for (const [type, weight] of Object.entries(config.unitMix)) {
      if (type !== 'drone' && type !== 'scout') {
        combatUnitMix[type] = weight * 2; // Double weight for combat units
      }
    }

    const affordableCombat = Object.entries(combatUnitMix)
      .filter(([type]) => {
        const antType = getAntTypeById(type);
        if (!antType) return false;
        return resources.food >= antType.cost.food && resources.minerals >= antType.cost.minerals;
      });

    if (affordableCombat.length > 0) {
      const totalWeight = affordableCombat.reduce((sum, [_, weight]) => sum + weight, 0);
      let random = Math.random() * totalWeight;

      for (const [type, weight] of affordableCombat) {
        random -= weight;
        if (random <= 0) {
          return type;
        }
      }
    }
  }

  // Default: use standard unit mix (leaving out drones that would have nothing to build)
  const affordableUnits = Object.entries(config.unitMix)
    .filter(([type]) => {
      if (type === 'drone' && !droneUseful) return false;
      const antType = getAntTypeById(type);
      if (!antType) return false;
      return resources.food >= antType.cost.food && resources.minerals >= antType.cost.minerals;
    });

  if (affordableUnits.length === 0) {
    // Fall back to scout if we can't afford anything else - unless the level
    // pinned the mix, in which case there is nothing to hatch this turn.
    return config.strictMix ? null : 'scout';
  }

  // Weighted random selection
  const totalWeight = affordableUnits.reduce((sum, [_, weight]) => sum + weight, 0);
  let random = Math.random() * totalWeight;

  for (const [type, weight] of affordableUnits) {
    random -= weight;
    if (random <= 0) {
      return type;
    }
  }

  return affordableUnits[0][0]; // Fallback
}

/**
 * Perform actions with all units.
 * Order matters: combat units act first (so drones move into space they clear),
 * then scouts, drones, healers.
 */
function performUnitActions(gameState, aiPlayer, config, strategy) {
  let state = { ...gameState };
  let movements = [];
  let combatActions = [];
  // Every move and attack gets a turn-wide sequence number so the animation
  // can replay them in the order they really happened. Without it the board
  // plays all moves then all attacks, and a unit that walked into a hex freed
  // by an earlier counter-kill appears to stack on the corpse.
  let seq = 0;
  const reservedNodes = new Set(); // resource nodes already claimed by a drone this turn

  const units = liveAnts(state).filter(a => a.owner === aiPlayer && a.type !== 'queen' && !a.hasMoved);
  const byType = t => units.filter(a => t.includes(a.type));
  const combat = units.filter(a => !['drone', 'scout', 'healer', 'cordyphage'].includes(a.type));
  const order = [...combat, ...byType(['scout']), ...byType(['drone']), ...byType(['healer', 'cordyphage'])];

  for (const snapshot of order) {
    const unit = state.ants[snapshot.id];
    if (!isLive(unit)) continue; // died to a counterattack earlier this turn
    let result;
    try {
      if (unit.type === 'drone') result = handleDroneUnit(state, unit, aiPlayer, config, reservedNodes);
      else if (unit.type === 'healer' || unit.type === 'cordyphage') result = handleHealerUnit(state, unit, aiPlayer);
      else result = handleCombatUnit(state, unit, aiPlayer, config, strategy);
    } catch (err) {
      console.error(`AI unit ${unit.id} (${unit.type}) errored, skipping:`, err);
      result = { state: markMoved(state, unit.id), movement: null };
    }
    state = result.state;
    if (result.movement) movements.push({ ...result.movement, seq: seq++ });
    if (result.combatAction) combatActions.push({ ...result.combatAction, seq: seq++ });
    if (state.gameOver) break;
  }
  return { state, movements, combatActions };
}

// ---------- shared helpers ----------

function isLive(ant) {
  return !!(ant && ant.id && ant.position && typeof ant.position.q === 'number');
}
function liveAnts(state) {
  return Object.values(state.ants || {}).filter(isLive);
}
function markMoved(state, antId) {
  const ant = state.ants[antId];
  if (!isLive(ant)) return state;
  return { ...state, ants: { ...state.ants, [antId]: { ...ant, hasMoved: true, hasAttacked: true } } };
}
function enemiesOf(state, aiPlayer) {
  const { areTeammates } = require('./combatSystem');
  return liveAnts(state).filter(a => a.owner !== aiPlayer && !areTeammates(state, aiPlayer, a.owner));
}
function findQueen(state, owner) {
  return liveAnts(state).find(a => a.type === 'queen' && a.owner === owner);
}

/**
 * On river and lake maps straight-line distance is misleading: a hex just
 * across the water looks close but is a long walk round. This returns a
 * function giving the real walking distance from any hex to `target`
 * (terrain only - other units are ignored), or null on maps without water.
 */
function walkingDistanceTo(state, target) {
  if (!hasMapWater(state.mapShape) || !target) return null;
  const gridRadius = state.gridRadius || 6;
  const key = h => `${h.q},${h.r}`;
  const start = new HexCoord(target.q, target.r);
  const dist = new Map([[key(start), 0]]);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    const d = dist.get(key(current));
    for (const n of getNeighbors(current)) {
      if (dist.has(key(n)) || !isValidHex(n, gridRadius, state.mapShape)) continue;
      dist.set(key(n), d + 1);
      queue.push(n);
    }
  }
  return h => (dist.has(key(h)) ? dist.get(key(h)) : hexDistance(h, target));
}

/** Hexes the unit could end its move on this turn, with paths (same rules as the human player). */
function reachableHexes(state, unit) {
  const { areTeammates } = require('./combatSystem');
  const antType = getAntTypeById(unit.type);
  if (!antType) return [];
  if (unit.ensnared && unit.ensnared > 0) return [];
  let range = antType.moveRange;
  if (unit.isBurrowed) { if (unit.type === 'soldier') range = 2; else return []; }
  const player = state.players[unit.owner];
  if (player?.heroAbilityActive && player?.heroId === 'gorlak' && antType.attackRange <= 1) range += 1;

  const others = liveAnts(state).filter(a => a.id !== unit.id);
  const blocked = others.filter(a => !areTeammates(state, a.owner, unit.owner))
    .map(a => new HexCoord(a.position.q, a.position.r));
  const cannotEnd = [
    ...others.filter(a => areTeammates(state, a.owner, unit.owner)).map(a => new HexCoord(a.position.q, a.position.r)),
    // No egg can be occupied, friendly or hostile - enemy eggs have to be
    // attacked, not walked over (a unit standing on one blocks it hatching).
    ...Object.values(state.eggs || {}).map(e => new HexCoord(e.position.q, e.position.r))
  ];
  const start = new HexCoord(unit.position.q, unit.position.r);
  return getMovementRangeWithPaths(start, range, state.gridRadius || 6, blocked, cannotEnd, state.mapShape || 'rectangle');
}

/** Enemies this unit could attack if it were standing on `hex` (after moving or not). */
function targetsFrom(state, unit, hex, enemies, moved) {
  const ghost = { ...unit, position: { q: hex.q, r: hex.r }, hasMoved: moved };
  return enemies.filter(e => canAttack(ghost, e, state));
}

/** How much we want to hit this target. Higher is better. */
function targetValue(state, unit, target) {
  const { calculateDamage } = require('./combatSystem');
  let dmg = 0;
  try { dmg = calculateDamage({ ...unit }, target, state) || 0; } catch (e) { dmg = 5; }
  let value = Math.min(dmg, target.health) * 1.0;
  if (dmg >= target.health) value += 25;            // a kill
  if (target.type === 'queen') value += 40;         // the win condition
  if (['spitter', 'bombardier', 'healer'].includes(target.type)) value += 6; // squishy high-value
  if (target.type === 'drone') value -= 3;
  return value;
}

function dangerAt(state, unit, hex, enemies) {
  // rough count of enemies that could reach and hit this hex next turn
  let danger = 0;
  for (const e of enemies) {
    const t = getAntTypeById(e.type);
    if (!t || t.attackRange === 0) continue;
    const reach = (t.moveRange || 0) + (t.attackRange || 0);
    if (hexDistance(hex, e.position) <= reach) danger += 1;
  }
  return danger;
}

function applyMove(state, unit, moveData) {
  const newState = moveAnt(state, unit.id, { q: moveData.hex.q, r: moveData.hex.r });
  newState.ants[unit.id] = { ...newState.ants[unit.id], hasMoved: true };
  return { state: newState, movement: { antId: unit.id, path: moveData.path.map(h => ({ q: h.q, r: h.r })) } };
}

function applyAttack(state, unitId, target) {
  const { resolveCombat } = require('./combatSystem');
  const attackResult = resolveCombat(state, unitId, target.id);
  let newState = attackResult.gameState;
  if (isLive(newState.ants[unitId])) {
    newState = { ...newState, ants: { ...newState.ants, [unitId]: { ...newState.ants[unitId], hasAttacked: true, hasMoved: true } } };
  }
  const combatAction = attackResult.attackAnimation ? {
    ...attackResult.attackAnimation,
    damageDealt: attackResult.damageDealt,
    timestamp: Date.now()
  } : null;
  newState.lastCombatAction = combatAction;
  return { state: newState, combatAction };
}

/**
 * Generic "move then attack" for anything that can fight.
 * Scores every reachable hex (and staying put) by the best attack available from it,
 * minus distance to the objective and danger. Picks the best, moves, attacks.
 */
function fightOrAdvance(state, unit, aiPlayer, objective, opts = {}) {
  const enemies = enemiesOf(state, aiPlayer);
  const antType = getAntTypeById(unit.type);
  const caution = opts.caution ?? 1;      // how much danger matters
  const advance = opts.advance ?? 1;      // how much closing distance matters

  const stayHere = { hex: { q: unit.position.q, r: unit.position.r }, path: [], stay: true };
  const options = [stayHere, ...reachableHexes(state, unit)];

  // Enemy eggs are targets too. An egg has 10 HP and no armour, and breaking
  // one denies a whole unit, so a Scout - the raider - prefers an egg over a
  // chip on the queen (+40); a heavier unit still takes the queen, and a
  // queen KILL beats everything.
  const enemyEggs = Object.values(state.eggs || {}).filter(e => e.owner !== aiPlayer && e.position);
  const eggValue = unit.type === 'scout' ? 55 : 30;
  const canHitEggs = antType.attackRange > 0 && unit.type !== 'bomber' &&
    (!unit.isBurrowed || unit.type === 'soldier');
  const minRange = antType.minAttackRange || 1;

  const walkTo = walkingDistanceTo(state, objective); // null unless this map has water

  let best = null;
  for (const opt of options) {
    const moved = !opt.stay;
    // Bombardiers (cannotMoveAndAttack) can't attack after moving; canAttack handles hasMoved.
    const targets = antType.attackRange > 0 && unit.type !== 'bomber'
      ? targetsFrom(state, unit, opt.hex, enemies, moved) : [];
    let bestTarget = null, bestTV = -Infinity;
    for (const t of targets) {
      const v = targetValue(state, unit, t);
      if (v > bestTV) { bestTV = v; bestTarget = t; }
    }
    if (canHitEggs && !(antType.cannotMoveAndAttack && moved) && eggValue > bestTV) {
      const egg = enemyEggs.find(e => {
        const d = hexDistance(opt.hex, e.position);
        return d >= minRange && d <= antType.attackRange;
      });
      if (egg) { bestTV = eggValue; bestTarget = { egg: true, id: egg.id }; }
    }
    const dist = objective ? (walkTo ? walkTo(opt.hex) : hexDistance(opt.hex, objective)) : 0;
    const danger = dangerAt(state, unit, opt.hex, enemies);
    let score = (bestTarget ? 20 + bestTV : 0) - dist * 2 * advance - danger * 3 * caution;
    if (opt.stay && !bestTarget) score -= 1; // slight nudge to keep moving
    if (opts.avoid && opts.avoid(opt.hex)) score -= 40; // hexes this unit should keep clear of
    if (best === null || score > best.score) best = { opt, score, target: bestTarget };
  }

  let newState = state, movement = null, combatAction = null;
  if (best && !best.opt.stay) {
    const r = applyMove(newState, unit, best.opt);
    newState = r.state; movement = r.movement;
  } else {
    newState = { ...newState, ants: { ...newState.ants, [unit.id]: { ...newState.ants[unit.id], hasMoved: true } } };
  }
  if (best && best.target && best.target.egg && isLive(newState.ants[unit.id]) && newState.eggs?.[best.target.id]) {
    const { attackEgg } = require('./combatSystem');
    const r = attackEgg(newState, unit.id, best.target.id);
    newState = {
      ...r.gameState,
      ants: { ...r.gameState.ants, [unit.id]: { ...r.gameState.ants[unit.id], hasAttacked: true, hasMoved: true } }
    };
    combatAction = r.attackAnimation
      ? { ...r.attackAnimation, damageDealt: r.damageDealt, timestamp: Date.now() }
      : null;
  } else if (best && best.target && !best.target.egg && isLive(newState.ants[unit.id]) && isLive(newState.ants[best.target.id])) {
    const r = applyAttack(newState, unit.id, newState.ants[best.target.id]);
    newState = r.state; combatAction = r.combatAction;
  }
  return { state: newState, movement, combatAction };
}

/**
 * Drones: claim resource nodes and build anthills on them (the real economy).
 */
function handleDroneUnit(gameState, drone, aiPlayer, config, reservedNodes) {
  let state = { ...gameState };
  const nodes = Object.entries(state.resources || {});
  const anthillAt = pos => Object.values(state.anthills || {}).find(h => hexEquals(h.position, pos));
  const enemies = enemiesOf(state, aiPlayer);

  // Standing on a node? Build / keep building.
  const here = nodes.find(([, r]) => hexEquals(r.position, drone.position));
  if (here) {
    const [resourceId, res] = here;
    const hill = anthillAt(res.position);
    const ours = hill && hill.owner === aiPlayer;
    if (!hill || (ours && !hill.isComplete)) {
      if (config.buildAnthills) {
        const food = state.players[aiPlayer].resources.food;
        if (hill || food >= GameConstants.ANTHILL_BUILD_COST) {
          const built = buildAnthill(state, drone.id, resourceId);
          if (built !== state) return { state: built, movement: null };
        }
      }
      // Can't afford yet: hold the node.
      return { state: markMoved(state, drone.id), movement: null };
    }
    // Node already has a finished anthill (ours or theirs): go find another.
  }

  // Pick the best unclaimed node (no anthill, not reserved by another drone this turn).
  //
  // Resource type matters more than distance early on. Scouts and drones are the
  // only units costing no minerals, so an AI with no mineral anthill literally
  // cannot build anything else - it will spam scouts all game no matter how much
  // food it banks. Claiming a mineral node is what unlocks the combat roster, so
  // it outweighs a few hexes of walking until the income exists.
  const mineralIncome = Object.values(state.anthills || {})
    .some(h => h.owner === aiPlayer && h.resourceType === 'minerals' && h.isComplete);
  const free = nodes.filter(([id, r]) => !anthillAt(r.position) && !reservedNodes.has(id));
  const walkFromDrone = walkingDistanceTo(state, drone.position); // null unless this map has water
  let target = null, bestD = Infinity;
  for (const [id, r] of free) {
    const d = walkFromDrone ? walkFromDrone(r.position) : hexDistance(drone.position, r.position);
    const threat = dangerAt(state, drone, r.position, enemies);
    const mineralBonus = (!mineralIncome && r.type === 'minerals') ? 12 : 0;
    const cost = d + threat * 2 - mineralBonus;
    if (cost < bestD) { bestD = cost; target = { id, res: r }; }
  }
  if (target) {
    reservedNodes.add(target.id);
    return fightOrAdvance(state, drone, aiPlayer, target.res.position, { caution: 2, advance: 1.5 });
  }
  // Nothing to build: fall back near our queen and stay out of trouble - but
  // never on her egg-laying spots. A drone parked on one stops her hatching there.
  const queen = findQueen(state, aiPlayer);
  const eggSpots = queen ? getSpawningPoolHexes(queen, getNeighbors, state) : [];
  const onEggSpot = hex => eggSpots.some(spot => hexEquals(spot, hex));
  return fightOrAdvance(state, drone, aiPlayer, queen ? queen.position : drone.position, { caution: 3, avoid: onEggSpot });
}

/**
 * Combat units (and scouts): defend the queen when threatened, otherwise
 * push toward the enemy queen, attacking anything on the way.
 */
function handleCombatUnit(gameState, unit, aiPlayer, config, strategy) {
  const state = { ...gameState };
  const enemies = enemiesOf(state, aiPlayer);
  const myQueen = findQueen(state, aiPlayer);
  // A campaign Queen Larva is the enemy's heart when it has no queen
  const enemyQueen = enemies.find(a => a.type === 'queen') || enemies.find(a => a.type === 'queenLarva');

  // Bombers: walk into the enemy and detonate when adjacent to two or more (or the queen).
  if (unit.type === 'bomber') return handleBomber(state, unit, aiPlayer, enemies, enemyQueen);

  // Campaign hunt: the level wants this side to go for the player's Queen
  // Larva. She is immobile and defenceless, so skip the defend-first instinct
  // that otherwise keeps units at home on a small map. Scouts still scout.
  // (A level can opt its scouts in too with enemy.huntWithScouts - used where
  // scouts are the only fighters the enemy has.)
  const hunt = huntTarget(gameState, aiPlayer);
  if (hunt && (unit.type !== 'scout' || gameState.campaign?.enemyHuntsWithScouts)) {
    return fightOrAdvance(state, unit, aiPlayer, hunt, { caution: 0.4, advance: 1.6 });
  }

  let objective, opts = {};
  const threats = myQueen ? enemies.filter(e => hexDistance(e.position, myQueen.position) <= 4) : [];
  if (threats.length > 0 && myQueen && hexDistance(unit.position, myQueen.position) <= 7) {
    // Defend: nearest threat to our queen
    objective = threats.reduce((a, b) => hexDistance(a.position, myQueen.position) <= hexDistance(b.position, myQueen.position) ? a : b).position;
    opts = { caution: 0.5, advance: 1.5 };
  } else if (strategy.shouldAttack || strategy.phase !== 'early') {
    // Attack: enemy queen if known, else the nearest enemy, else the far side of the map
    const nearest = enemies.length ? enemies.reduce((a, b) => hexDistance(a.position, unit.position) <= hexDistance(b.position, unit.position) ? a : b) : null;
    objective = enemyQueen ? enemyQueen.position : (nearest ? nearest.position : { q: 0, r: -(myQueen ? myQueen.position.r : 0) });
    opts = unit.type === 'scout' ? { caution: 1.5, advance: 1 } : { caution: 0.7, advance: 1 };
  } else {
    // Early game: rally between our queen and the middle so we don't trickle in one at a time
    const rally = myQueen ? { q: Math.round(myQueen.position.q / 2), r: Math.round(myQueen.position.r / 2) } : { q: 0, r: 0 };
    objective = rally;
    opts = { caution: 1, advance: 0.7 };
  }
  return fightOrAdvance(state, unit, aiPlayer, objective, opts);
}

function handleBomber(state, bomber, aiPlayer, enemies, enemyQueen) {
  const { detonateBomber } = require('./combatSystem');
  const adjacentEnemies = hex => enemies.filter(e => hexDistance(e.position, hex) <= 1);
  const worth = hex => {
    const adj = adjacentEnemies(hex);
    return adj.length + (adj.some(e => e.type === 'queen') ? 3 : 0);
  };
  // Best hex to be on when we blow up
  const options = [{ hex: { q: bomber.position.q, r: bomber.position.r }, path: [], stay: true }, ...reachableHexes(state, bomber)];
  let best = options[0], bestW = worth(best.hex);
  for (const o of options) { const w = worth(o.hex); if (w > bestW) { bestW = w; best = o; } }
  let newState = state, movement = null;
  if (bestW >= 2) {
    if (!best.stay) { const r = applyMove(newState, bomber, best); newState = r.state; movement = r.movement; }
    const boom = detonateBomber(newState, bomber.id);
    newState = boom.gameState || boom;
    const combatAction = {
      attackerId: bomber.id,
      targetPosition: best.hex,
      isRanged: false,
      isDetonation: true,
      damageDealt: boom.damageDealt || [],
      timestamp: Date.now()
    };
    return { state: newState, movement, combatAction };
  }
  const objective = enemyQueen ? enemyQueen.position : (enemies[0] ? enemies[0].position : bomber.position);
  return fightOrAdvance(state, bomber, aiPlayer, objective, { caution: 0.3 });
}

/**
 * Healers: heal the most injured adjacent ally, otherwise shadow the army.
 */
function handleHealerUnit(gameState, healer, aiPlayer) {
  let state = { ...gameState };
  const allies = liveAnts(state).filter(a => a.owner === aiPlayer && a.id !== healer.id);
  const injured = allies.filter(a => a.health < (getAntTypeById(a.type)?.maxHealth || 0));

  const tryHeal = st => {
    if (healer.type !== 'healer') return null;
    const me = st.ants[healer.id];
    const adj = injured.filter(a => hexDistance(me.position, a.position) <= 1)
      .sort((a, b) => a.health - b.health);
    for (const target of adj) {
      const healed = healAlly(st, healer.id, target.id);
      if (healed !== st) return healed;
    }
    return null;
  };

  const healedNow = tryHeal(state);
  if (healedNow) return { state: markMoved(healedNow, healer.id), movement: null };

  // Move toward the most injured ally, or the nearest combat unit, staying behind it.
  let objective;
  if (injured.length) objective = injured.reduce((a, b) => a.health <= b.health ? a : b).position;
  else {
    const fighters = allies.filter(a => !['drone', 'queen'].includes(a.type));
    const near = fighters.length ? fighters.reduce((a, b) => hexDistance(a.position, healer.position) <= hexDistance(b.position, healer.position) ? a : b) : findQueen(state, aiPlayer);
    objective = near ? near.position : healer.position;
  }
  const r = fightOrAdvance(state, healer, aiPlayer, objective, { caution: 2, advance: 1.2 });
  const healedAfter = tryHeal(r.state);
  if (healedAfter) r.state = markMoved(healedAfter, healer.id);
  return r;
}

/**
 * Consider purchasing upgrades
 */
function considerUpgrades(gameState, aiPlayer) {
  let state = { ...gameState };
  const playerState = state.players[aiPlayer];
  const queen = Object.values(state.ants).find(
    a => a.type === 'queen' && a.owner === aiPlayer
  );
  if (!queen) return state;

  // Upgrading the queen unlocks spawn spots, energy and income, and gates the
  // support units - it outvalues any single stat upgrade, so try it first.
  if (canAffordQueenUpgrade(state, queen.id)) {
    const upgraded = upgradeQueen(state, queen.id);
    if (upgraded !== state) {
      console.log(`AI upgraded queen from ${queen.queenTier || 'queen'}`);
      return upgraded;
    }
  }

  // Prioritize upgrades: melee attack > defense > ranged attack > cannibalism
  const upgradePriority = ['meleeAttack', 'defense', 'rangedAttack', 'cannibalism'];

  for (const upgradeId of upgradePriority) {
    // canAffordUpgrade takes (player, upgradeId, queen) and returns a boolean;
    // purchaseUpgrade acts on gameState.currentPlayer and returns a gameState.
    if (!canAffordUpgrade(playerState, upgradeId, queen)) continue;

    const asAiTurn = { ...state, currentPlayer: aiPlayer };
    const result = purchaseUpgrade(asAiTurn, upgradeId);
    if (result !== asAiTurn) {
      console.log(`AI purchased upgrade: ${upgradeId}`);
      // Restore whoever's turn it actually is
      return { ...result, currentPlayer: state.currentPlayer };
    }
  }

  return state;
}

// ============ UTILITY FUNCTIONS ============

/**
 * Find nearest resource node to a position
 */
function findNearestResource(gameState, position, aiPlayer) {
  const resources = Object.values(gameState.resources);
  if (resources.length === 0) return null;

  return resources.reduce((nearest, resource) => {
    const dist = hexDistance(position, resource.position);
    const nearestDist = hexDistance(position, nearest.position);
    return dist < nearestDist ? resource : nearest;
  });
}

/**
 * Find nearest MINERAL resource node (for building anthills)
 */
function findNearestMineralResource(gameState, position, aiPlayer) {
  const mineralResources = Object.values(gameState.resources).filter(res => res.type === 'minerals');
  if (mineralResources.length === 0) return null;

  return mineralResources.reduce((nearest, resource) => {
    const dist = hexDistance(position, resource.position);
    const nearestDist = hexDistance(position, nearest.position);
    return dist < nearestDist ? resource : nearest;
  });
}

/**
 * Find enemies in attack range of a unit
 */
function findEnemiesInRange(gameState, unit, aiPlayer) {
  const antType = getAntTypeById(unit.type);
  const attackRange = antType.attackRange;

  return Object.values(gameState.ants).filter(ant => {
    if (!ant || !ant.position) return false; // skip malformed entries
    if (ant.owner === aiPlayer) return false; // Not an enemy
    if (ant.isBurrowed) return false; // Can't see burrowed units (simplified)

    const distance = hexDistance(unit.position, ant.position);
    return distance <= attackRange;
  });
}

/**
 * Move a unit toward a target position
 * @returns {Object} Object with state and optional movement data for animation
 */
function moveUnitToward(gameState, unit, targetPos) {
  let state = { ...gameState };

  console.log(`moveUnitToward: ${unit.id} from (${unit.position.q}, ${unit.position.r}) toward (${targetPos.q}, ${targetPos.r})`);

  // Check if unit is ensnared - if so, cannot move
  if (unit.ensnared && unit.ensnared > 0) {
    console.log(`Unit ${unit.id} is ensnared (${unit.ensnared} turns remaining), cannot move`);
    state.ants[unit.id] = { ...unit, hasMoved: true };
    return { state, movement: null };
  }

  // Get valid movement range with paths (all ants and eggs block movement)
  const antType = getAntTypeById(unit.type);
  const gridRadius = state.gridRadius || 6;

  // Block hexes with other ants (both enemy and friendly)
  const antHexes = Object.values(state.ants)
    .filter(ant => ant.id !== unit.id) // Don't block own position
    .map(ant => new HexCoord(ant.position.q, ant.position.r));

  // Block hexes with eggs
  const eggHexes = Object.values(state.eggs || {})
    .map(egg => new HexCoord(egg.position.q, egg.position.r));

  // Block hexes with trees
  const treeHexes = Object.values(state.trees || {})
    .map(tree => new HexCoord(tree.position.q, tree.position.r));

  // Combine all blocked hexes
  const blockedHexes = [...antHexes, ...eggHexes, ...treeHexes];

  const startHex = new HexCoord(unit.position.q, unit.position.r);
  // Pass the map shape so custom (masked) maps and square/triangle maps bound
  // the search correctly - previously omitted, which defaulted to a hexagon.
  const movesWithPaths = getMovementRangeWithPaths(startHex, antType.moveRange, gridRadius, blockedHexes, [], state.mapShape || 'rectangle');
  console.log(`Move range has ${movesWithPaths.length} hexes with valid paths`);

  if (movesWithPaths.length === 0) {
    // Can't move, mark as moved
    console.log(`No valid moves, marking as moved`);
    state.ants[unit.id] = { ...unit, hasMoved: true };
    return { state, movement: null };
  }

  // Find the hex in movement range that's closest to target
  const bestMoveData = movesWithPaths.reduce((best, item) => {
    const distToTarget = hexDistance(item.hex, targetPos);
    const bestDistToTarget = hexDistance(best.hex, targetPos);
    return distToTarget < bestDistToTarget ? item : best;
  });

  console.log(`Best move: (${bestMoveData.hex.q}, ${bestMoveData.hex.r})`);

  // Move to that position (moveAnt returns the updated game state directly)
  const newState = moveAnt(state, unit.id, bestMoveData.hex);

  // Verify the move succeeded by checking if position changed
  if (newState.ants[unit.id] &&
      (newState.ants[unit.id].position.q !== unit.position.q ||
       newState.ants[unit.id].position.r !== unit.position.r)) {
    console.log(`Unit moved successfully to (${newState.ants[unit.id].position.q}, ${newState.ants[unit.id].position.r})`);

    // Return state with movement data for animation
    return {
      state: newState,
      movement: {
        antId: unit.id,
        path: bestMoveData.path // This is the path array from getMovementRangeWithPaths
      }
    };
  }

  // Failed to move, mark as moved
  console.log(`Move failed, marking as moved`);
  state.ants[unit.id] = { ...unit, hasMoved: true };
  return { state, movement: null };
}

/**
 * Delay helper for AI think time
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const AIDifficulty = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard'
};
