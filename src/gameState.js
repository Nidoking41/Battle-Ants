import { HexCoord } from './hexUtils';
import { AntTypes, GameConstants, Upgrades, QueenTiers } from './antTypes';

// Initialize a new game state
export function createInitialGameState() {
  return {
    turn: 1,
    currentPlayer: 'player1',
    players: {
      player1: {
        id: 'player1',
        name: 'Player 1',
        resources: { ...GameConstants.STARTING_RESOURCES },
        color: '#FF0000', // Red
        upgrades: {
          meleeAttack: 0,
          rangedAttack: 0,
          defense: 0,
          cannibalism: 0
        }
      },
      player2: {
        id: 'player2',
        name: 'Player 2',
        resources: { ...GameConstants.STARTING_RESOURCES },
        color: '#0000FF', // Blue
        upgrades: {
          meleeAttack: 0,
          rangedAttack: 0,
          defense: 0,
          cannibalism: 0
        }
      }
    },
    ants: {
      // Initial queens - Player 1 at South, Player 2 at North
      'ant_p1_queen': {
        id: 'ant_p1_queen',
        type: 'queen',
        owner: 'player1',
        position: new HexCoord(0, 5), // South position (moved down)
        health: AntTypes.QUEEN.maxHealth,
        maxHealth: AntTypes.QUEEN.maxHealth,
        energy: GameConstants.QUEEN_BASE_ENERGY,
        maxEnergy: GameConstants.QUEEN_BASE_ENERGY,
        queenTier: 'queen'
      },
      'ant_p2_queen': {
        id: 'ant_p2_queen',
        type: 'queen',
        owner: 'player2',
        position: new HexCoord(0, -5), // North position (moved up)
        health: AntTypes.QUEEN.maxHealth,
        maxHealth: AntTypes.QUEEN.maxHealth,
        energy: GameConstants.QUEEN_BASE_ENERGY,
        maxEnergy: GameConstants.QUEEN_BASE_ENERGY,
        queenTier: 'queen'
      },
      // Starting drones for player 1 (South) - Red
      'ant_p1_drone1': {
        id: 'ant_p1_drone1',
        type: 'drone',
        owner: 'player1',
        position: new HexCoord(-1, 5), // F12
        health: AntTypes.DRONE.maxHealth,
        maxHealth: AntTypes.DRONE.maxHealth
      },
      'ant_p1_drone2': {
        id: 'ant_p1_drone2',
        type: 'drone',
        owner: 'player1',
        position: new HexCoord(1, 4), // H11
        health: AntTypes.DRONE.maxHealth,
        maxHealth: AntTypes.DRONE.maxHealth
      },
      // Starting drones for player 2 (North) - Black
      'ant_p2_drone1': {
        id: 'ant_p2_drone1',
        type: 'drone',
        owner: 'player2',
        position: new HexCoord(-1, -4), // F3
        health: AntTypes.DRONE.maxHealth,
        maxHealth: AntTypes.DRONE.maxHealth
      },
      'ant_p2_drone2': {
        id: 'ant_p2_drone2',
        type: 'drone',
        owner: 'player2',
        position: new HexCoord(1, -5), // H2
        health: AntTypes.DRONE.maxHealth,
        maxHealth: AntTypes.DRONE.maxHealth
      },
      // Starting scouts
      'ant_p1_scout1': {
        id: 'ant_p1_scout1',
        type: 'scout',
        owner: 'player1',
        position: new HexCoord(1, 5), // H12
        health: AntTypes.SCOUT.maxHealth,
        maxHealth: AntTypes.SCOUT.maxHealth
      },
      'ant_p2_scout1': {
        id: 'ant_p2_scout1',
        type: 'scout',
        owner: 'player2',
        position: new HexCoord(-1, -5), // F2
        health: AntTypes.SCOUT.maxHealth,
        maxHealth: AntTypes.SCOUT.maxHealth
      }
    },
    eggs: {},
    resources: generateResourceNodes(),
    anthills: {}, // Anthills built on resource nodes
    selectedAnt: null,
    selectedAction: null,
    gameOver: false,
    winner: null
  };
}

