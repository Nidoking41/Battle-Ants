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

// Generate symmetrical resource nodes on the map (randomly placed but mirrored)
function generateResourceNodes() {
  const resources = {};
  const gridRadius = 6; // Must match the gridRadius in App.js rendering

  // Define possible spawn positions for one half of the map (north side, r < 0)
  // We'll mirror these to the south side
  const northPositions = [];

  // Queens are at (0, 5) for player1 (south) and (0, -5) for player2 (north)
  // Generate all valid hexes on north side (excluding center row and near queens)
  for (let q = -gridRadius; q <= gridRadius; q++) {
    for (let r = -gridRadius; r < 0; r++) { // Only north side (r < 0)
      const s = -q - r;
      if (Math.abs(q) <= gridRadius && Math.abs(r) <= gridRadius && Math.abs(s) <= gridRadius) {
        const hex = new HexCoord(q, r);

        // Exclude positions too close to north queen at (0, -5, 5)
        const distToNorthQueen = Math.max(Math.abs(q - 0), Math.abs(r - (-5)), Math.abs(s - 5));

        // Also check if the mirrored position would be too close to south queen at (0, 5, -5)
        // When we mirror (q, r, s) to (-q, -r, -s) (180-degree rotation)
        const mirroredQ = -q;
        const mirroredR = -r;
        const mirroredS = -s;
        const distToSouthQueen = Math.max(Math.abs(mirroredQ - 0), Math.abs(mirroredR - 5), Math.abs(mirroredS - (-5)));

        // Only include if both north and mirrored south positions are far enough from queens
        if (distToNorthQueen >= 3 && distToSouthQueen >= 3) {
          northPositions.push(hex);
        }
      }
    }
  }

  console.log('Valid north positions found:', northPositions.length);
  console.log('Sample valid positions:', northPositions.slice(0, 5).map(h => `(${h.q},${h.r})`));

  // Shuffle the positions
  const shuffled = northPositions.sort(() => Math.random() - 0.5);

  // Fixed resource distribution: 4 food and 2 minerals per side (12 total)
  const numFoodPerSide = 4;
  const numMineralsPerSide = 2;
  const totalResourcesPerSide = numFoodPerSide + numMineralsPerSide;

  // Select positions for resources
  const selectedNorth = shuffled.slice(0, totalResourcesPerSide);

  console.log('Selected north positions:', selectedNorth.length);
  console.log('Selected positions:', selectedNorth.map(h => `(${h.q},${h.r})`));

  let resourceIndex = 0;

  // Assign resource types: first numFoodPerSide positions get food, rest get minerals
  selectedNorth.forEach((northPos, index) => {
    const type = index < numFoodPerSide ? 'food' : 'minerals';

    // North resource
    resources[`resource_${resourceIndex}`] = {
      id: `resource_${resourceIndex}`,
      type,
      position: northPos
    };
    resourceIndex++;

    // Mirror to south (180-degree rotation: negate both q and r)
    const southPos = new HexCoord(-northPos.q, -northPos.r);
    resources[`resource_${resourceIndex}`] = {
      id: `resource_${resourceIndex}`,
      type,
      position: southPos
    };
    resourceIndex++;
  });

  console.log('Total resources generated:', Object.keys(resources).length);
  console.log('Resources by type:',
    Object.values(resources).reduce((acc, r) => {
      acc[r.type] = (acc[r.type] || 0) + 1;
      return acc;
    }, {})
  );
  console.log('Resource positions:',
    Object.values(resources).map(r => `${r.type} at (${r.position.q},${r.position.r})`)
  );

  return resources;
}

