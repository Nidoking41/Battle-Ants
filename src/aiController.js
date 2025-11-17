import { AntTypes, GameConstants } from './antTypes';
import { getMovementRange, getMovementRangeWithPaths, hexDistance, HexCoord, getNeighbors } from './hexUtils';
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
  deductEnergy
} from './gameState';

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
  const aiAnts = Object.values(gameState.ants).filter(ant => ant.owner === aiPlayer);
  const enemyAnts = Object.values(gameState.ants).filter(ant => ant.owner !== aiPlayer);

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
    // Early game: focus on economy and scouting
    shouldExpand = true;
    shouldAttack = false;
  } else if (phase === 'mid') {
    // Mid game: build army and expand
    shouldExpand = drones.length < 3 || anthills.length < 2;
    shouldAttack = armyStrength > enemyArmyStrength + 3; // Only attack if significant advantage
  } else {
    // Late game: aggressive push
    shouldAttack = armyStrength >= 5; // Attack with decent army
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
    buildAnthills: false, // Don't build anthills
    upgradeFrequency: 0.1, // Rarely upgrades
    unitMix: {
      scout: 0.5,
      drone: 0.4,
      soldier: 0.1
    }
  },
  medium: {
    thinkTime: 300,
    gatherPriority: 0.5,
    combatPriority: 0.5,
    buildAnthills: true,
    upgradeFrequency: 0.3,
    unitMix: {
      scout: 0.2,
      drone: 0.3,
      soldier: 0.3,
      spitter: 0.2
    }
  },
  hard: {
    thinkTime: 200,
    gatherPriority: 0.4,
    combatPriority: 0.6,
    buildAnthills: true,
    upgradeFrequency: 0.5,
    unitMix: {
      scout: 0.15,
      drone: 0.2,
      soldier: 0.25,
      spitter: 0.2,
      tank: 0.1,
      bomber: 0.1
    }
  }
};

/**
 * Main AI execution function
 * @param {Object} gameState - Current game state
 * @param {string} aiPlayer - AI player ID ('player1' or 'player2')
 * @param {string} difficulty - 'easy', 'medium', or 'hard'
 * @returns {Object} Updated game state after AI turn
 */