// Generate symmetrical resource nodes on the map
function generateResourceNodes() {
  const resources = {};

  // Symmetrical placement - mirrored across horizontal center
  // 4 food and 3 minerals on each side (14 total) + 2 center food + 1 center mineral (17 total)
  const resourcePlacements = [
    // North side (Player 2) - 4 food + 3 minerals
    [new HexCoord(-4, -2), 'food', 'C5'],     // North-west food
    [new HexCoord(4, -2), 'food', 'K5'],      // North-east food
    [new HexCoord(-2, -1), 'food', 'E6'],     // North food (new)
    [new HexCoord(2, -3), 'food', 'I4'],      // North food (new)
    [new HexCoord(-6, 1), 'minerals', 'A8'],  // North-west minerals
    [new HexCoord(6, -6), 'minerals', 'M1'],  // North-center minerals
    [new HexCoord(4, -6), 'minerals', 'K1'],  // North-east minerals

    // South side (Player 1) - 4 food + 3 minerals (mirrored)
    [new HexCoord(-4, 2), 'food', 'C9'],      // South-west food
    [new HexCoord(4, 2), 'food', 'K9'],       // South-east food
    [new HexCoord(-2, 3), 'food', 'E10'],     // South food (new)
    [new HexCoord(2, 1), 'food', 'I8'],       // South food (new)
    [new HexCoord(-6, 6), 'minerals', 'A13'], // South-west minerals
    [new HexCoord(2, 5), 'minerals', 'I12'],  // South-center minerals
    [new HexCoord(-4, 6), 'minerals', 'C13'], // South-east minerals

    // Center line resources - neutral
    [new HexCoord(-6, 0), 'food', 'A7'],      // Center-west food
    [new HexCoord(6, 0), 'food', 'M7'],       // Center-east food
    [new HexCoord(6, -1), 'minerals', 'M6'],  // Center-east mineral
  ];

  resourcePlacements.forEach(([pos, type, label], index) => {
    resources[`resource_${index}`] = {
      id: `resource_${index}`,
      type,
      position: pos
    };
  });

  return resources;
}

// Create a new ant instance
export function createAnt(type, owner, position) {
  const antType = AntTypes[type.toUpperCase()];
  if (!antType) {
    throw new Error(`Unknown ant type: ${type}`);
  }

  return {
    id: `ant_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
    type: antType.id,
    owner,
    position,
    health: antType.maxHealth,
    maxHealth: antType.maxHealth,
    hasMoved: false
  };
}

// Create a new egg
export function createEgg(antType, owner, position, currentTurn) {
  const type = AntTypes[antType.toUpperCase()];
  if (!type) {
    throw new Error(`Unknown ant type: ${antType}`);
  }

  return {
    id: `egg_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
    antType: type.id,
    owner,
    position,
    hatchTurn: currentTurn + type.hatchTime,
    health: 5, // Eggs have 5 health and can be targeted
    maxHealth: 5
  };
}