// Create a new ant instance
export function createAnt(type, owner, position) {
  const antType = AntTypes[type.toUpperCase()];
  if (!antType) {
    throw new Error(`Unknown ant type: ${type}`);
  }

  const ant = {
    id: `ant_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
    type: antType.id,
    owner,
    position,
    health: antType.maxHealth,
    maxHealth: antType.maxHealth,
    hasMoved: false
  };

  // Add energy system for units that have it (like healers)
  if (antType.maxEnergy) {
    ant.energy = antType.maxEnergy;
    ant.maxEnergy = antType.maxEnergy;
  }

  return ant;
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

      // Regenerate energy for healers at the start of their turn
      if (ant.type === 'healer' && ant.maxEnergy) {
        const healerType = AntTypes.HEALER;
        const newEnergy = Math.min(ant.maxEnergy, (ant.energy || 0) + healerType.energyRegen);
        updates.energy = newEnergy;
      }

      // Decrease ensnare duration
      if (ant.ensnared && ant.ensnared > 0) {
        updates.ensnared = ant.ensnared - 1;
        if (updates.ensnared <= 0) {
          delete updates.ensnared;
        }
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
export function canAffordUpgrade(player, upgradeId, queen) {
  // Find the upgrade by matching the id field
  const upgrade = Object.values(Upgrades).find(u => u.id === upgradeId);
  if (!upgrade) return false;

  // Check if upgrade requires a specific queen tier
  if (upgrade.requiresQueenTier) {
    if (!queen || queen.queenTier !== upgrade.requiresQueenTier) {
      return false; // Queen must be at required tier
    }
  }

  const currentTier = player.upgrades[upgradeId] || 0;
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
  const currentTier = currentPlayer.upgrades[upgradeId] || 0;

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
  // Each tier adds +20% (rounded down, minimum +1 per tier)
  if (antType.attackRange <= 1) {
    const tier = player.upgrades.meleeAttack || 0;
    if (tier > 0) {
      const bonus = Math.max(tier, Math.floor(antType.attack * 0.2 * tier));
      attack += bonus;
    }
  }
  // Apply ranged attack upgrade (for attackRange > 1)
  else {
    const tier = player.upgrades.rangedAttack || 0;
    if (tier > 0) {
      const bonus = Math.max(tier, Math.floor(antType.attack * 0.2 * tier));
      attack += bonus;
    }
  }

  return attack;
}

// Get ant's defense with upgrades applied
export function getAntDefense(ant, player, gameState) {
  const antType = AntTypes[ant.type.toUpperCase()];
  let defense = antType.defense;

  // Apply defense upgrade: +20% per tier (rounded down, minimum +1 per tier)
  const tier = player.upgrades.defense || 0;
  if (tier > 0) {
    const bonus = Math.max(tier, Math.floor(antType.defense * 0.2 * tier));
    defense += bonus;
  }

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

// Burrow an ant
export function burrowAnt(gameState, antId) {
  const ant = gameState.ants[antId];
  if (!ant) return gameState;

  // Check if player has researched burrow upgrade
  const player = gameState.players[ant.owner];
  if (!player.upgrades.burrow) return gameState;

  // Tank and Bombardier cannot burrow
  if (ant.type === 'tank' || ant.type === 'bombardier') return gameState;

  // Cannot burrow if already burrowed
  if (ant.isBurrowed) return gameState;

  return {
    ...gameState,
    ants: {
      ...gameState.ants,
      [antId]: {
        ...ant,
        isBurrowed: true,
        hasMoved: true // Burrowing counts as your move action
      }
    }
  };
}

// Unburrow an ant
export function unburrowAnt(gameState, antId) {
  const ant = gameState.ants[antId];
  if (!ant || !ant.isBurrowed) return gameState;

  // Check if another ant is directly above (same position)
  const antAbove = Object.values(gameState.ants).some(
    otherAnt => otherAnt.id !== antId &&
                otherAnt.position.q === ant.position.q &&
                otherAnt.position.r === ant.position.r
  );

  if (antAbove) return gameState; // Cannot unburrow

  return {
    ...gameState,
    ants: {
      ...gameState.ants,
      [antId]: {
        ...ant,
        isBurrowed: false,
        hasMoved: true // Unburrowing counts as your move action
      }
    }
  };
}

// Check if an ant can burrow
export function canBurrow(gameState, ant) {
  if (!ant) return false;

  // Check if player has researched burrow upgrade
  const player = gameState.players[ant.owner];
  if (!player.upgrades.burrow) return false;

  if (ant.type === 'tank' || ant.type === 'bombardier') return false;
  if (ant.isBurrowed) return false;
  if (ant.hasMoved) return false;
  return true;
}

// Check if an ant can unburrow
export function canUnburrow(gameState, antId) {
  const ant = gameState.ants[antId];
  if (!ant || !ant.isBurrowed) return false;
  if (ant.hasMoved) return false;

  // Check if another ant is directly above
  const antAbove = Object.values(gameState.ants).some(
    otherAnt => otherAnt.id !== antId &&
                otherAnt.position.q === ant.position.q &&
                otherAnt.position.r === ant.position.r
  );

  return !antAbove;
}

// Teleport an ant to another anthill (Connected Tunnels upgrade)
export function teleportAnt(gameState, antId, targetAnthillId) {
  const ant = gameState.ants[antId];
  if (!ant) return gameState;

  // Check if player has Connected Tunnels upgrade
  const player = gameState.players[ant.owner];
  if (!player.upgrades.connectedTunnels) return gameState;

  const targetAnthill = gameState.anthills[targetAnthillId];
  if (!targetAnthill) return gameState;

  // Verify target anthill is owned by the player
  if (targetAnthill.owner !== ant.owner) return gameState;

  // Verify target anthill is complete
  if (!targetAnthill.isComplete) return gameState;

  // Check if there's already an ant at the target position
  const antAtTarget = Object.values(gameState.ants).some(
    otherAnt => otherAnt.id !== antId &&
                otherAnt.position.q === targetAnthill.position.q &&
                otherAnt.position.r === targetAnthill.position.r
  );
  if (antAtTarget) return gameState;

  return {
    ...gameState,
    ants: {
      ...gameState.ants,
      [antId]: {
        ...ant,
        position: { ...targetAnthill.position },
        hasMoved: true, // Teleporting uses the entire turn
        hasAttacked: true // Cannot attack after teleporting
      }
    }
  };
}

// Get valid teleport destinations for an ant (all friendly completed anthills except current)
export function getValidTeleportDestinations(gameState, antId) {
  const ant = gameState.ants[antId];
  if (!ant) return [];

  // Check if player has Connected Tunnels upgrade
  const player = gameState.players[ant.owner];
  if (!player.upgrades.connectedTunnels) return [];

  // Check if ant is on an anthill
  const currentAnthill = Object.values(gameState.anthills).find(
    anthill => anthill.owner === ant.owner &&
               anthill.isComplete &&
               anthill.position.q === ant.position.q &&
               anthill.position.r === ant.position.r
  );
  if (!currentAnthill) return [];

  // Get all other friendly completed anthills with no ant on them
  return Object.values(gameState.anthills).filter(anthill => {
    if (anthill.id === currentAnthill.id) return false;
    if (anthill.owner !== ant.owner) return false;
    if (!anthill.isComplete) return false;

    // Check if there's an ant at this anthill
    const antAtPosition = Object.values(gameState.ants).some(
      otherAnt => otherAnt.position.q === anthill.position.q &&
                  otherAnt.position.r === anthill.position.r
    );
    return !antAtPosition;
  });
}

// Healer: Heal a friendly unit
export function healAlly(gameState, healerId, targetId) {
  const healer = gameState.ants[healerId];
  const target = gameState.ants[targetId];

  if (!healer || !target) return gameState;
  if (healer.type !== 'healer') return gameState;
  if (healer.owner !== target.owner) return gameState; // Can only heal allies

  const healerType = AntTypes.HEALER;

  // Check energy cost
  if ((healer.energy || 0) < healerType.healEnergyCost) return gameState;

  // Check range
  const distance = Math.max(
    Math.abs(healer.position.q - target.position.q),
    Math.abs(healer.position.r - target.position.r),
    Math.abs((-healer.position.q - healer.position.r) - (-target.position.q - target.position.r))
  );
  if (distance > healerType.healRange) return gameState;

  // Apply healing
  const newHealth = Math.min(target.maxHealth, target.health + healerType.healAmount);

  return {
    ...gameState,
    ants: {
      ...gameState.ants,
      [healerId]: {
        ...healer,
        energy: healer.energy - healerType.healEnergyCost,
        hasAttacked: true // Using heal counts as an action
      },
      [targetId]: {
        ...target,
        health: newHealth
      }
    }
  };
}

// Healer: Ensnare an enemy unit
export function ensnareEnemy(gameState, healerId, targetId) {
  const healer = gameState.ants[healerId];
  const target = gameState.ants[targetId];

  if (!healer || !target) return gameState;
  if (healer.type !== 'healer') return gameState;
  if (healer.owner === target.owner) return gameState; // Can only ensnare enemies
  if (target.ensnared) return gameState; // Already ensnared

  const healerType = AntTypes.HEALER;

  // Check energy cost
  if ((healer.energy || 0) < healerType.ensnareEnergyCost) return gameState;

  // Check range
  const distance = Math.max(
    Math.abs(healer.position.q - target.position.q),
    Math.abs(healer.position.r - target.position.r),
    Math.abs((-healer.position.q - healer.position.r) - (-target.position.q - target.position.r))
  );
  if (distance > healerType.ensnareRange) return gameState;

  // Apply ensnare
  return {
    ...gameState,
    ants: {
      ...gameState.ants,
      [healerId]: {
        ...healer,
        energy: healer.energy - healerType.ensnareEnergyCost,
        hasAttacked: true // Using ensnare counts as an action
      },
      [targetId]: {
        ...target,
        ensnared: healerType.ensnareDuration // Turns remaining
      }
    }
  };
}

// Get valid heal targets for a healer
export function getValidHealTargets(gameState, healerId) {
  const healer = gameState.ants[healerId];
  if (!healer || healer.type !== 'healer') return [];

  const healerType = AntTypes.HEALER;
  if ((healer.energy || 0) < healerType.healEnergyCost) return [];

  return Object.values(gameState.ants).filter(ally => {
    if (ally.owner !== healer.owner) return false;
    if (ally.health >= ally.maxHealth) return false; // Already at full health

    const distance = Math.max(
      Math.abs(healer.position.q - ally.position.q),
      Math.abs(healer.position.r - ally.position.r),
      Math.abs((-healer.position.q - healer.position.r) - (-ally.position.q - ally.position.r))
    );
    return distance <= healerType.healRange;
  });
}

// Get valid ensnare targets for a healer
export function getValidEnsnareTargets(gameState, healerId) {
  const healer = gameState.ants[healerId];
  if (!healer || healer.type !== 'healer') return [];

  const healerType = AntTypes.HEALER;
  if ((healer.energy || 0) < healerType.ensnareEnergyCost) return [];

  return Object.values(gameState.ants).filter(enemy => {
    if (enemy.owner === healer.owner) return false;
    if (enemy.ensnared) return false; // Already ensnared

    const distance = Math.max(
      Math.abs(healer.position.q - enemy.position.q),
      Math.abs(healer.position.r - enemy.position.r),
      Math.abs((-healer.position.q - healer.position.r) - (-enemy.position.q - enemy.position.r))
    );
    return distance <= healerType.ensnareRange;
  });
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