export async function executeAITurn(gameState, aiPlayer, difficulty = 'easy') {
  const config = AI_CONFIG[difficulty];
  let state = { ...gameState };

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

  // Phase 1: Hatch eggs
  state = hatchEggsIfReady(state, aiPlayer);

  // Phase 2: Move and use units (do this BEFORE laying eggs to free up spawn spots)
  state = performUnitActions(state, aiPlayer, config, strategy);

  // Phase 3: Queen actions (lay eggs, heal) - now spawn spots are free
  state = performQueenActions(state, aiPlayer, config, strategy);

  // Phase 4: Consider upgrades
  if (Math.random() < config.upgradeFrequency) {
    state = considerUpgrades(state, aiPlayer);
  }

  console.log(`AI (${aiPlayer}) ending turn`);

  return state;
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
    // Create the ant
    const antId = `ant_ai_${Date.now()}_${Math.random()}`;
    const antType = AntTypes[egg.antType.toUpperCase()];

    state.ants[antId] = {
      id: antId,
      type: egg.antType,
      owner: aiPlayer,
      position: egg.position,
      health: antType.maxHealth,
      hasMoved: false,
      hasAttacked: false,
      energy: antType.maxEnergy || 0,
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
    const allSpawningHexes = getSpawningPoolHexes(queen, getNeighbors);
    const spawningPool = allSpawningHexes.filter(hex => {
      const occupied = Object.values(state.ants).some(a => hexEquals(a.position, hex)) ||
                      Object.values(state.eggs).some(e => hexEquals(e.position, hex));
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
    const antTypeCost = AntTypes[unitType.toUpperCase()].cost;
    console.log(`Chosen unit type: ${unitType}, cost:`, antTypeCost);

    // Check if we can afford the ant type
    if (playerState.resources.food < antTypeCost.food || playerState.resources.minerals < antTypeCost.minerals) {
      console.log('Cannot afford unit type, breaking');
      break;
    }

    // Choose spawn position (first available spot)
    const spawnPos = spawningPool[0];
    console.log('Laying egg at position:', spawnPos);

    // Create the egg
    const newEgg = createEgg(unitType, aiPlayer, spawnPos, state.turn);

    // Deduct resources from player
    const updatedPlayerResources = {
      food: playerState.resources.food - antTypeCost.food,
      minerals: playerState.resources.minerals - antTypeCost.minerals
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
          ...playerState,
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
 * Choose which unit type to produce based on AI strategy
 */
function chooseUnitToProduce(gameState, aiPlayer, config, strategy) {
  const playerState = gameState.players[aiPlayer];
  const resources = playerState.resources;

  // Count current units
  const unitCounts = {};
  Object.values(gameState.ants).forEach(ant => {
    if (ant.owner === aiPlayer && ant.type !== 'queen') {
      unitCounts[ant.type] = (unitCounts[ant.type] || 0) + 1;
    }
  });

  const droneCount = unitCounts['drone'] || 0;
  const scoutCount = unitCounts['scout'] || 0;

  // Strategic unit production
  // Always need at least 1 scout for vision
  if (scoutCount === 0 && AntTypes.SCOUT &&
      resources.food >= AntTypes.SCOUT.cost.food &&
      resources.minerals >= AntTypes.SCOUT.cost.minerals) {
    console.log('Building first scout for vision');
    return 'scout';
  }

  // Expansion phase: prioritize drones
  if (strategy.shouldExpand && droneCount < 4) {
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
        const antType = AntTypes[type.toUpperCase()];
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

  // Default: use standard unit mix
  const affordableUnits = Object.entries(config.unitMix)
    .filter(([type]) => {
      const antType = AntTypes[type.toUpperCase()];
      if (!antType) return false;
      return resources.food >= antType.cost.food && resources.minerals >= antType.cost.minerals;
    });

  if (affordableUnits.length === 0) {
    // Fall back to scout if we can't afford anything else
    return 'scout';
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
 * Perform actions with all units
 */
function performUnitActions(gameState, aiPlayer, config, strategy) {
  let state = { ...gameState };

  // Get all AI units
  const aiUnits = Object.values(state.ants)
    .filter(ant => ant.owner === aiPlayer && ant.type !== 'queen' && !ant.hasMoved);

  console.log(`AI has ${aiUnits.length} units that haven't moved yet`);

  // Categorize units
  const drones = aiUnits.filter(ant => ant.type === 'drone');
  const scouts = aiUnits.filter(ant => ant.type === 'scout');
  const combatUnits = aiUnits.filter(ant =>
    ant.type !== 'drone' && ant.type !== 'healer' && ant.type !== 'scout'
  );
  const healers = aiUnits.filter(ant => ant.type === 'healer');

  console.log(`Unit breakdown: ${drones.length} drones, ${scouts.length} scouts, ${combatUnits.length} combat, ${healers.length} healers`);

  // Handle drones (gathering and building)
  for (const drone of drones) {
    console.log(`Handling drone at (${drone.position.q}, ${drone.position.r})`);
    state = handleDroneUnit(state, drone, aiPlayer, config);
  }

  // Handle scouts (exploration)
  for (const scout of scouts) {
    console.log(`Handling scout at (${scout.position.q}, ${scout.position.r})`);
    state = handleScoutUnit(state, scout, aiPlayer, strategy);
  }

  // Handle combat units with strategy
  for (const unit of combatUnits) {
    console.log(`Handling ${unit.type} at (${unit.position.q}, ${unit.position.r})`);
    state = handleCombatUnit(state, unit, aiPlayer, config, strategy);
  }

  // Handle healers
  for (const healer of healers) {
    console.log(`Handling healer at (${healer.position.q}, ${healer.position.r})`);
    state = handleHealerUnit(state, healer, aiPlayer);
  }

  console.log('Unit actions complete');
  return state;
}

/**
 * Handle drone actions (gather resources, build anthills)
 */
function handleDroneUnit(gameState, drone, aiPlayer, config) {
  let state = { ...gameState };

  console.log(`Drone ${drone.id}: checking position (${drone.position.q}, ${drone.position.r})`);

  // Check if we're already on a resource node
  const resourceAtPos = Object.values(state.resources).find(
    res => res.position.q === drone.position.q && res.position.r === drone.position.r
  );

  if (resourceAtPos) {
    console.log(`Drone is on ${resourceAtPos.type} resource`);
    // Check if there's an anthill being built here
    const anthillAtPos = Object.values(state.anthills || {}).find(
      hill => hill.position.q === drone.position.q &&
              hill.position.r === drone.position.r &&
              hill.owner === aiPlayer
    );

    // Try to build anthill if config allows, no anthill exists, and it's a MINERAL node
    if (config.buildAnthills && !anthillAtPos && resourceAtPos.type === 'minerals') {
      console.log(`Attempting to build anthill at mineral node`);
      // Find the resource ID
      const resourceId = Object.keys(state.resources).find(
        id => state.resources[id].position.q === resourceAtPos.position.q &&
              state.resources[id].position.r === resourceAtPos.position.r
      );
      if (resourceId) {
        const newState = buildAnthill(state, drone.id, resourceId);
        // buildAnthill returns the new state directly, check if anthill was added
        if (Object.keys(newState.anthills || {}).length > Object.keys(state.anthills || {}).length) {
          console.log(`AI drone building anthill at mineral node (${resourceAtPos.position.q}, ${resourceAtPos.position.r})`);
          return newState;
        } else {
          console.log(`Failed to build anthill - drone may have already built this turn`);
        }
      }
    }

    // Gather resources (mark as moved)
    console.log(`Drone gathering resources (marking as moved)`);
    state.ants[drone.id] = { ...drone, hasMoved: true };
    return state;
  }

  // Find nearest MINERAL resource node for building anthills (prioritize minerals over food)
  const targetResource = findNearestMineralResource(state, drone.position, aiPlayer) ||
                         findNearestResource(state, drone.position, aiPlayer);

  if (targetResource) {
    console.log(`Drone moving toward resource at (${targetResource.position.q}, ${targetResource.position.r})`);
    // Move toward resource
    state = moveUnitToward(state, drone, targetResource.position);
  } else {
    console.log(`Drone found no target resource`);
  }

  return state;
}

/**
 * Handle combat unit actions (attack enemies, move toward enemy base or defend)
 */
function handleCombatUnit(gameState, unit, aiPlayer, config, strategy) {
  let state = { ...gameState };

  // Find enemies in range
  const enemiesInRange = findEnemiesInRange(state, unit, aiPlayer);

  if (enemiesInRange.length > 0) {
    // Attack the highest priority enemy (queen > other units)
    let target = enemiesInRange.find(e => e.type === 'queen') ||
                 enemiesInRange.reduce((weakest, enemy) =>
                   enemy.health < weakest.health ? enemy : weakest
                 );

    const attackResult = canAttack(state, unit.id, target.id);
    if (attackResult.canAttack) {
      // Perform attack
      state = attackResult.gameState;
      return state;
    }
  }

  const aiQueen = Object.values(state.ants).find(
    ant => ant.type === 'queen' && ant.owner === aiPlayer
  );

  // Strategic movement based on game state
  if (strategy.shouldDefend && aiQueen) {
    // Defend mode: move toward our queen
    const distanceToQueen = hexDistance(unit.position, aiQueen.position);
    if (distanceToQueen > 3) {
      state = moveUnitToward(state, unit, aiQueen.position);
    } else {
      // Already in defensive position, stay put
      state.ants[unit.id] = { ...unit, hasMoved: true };
    }
  } else if (strategy.shouldAttack) {
    // Attack mode: move toward enemy queen
    const enemyQueen = Object.values(state.ants).find(
      ant => ant.type === 'queen' && ant.owner !== aiPlayer
    );

    if (enemyQueen) {
      state = moveUnitToward(state, unit, enemyQueen.position);
    }
  } else {
    // Build up army: stay near queen but not blocking spawning
    if (aiQueen) {
      const distanceToQueen = hexDistance(unit.position, aiQueen.position);
      if (distanceToQueen <= 2) {
        // Too close to queen, move away slightly
        const awayfromQueen = {
          q: unit.position.q + (unit.position.q - aiQueen.position.q),
          r: unit.position.r + (unit.position.r - aiQueen.position.r)
        };
        state = moveUnitToward(state, unit, awayfromQueen);
      } else if (distanceToQueen > 4) {
        // Too far, move closer
        state = moveUnitToward(state, unit, aiQueen.position);
      } else {
        // Good position, stay put
        state.ants[unit.id] = { ...unit, hasMoved: true };
      }
    }
  }

  return state;
}

/**
 * Handle scout unit actions (explore map, find enemy)
 */
function handleScoutUnit(gameState, scout, aiPlayer, strategy) {
  let state = { ...gameState };

  // Attack if enemies are in range
  const enemiesInRange = findEnemiesInRange(state, scout, aiPlayer);
  if (enemiesInRange.length > 0) {
    const target = enemiesInRange[0];
    const attackResult = canAttack(state, scout.id, target.id);
    if (attackResult.canAttack) {
      state = attackResult.gameState;
      return state;
    }
  }

  // Explore: move toward enemy queen to scout
  const enemyQueen = Object.values(state.ants).find(
    ant => ant.type === 'queen' && ant.owner !== aiPlayer
  );

  if (enemyQueen) {
    state = moveUnitToward(state, scout, enemyQueen.position);
  } else {
    // Move toward center of map if haven't found enemy
    state = moveUnitToward(state, scout, { q: 0, r: 0 });
  }

  return state;
}

/**
 * Handle healer unit actions (heal allies, follow army)
 */
function handleHealerUnit(gameState, healer, aiPlayer) {
  let state = { ...gameState };

  // Find injured allies in range
  const injuredAllies = Object.values(state.ants)
    .filter(ant =>
      ant.owner === aiPlayer &&
      ant.health < AntTypes[ant.type.toUpperCase()].maxHealth &&
      hexDistance(healer.position, ant.position) <= 1
    );

  if (injuredAllies.length > 0) {
    // Heal the most injured ally
    const target = injuredAllies.reduce((mostInjured, ally) =>
      ally.health < mostInjured.health ? ally : mostInjured
    );

    // TODO: Implement heal action (would need to import from gameState)
    // For now, just mark as moved
    state.ants[healer.id] = { ...healer, hasMoved: true };
    return state;
  }

  // No injured allies, follow the army (move toward combat units)
  const combatUnits = Object.values(state.ants).filter(
    ant => ant.owner === aiPlayer && ant.type !== 'queen' && ant.type !== 'drone' && ant.type !== 'healer'
  );

  if (combatUnits.length > 0) {
    const targetUnit = combatUnits[0];
    state = moveUnitToward(state, healer, targetUnit.position);
  }

  return state;
}

/**
 * Consider purchasing upgrades
 */
function considerUpgrades(gameState, aiPlayer) {
  let state = { ...gameState };
  const playerState = state.players[aiPlayer];

  // Prioritize upgrades: melee attack > defense > ranged attack > cannibalism
  const upgradePriority = ['meleeAttack', 'defense', 'rangedAttack', 'cannibalism'];

  for (const upgradeId of upgradePriority) {
    const canAffordResult = canAffordUpgrade(state, aiPlayer, upgradeId);
    if (canAffordResult.canAfford) {
      const result = purchaseUpgrade(state, aiPlayer, upgradeId);
      if (result.success) {
        console.log(`AI purchased upgrade: ${upgradeId}`);
        return result.gameState;
      }
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
  const antType = AntTypes[unit.type.toUpperCase()];
  const attackRange = antType.attackRange;

  return Object.values(gameState.ants).filter(ant => {
    if (ant.owner === aiPlayer) return false; // Not an enemy
    if (ant.isBurrowed) return false; // Can't see burrowed units (simplified)

    const distance = hexDistance(unit.position, ant.position);
    return distance <= attackRange;
  });
}

/**
 * Move a unit toward a target position
 */
function moveUnitToward(gameState, unit, targetPos) {
  let state = { ...gameState };

  console.log(`moveUnitToward: ${unit.id} from (${unit.position.q}, ${unit.position.r}) toward (${targetPos.q}, ${targetPos.r})`);

  // Get valid movement range with paths (all ants and eggs block movement)
  const antType = AntTypes[unit.type.toUpperCase()];
  const gridRadius = state.gridRadius || 6;

  // Block hexes with other ants (both enemy and friendly)
  const antHexes = Object.values(state.ants)
    .filter(ant => ant.id !== unit.id) // Don't block own position
    .map(ant => new HexCoord(ant.position.q, ant.position.r));

  // Block hexes with eggs
  const eggHexes = Object.values(state.eggs || {})
    .map(egg => new HexCoord(egg.position.q, egg.position.r));

  // Combine all blocked hexes
  const blockedHexes = [...antHexes, ...eggHexes];

  const movesWithPaths = getMovementRangeWithPaths(unit.position, antType.moveRange, gridRadius, blockedHexes);
  console.log(`Move range has ${movesWithPaths.length} hexes with valid paths`);

  if (movesWithPaths.length === 0) {
    // Can't move, mark as moved
    console.log(`No valid moves, marking as moved`);
    state.ants[unit.id] = { ...unit, hasMoved: true };
    return state;
  }

  // Find the hex in movement range that's closest to target
  const bestMove = movesWithPaths.reduce((best, item) => {
    const distToTarget = hexDistance(item.hex, targetPos);
    const bestDistToTarget = hexDistance(best.hex, targetPos);
    return distToTarget < bestDistToTarget ? item : best;
  }).hex;

  console.log(`Best move: (${bestMove.q}, ${bestMove.r})`);

  // Move to that position (moveAnt returns the updated game state directly)
  const newState = moveAnt(state, unit.id, bestMove);

  // Verify the move succeeded by checking if position changed
  if (newState.ants[unit.id] &&
      (newState.ants[unit.id].position.q !== unit.position.q ||
       newState.ants[unit.id].position.r !== unit.position.r)) {
    console.log(`Unit moved successfully to (${newState.ants[unit.id].position.q}, ${newState.ants[unit.id].position.r})`);
    return newState;
  }

  // Failed to move, mark as moved
  console.log(`Move failed, marking as moved`);
  state.ants[unit.id] = { ...unit, hasMoved: true };
  return state;
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