// Create a new anthill (under construction)
export function createAnthillInProgress(resourceId, owner, position, resourceType, initialProgress = 1) {
  return {
    id: `anthill_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
    resourceId, // Which resource node this anthill is on
    owner,
    position,
    resourceType, // 'food' or 'minerals'
    buildProgress: initialProgress, // 0-2, needs 2 to complete
    isComplete: false,
    health: 5, // Under construction anthills have 5 health and can be targeted
    maxHealth: 20 // Full health once completed
  };
}

// Complete an anthill under construction
export function completeAnthill(anthill) {
  return {
    ...anthill,
    buildProgress: GameConstants.ANTHILL_BUILD_PROGRESS_REQUIRED,
    isComplete: true,
    health: 20, // Full health when completed
    maxHealth: 20
  };
}

// Check if player can afford an ant
export function canAfford(player, antType) {
  const type = AntTypes[antType.toUpperCase()];
  return player.resources.food >= type.cost.food &&
         player.resources.minerals >= type.cost.minerals;
}

// Deduct cost from player resources
export function deductCost(player, antType) {
  const type = AntTypes[antType.toUpperCase()];
  return {
    ...player,
    resources: {
      food: player.resources.food - type.cost.food,
      minerals: player.resources.minerals - type.cost.minerals
    }
  };
}

// End current player's turn
export function endTurn(gameState) {
  const nextPlayer = gameState.currentPlayer === 'player1' ? 'player2' : 'player1';
  const isNewRound = nextPlayer === 'player1';

  // Hatch eggs that are ready
  const newAnts = {};
  const remainingEggs = {};

  Object.values(gameState.eggs).forEach(egg => {
    if (isNewRound && egg.hatchTurn <= gameState.turn) {
      // Egg hatches
      const newAnt = createAnt(egg.antType, egg.owner, egg.position);
      newAnts[newAnt.id] = newAnt;
    } else {
      remainingEggs[egg.id] = egg;
    }
  });

  // Generate passive income from anthills and reset ant action flags
  const updatedPlayers = { ...gameState.players };
  const updatedAnts = {};
  const resourceGains = []; // Track what resources were gathered for animations

  // Grant passive income from completed anthills at the start of each new round
  if (isNewRound) {
    Object.values(gameState.anthills).forEach(anthill => {
      // Only grant income from completed anthills
      if (anthill.isComplete) {
        const income = GameConstants.ANTHILL_PASSIVE_INCOME[anthill.resourceType];
        updatedPlayers[anthill.owner].resources[anthill.resourceType] += income;

        // Track this resource gain for animation
        resourceGains.push({
          amount: income,
          type: anthill.resourceType,
          position: anthill.position,
          anthillId: anthill.id,
          owner: anthill.owner
        });
      }
    });

    // Grant passive food income from queens
    Object.values(gameState.ants).forEach(ant => {
      if (ant.type === 'queen') {
        const queenTier = QueenTiers[ant.queenTier || 'queen'];
        const foodIncome = queenTier.foodIncome;
        updatedPlayers[ant.owner].resources.food += foodIncome;

        // Track this resource gain for animation
        resourceGains.push({
          amount: foodIncome,
          type: 'food',
          position: ant.position,
          queenId: ant.id,
          owner: ant.owner
        });
      }
    });
  }

  // Reset hasMoved, hasAttacked, and hasBuilt flags for the next player's ants
  // Also regenerate energy for queens at the start of each player's turn
  Object.values(gameState.ants).forEach(ant => {
    if (ant.owner === nextPlayer) {
      const updates = {
        ...ant,
        hasMoved: false,
        hasAttacked: false,
        hasBuilt: false
      };

      // Regenerate energy for queens at the start of their turn
      if (ant.type === 'queen') {
        const queenTier = QueenTiers[ant.queenTier || 'queen'];
        const newEnergy = Math.min(ant.maxEnergy, ant.energy + queenTier.energyRegen);
        updates.energy = newEnergy;
      }

      updatedAnts[ant.id] = updates;
    } else {
      updatedAnts[ant.id] = ant;
    }
  });

  return {
    gameState: {
      ...gameState,
      turn: isNewRound ? gameState.turn + 1 : gameState.turn,
      currentPlayer: nextPlayer,
      players: updatedPlayers,
      ants: {
        ...updatedAnts,
        ...newAnts
      },
      eggs: remainingEggs,
      selectedAnt: null,
      selectedAction: null
    },
    resourceGains // Return the gathered resources for animations
  };
}

// Mark an ant as having moved
export function markAntMoved(gameState, antId) {
  return {
    ...gameState,
    ants: {
      ...gameState.ants,
      [antId]: {
        ...gameState.ants[antId],
        hasMoved: true
      }
    }
  };
}

// Build an anthill on a resource node
export function buildAnthill(gameState, droneId, resourceId) {
  const drone = gameState.ants[droneId];
  const resource = gameState.resources[resourceId];

  if (!drone || !resource) return gameState;

  // Check if drone can build anthills
  const droneType = AntTypes[drone.type.toUpperCase()];
  if (!droneType.canBuildAnthill) return gameState;

  // Check if drone is adjacent to or on the resource node (distance <= 1)
  const distance = Math.max(
    Math.abs(drone.position.q - resource.position.q),
    Math.abs(drone.position.r - resource.position.r),
    Math.abs((-drone.position.q - drone.position.r) - (-resource.position.q - resource.position.r))
  );

  if (distance > 1) return gameState;

  const updatedAnthills = { ...gameState.anthills };

  // Check if there's already a completed anthill here
  const existingAnthill = Object.values(updatedAnthills).find(
    anthill => anthill.position.q === resource.position.q && anthill.position.r === resource.position.r
  );

  if (existingAnthill) {
    // If it's an enemy anthill or already complete, can't build
    if (existingAnthill.owner !== drone.owner || existingAnthill.isComplete) {
      return gameState;
    }

    // If it's our anthill under construction, add progress
    existingAnthill.buildProgress += 1;

    // Check if we've completed it
    if (existingAnthill.buildProgress >= GameConstants.ANTHILL_BUILD_PROGRESS_REQUIRED) {
      updatedAnthills[existingAnthill.id] = completeAnthill(existingAnthill);
    } else {
      updatedAnthills[existingAnthill.id] = existingAnthill;
    }
  } else {
    // Starting a new anthill costs food
    const player = gameState.players[drone.owner];
    if (player.resources.food < GameConstants.ANTHILL_BUILD_COST) {
      return gameState; // Not enough food
    }

    // Deduct the cost
    const updatedPlayers = {
      ...gameState.players,
      [drone.owner]: {
        ...player,
        resources: {
          ...player.resources,
          food: player.resources.food - GameConstants.ANTHILL_BUILD_COST
        }
      }
    };

    // Create a new anthill under construction with 1 progress
    const newAnthill = createAnthillInProgress(resourceId, drone.owner, resource.position, resource.type, 1);
    updatedAnthills[newAnthill.id] = newAnthill;

    // Mark drone as having built (ends their turn completely)
    return {
      ...gameState,
      anthills: updatedAnthills,
      players: updatedPlayers,
      ants: {
        ...gameState.ants,
        [droneId]: {
          ...drone,
          hasMoved: true,
          hasAttacked: true, // Building ends the turn like attacking does
          hasBuilt: true
        }
      }
    };
  }

  // Mark drone as having built (ends their turn completely)
  return {
    ...gameState,
    anthills: updatedAnthills,
    ants: {
      ...gameState.ants,
      [droneId]: {
        ...drone,
        hasMoved: true,
        hasAttacked: true, // Building ends the turn like attacking does
        hasBuilt: true
      }
    }
  };
}

// Check if player can afford an upgrade
export function canAffordUpgrade(player, upgradeId) {
  // Find the upgrade by matching the id field
  const upgrade = Object.values(Upgrades).find(u => u.id === upgradeId);
  if (!upgrade) return false;

  const currentTier = player.upgrades[upgradeId];
  if (currentTier >= upgrade.maxTier) return false; // Already at max tier

  const cost = upgrade.costs[currentTier];
  return player.resources.food >= cost.food && player.resources.minerals >= cost.minerals;
}

// Purchase an upgrade
export function purchaseUpgrade(gameState, upgradeId) {
  // Find the upgrade by matching the id field
  const upgrade = Object.values(Upgrades).find(u => u.id === upgradeId);
  if (!upgrade) return gameState;

  const currentPlayer = gameState.players[gameState.currentPlayer];
  const currentTier = currentPlayer.upgrades[upgradeId];

  if (currentTier >= upgrade.maxTier) return gameState; // Already at max tier
  if (!canAffordUpgrade(currentPlayer, upgradeId)) return gameState; // Can't afford

  const cost = upgrade.costs[currentTier];

  return {
    ...gameState,
    players: {
      ...gameState.players,
      [gameState.currentPlayer]: {
        ...currentPlayer,
        resources: {
          food: currentPlayer.resources.food - cost.food,
          minerals: currentPlayer.resources.minerals - cost.minerals
        },
        upgrades: {
          ...currentPlayer.upgrades,
          [upgradeId]: currentTier + 1
        }
      }
    }
  };
}

// Get ant's attack with upgrades applied
export function getAntAttack(ant, player) {
  const antType = AntTypes[ant.type.toUpperCase()];
  let attack = antType.attack;

  // Apply melee attack upgrade (for attackRange <= 1)
  if (antType.attackRange <= 1) {
    attack += player.upgrades.meleeAttack || 0;
  }
  // Apply ranged attack upgrade (for attackRange > 1)
  else {
    attack += player.upgrades.rangedAttack || 0;
  }

  return attack;
}

// Get ant's defense with upgrades applied
export function getAntDefense(ant, player, gameState) {
  const antType = AntTypes[ant.type.toUpperCase()];
  let defense = antType.defense + (player.upgrades.defense || 0);

  // Check if ant is on an anthill for +2 defense bonus
  if (gameState && gameState.anthills) {
    const onAnthill = Object.values(gameState.anthills).some(anthill =>
      anthill.position.q === ant.position.q && anthill.position.r === ant.position.r
    );

    if (onAnthill) {
      defense += 2;
    }
  }

  return defense;
}

// Check if queen has enough energy
export function hasEnoughEnergy(queen, cost) {
  return queen.energy >= cost;
}

// Deduct energy from queen
export function deductEnergy(queen, cost) {
  return {
    ...queen,
    energy: Math.max(0, queen.energy - cost)
  };
}

// Get egg laying cost for a queen based on tier
export function getEggLayCost(queen) {
  const queenTier = QueenTiers[queen.queenTier || 'queen'];
  return Math.max(0, GameConstants.EGG_LAY_ENERGY_COST - queenTier.eggCostReduction);
}

// Heal an ant with queen's heal ability
export function healAnt(gameState, queenId, targetId) {
  const queen = gameState.ants[queenId];
  const target = gameState.ants[targetId];

  if (!queen || !target) return gameState;
  if (queen.type !== 'queen') return gameState;
  if (!hasEnoughEnergy(queen, GameConstants.HEAL_ENERGY_COST)) return gameState;

  // Can't heal enemy ants
  if (queen.owner !== target.owner) return gameState;

  // Calculate new health (can't exceed max health)
  const newHealth = Math.min(target.maxHealth, target.health + GameConstants.HEAL_AMOUNT);

  // Update game state
  return {
    ...gameState,
    ants: {
      ...gameState.ants,
      [queenId]: {
        ...deductEnergy(queen, GameConstants.HEAL_ENERGY_COST),
        hasAttacked: true // Healing is a terminal action
      },
      [targetId]: {
        ...target,
        health: newHealth
      }
    }
  };
}

// Upgrade queen to next tier
export function upgradeQueen(gameState, queenId) {
  const queen = gameState.ants[queenId];
  if (!queen || queen.type !== 'queen') return gameState;

  const currentTier = queen.queenTier || 'queen';
  let nextTier = null;

  if (currentTier === 'queen') {
    nextTier = 'broodQueen';
  } else if (currentTier === 'broodQueen') {
    nextTier = 'swarmQueen';
  } else {
    return gameState; // Already at max tier
  }

  const nextTierData = QueenTiers[nextTier];
  const currentPlayer = gameState.players[queen.owner];

  // Check if player can afford the upgrade
  if (currentPlayer.resources.food < nextTierData.cost.food ||
      currentPlayer.resources.minerals < nextTierData.cost.minerals) {
    return gameState;
  }

  // Deduct cost and upgrade queen
  return {
    ...gameState,
    players: {
      ...gameState.players,
      [queen.owner]: {
        ...currentPlayer,
        resources: {
          food: currentPlayer.resources.food - nextTierData.cost.food,
          minerals: currentPlayer.resources.minerals - nextTierData.cost.minerals
        }
      }
    },
    ants: {
      ...gameState.ants,
      [queenId]: {
        ...queen,
        queenTier: nextTier,
        maxEnergy: nextTierData.maxEnergy,
        energy: Math.min(queen.energy, nextTierData.maxEnergy) // Don't exceed new max
      }
    }
  };
}

// Check if player can afford queen upgrade
export function canAffordQueenUpgrade(gameState, queenId) {
  const queen = gameState.ants[queenId];
  if (!queen || queen.type !== 'queen') return false;

  const currentTier = queen.queenTier || 'queen';
  if (currentTier === 'swarmQueen') return false; // Already at max tier

  const nextTier = currentTier === 'queen' ? 'broodQueen' : 'swarmQueen';
  const nextTierData = QueenTiers[nextTier];
  const currentPlayer = gameState.players[queen.owner];

  return currentPlayer.resources.food >= nextTierData.cost.food &&
         currentPlayer.resources.minerals >= nextTierData.cost.minerals;
}

// Get valid spawning pool hexes for a queen based on tier
export function getSpawningPoolHexes(queen, getNeighborsFunc) {
  const queenTier = QueenTiers[queen.queenTier || 'queen'];
  const spawningSpots = queenTier.spawningSpots;

  // Get all neighbors
  const allNeighbors = getNeighborsFunc(queen.position);

  // Return the first N spots based on queen tier
  // We'll use a consistent ordering to make it predictable
  // Order: top-right, right, bottom-right, bottom-left, left, top-left
  return allNeighbors.slice(0, spawningSpots);
}
