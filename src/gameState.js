import { HexCoord } from './hexUtils';
import { AntTypes, GameConstants, Upgrades, QueenTiers } from './antTypes';

// Calculate army strength for a player
// Formula: For each alive ant: (attack + defense) + (health / 10), with upgrade bonuses
export function calculateArmyStrength(gameState, playerId) {
  const player = gameState.players[playerId];
  let totalStrength = 0;

  Object.values(gameState.ants)
    .filter(ant => ant.owner === playerId && !ant.isDead)
    .forEach(ant => {
      const antType = AntTypes[ant.type.toUpperCase()];
      if (!antType) return; // Skip invalid ant types

      // Base strength calculation
      const attack = antType.attack || 0;
      const defense = antType.defense || 0;
      const health = ant.health || 0;
      const baseStrength = attack + defense + (health / 10);

      // Apply upgrade multipliers
      const meleeBonus = antType.attackType === 'melee' ? player.upgrades.meleeAttack : 0;
      const rangedBonus = antType.attackType === 'ranged' ? player.upgrades.rangedAttack : 0;
      const defenseBonus = player.upgrades.defense;

      const strength = baseStrength + meleeBonus + rangedBonus + defenseBonus;
      totalStrength += strength;
    });

  return Math.round(totalStrength);
}

// Initialize a new game state
export function createInitialGameState(options = {}) {
  const {
    mapSize = 'large', // 'small', 'medium', 'large'
    player1Color = '#FF0000',
    player2Color = '#0000FF',
    player1Hero = null,
    player2Hero = null
  } = options;

  // Map size to grid radius
  const gridSizeMap = {
    small: 4,   // 4 hex radius = ~7x7 grid
    medium: 5,  // 5 hex radius = ~9x9 grid
    large: 6    // 6 hex radius = ~11x11 grid (current)
  };
  const gridRadius = gridSizeMap[mapSize] || 6;

  const initialState = {
    turn: 1,
    currentPlayer: 'player1',
    mapSize,
    gridRadius,
    players: {
      player1: {
        id: 'player1',
        name: 'Player 1',
        resources: { ...GameConstants.STARTING_RESOURCES },
        color: player1Color,
        heroId: player1Hero,
        upgrades: {
          meleeAttack: 0,
          rangedAttack: 0,
          defense: 0,
          cannibalism: 0
        },
        heroPower: 0, // Hero power bar (0-100)
        heroAbilityActive: false, // Whether hero ability is currently active
        heroAbilityEndsOnTurn: null // Track when hero ability ends (for Thorgrim)
      },
      player2: {
        id: 'player2',
        name: 'Player 2',
        resources: { ...GameConstants.STARTING_RESOURCES },
        color: player2Color,
        heroId: player2Hero,
        upgrades: {
          meleeAttack: 0,
          rangedAttack: 0,
          defense: 0,
          cannibalism: 0
        },
        heroPower: 0, // Hero power bar (0-100)
        heroAbilityActive: false, // Whether hero ability is currently active
        heroAbilityEndsOnTurn: null // Track when hero ability ends (for Thorgrim)
      }
    },
    // Game statistics tracking
    stats: {
      player1: {
        damageDealt: 0,
        damageReceived: 0,
        antsHatched: { scout: 0, drone: 0, soldier: 0, tank: 0, spitter: 0, bomber: 0, bombardier: 0, healer: 0, cordyphage: 0 },
        antsKilled: 0,
        antsLost: 0,
        foodMined: 0,
        mineralsMined: 0
      },
      player2: {
        damageDealt: 0,
        damageReceived: 0,
        antsHatched: { scout: 0, drone: 0, soldier: 0, tank: 0, spitter: 0, bomber: 0, bombardier: 0, healer: 0, cordyphage: 0 },
        antsKilled: 0,
        antsLost: 0,
        foodMined: 0,
        mineralsMined: 0
      }
    },
    // Army strength tracking per turn
    armyStrengthHistory: {
      player1: [],
      player2: []
    },
    ants: {
      // Initial queens - Player 1 at South, Player 2 at North
      // Position scaled based on grid radius (subtract 1 to keep away from edge)
      'ant_p1_queen': {
        id: 'ant_p1_queen',
        type: 'queen',
        owner: 'player1',
        position: new HexCoord(0, gridRadius - 1), // South position
        health: AntTypes.QUEEN.maxHealth,
        maxHealth: AntTypes.QUEEN.maxHealth,
        energy: GameConstants.QUEEN_BASE_ENERGY,
        maxEnergy: GameConstants.QUEEN_BASE_ENERGY,
        queenTier: 'queen',
        heroId: player1Hero
      },
      'ant_p2_queen': {
        id: 'ant_p2_queen',
        type: 'queen',
        owner: 'player2',
        position: new HexCoord(0, -(gridRadius - 1)), // North position
        health: AntTypes.QUEEN.maxHealth,
        maxHealth: AntTypes.QUEEN.maxHealth,
        energy: GameConstants.QUEEN_BASE_ENERGY,
        maxEnergy: GameConstants.QUEEN_BASE_ENERGY,
        queenTier: 'queen',
        heroId: player2Hero
      },
      // Starting drones for player 1 (South) - positions scaled to map size
      'ant_p1_drone1': {
        id: 'ant_p1_drone1',
        type: 'drone',
        owner: 'player1',
        position: new HexCoord(-1, gridRadius - 1),
        health: AntTypes.DRONE.maxHealth,
        maxHealth: AntTypes.DRONE.maxHealth
      },
      'ant_p1_drone2': {
        id: 'ant_p1_drone2',
        type: 'drone',
        owner: 'player1',
        position: new HexCoord(1, gridRadius - 2),
        health: AntTypes.DRONE.maxHealth,
        maxHealth: AntTypes.DRONE.maxHealth
      },
      // Starting drones for player 2 (North) - positions scaled to map size
      'ant_p2_drone1': {
        id: 'ant_p2_drone1',
        type: 'drone',
        owner: 'player2',
        position: new HexCoord(-1, -(gridRadius - 2)),
        health: AntTypes.DRONE.maxHealth,
        maxHealth: AntTypes.DRONE.maxHealth
      },
      'ant_p2_drone2': {
        id: 'ant_p2_drone2',
        type: 'drone',
        owner: 'player2',
        position: new HexCoord(1, -(gridRadius - 1)),
        health: AntTypes.DRONE.maxHealth,
        maxHealth: AntTypes.DRONE.maxHealth
      },
      // Starting scouts - positions scaled to map size
      'ant_p1_scout1': {
        id: 'ant_p1_scout1',
        type: 'scout',
        owner: 'player1',
        position: new HexCoord(1, gridRadius - 1),
        health: AntTypes.SCOUT.maxHealth,
        maxHealth: AntTypes.SCOUT.maxHealth
      },
      'ant_p2_scout1': {
        id: 'ant_p2_scout1',
        type: 'scout',
        owner: 'player2',
        position: new HexCoord(-1, -(gridRadius - 1)),
        health: AntTypes.SCOUT.maxHealth,
        maxHealth: AntTypes.SCOUT.maxHealth
      }
    },
    eggs: {},
    deadAnts: {}, // Dead ants that persist for 2 seconds
    resources: generateResourceNodes(gridRadius),
    anthills: {}, // Anthills built on resource nodes
    selectedAnt: null,
    selectedAction: null,
    gameOver: false,
    winner: null
  };

  // Apply hero bonuses to starting ants
  if (player1Hero || player2Hero) {
    const { applyHeroBonuses } = require('./heroQueens');
    Object.keys(initialState.ants).forEach(antId => {
      const ant = initialState.ants[antId];
      const heroId = ant.owner === 'player1' ? player1Hero : player2Hero;

      if (heroId) {
        const antType = AntTypes[ant.type.toUpperCase()];
        const stats = {
          health: ant.health,
          maxHealth: ant.maxHealth,
          attack: antType.attack
        };
        const bonusedStats = applyHeroBonuses(stats, ant.type, heroId);

        console.log(`Applying hero bonuses to starting ${ant.type} (${ant.owner}):`, {
          before: stats,
          after: bonusedStats,
          heroId
        });

        // Apply the bonused stats
        initialState.ants[antId] = {
          ...ant,
          health: bonusedStats.health,
          maxHealth: bonusedStats.maxHealth
        };

        // Store bonus attack if different from base
        const attackDiff = bonusedStats.attack - antType.attack;
        if (attackDiff !== 0) {
          initialState.ants[antId].bonusAttack = attackDiff;
        }
      }
    });
  }

  return initialState;
}

// Generate symmetrical resource nodes on the map (randomly placed but mirrored)
function generateResourceNodes(gridRadius = 6) {
  const resources = {};

  // Queen positions are at (0, gridRadius-1) for south and (0, -(gridRadius-1)) for north
  const queenOffset = gridRadius - 1;

  // Define possible spawn positions for one half of the map (north side, r < 0)
  // We'll mirror these to the south side
  const northPositions = [];

  // Generate all valid hexes on north side (excluding center row and near queens)
  for (let q = -gridRadius; q <= gridRadius; q++) {
    for (let r = -gridRadius; r < 0; r++) { // Only north side (r < 0)
      const s = -q - r;
      if (Math.abs(q) <= gridRadius && Math.abs(r) <= gridRadius && Math.abs(s) <= gridRadius) {
        const hex = new HexCoord(q, r);

        // Exclude positions too close to north queen at (0, -queenOffset)
        const distToNorthQueen = Math.max(Math.abs(q - 0), Math.abs(r - (-queenOffset)), Math.abs(s - queenOffset));

        // Also check if the mirrored position would be too close to south queen at (0, queenOffset)
        // When we mirror (q, r, s) to (-q, -r, -s) (180-degree rotation)
        const mirroredQ = -q;
        const mirroredR = -r;
        const mirroredS = -s;
        const distToSouthQueen = Math.max(Math.abs(mirroredQ - 0), Math.abs(mirroredR - queenOffset), Math.abs(mirroredS - (-queenOffset)));

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

// Respawn a resource on the same side of the board (north/south) in an empty spot
export function respawnResource(gameState, resourceType, isNorthSide) {
  const gridRadius = gameState.gridRadius || 6;
  const queenOffset = gridRadius - 1;
  const validPositions = [];

  // Generate valid positions on the specified side (north or south)
  for (let q = -gridRadius; q <= gridRadius; q++) {
    const rStart = isNorthSide ? -gridRadius : 1; // North: negative r, South: positive r
    const rEnd = isNorthSide ? -1 : gridRadius;

    for (let r = rStart; r <= rEnd; r++) {
      const s = -q - r;
      if (Math.abs(q) <= gridRadius && Math.abs(r) <= gridRadius && Math.abs(s) <= gridRadius) {
        const hex = new HexCoord(q, r);

        // Check distance from queen on this side
        const queenR = isNorthSide ? -queenOffset : queenOffset;
        const distToQueen = Math.max(
          Math.abs(q - 0),
          Math.abs(r - queenR),
          Math.abs(s - (-queenR))
        );

        // Only include if far enough from queen
        if (distToQueen >= 3) {
          // Check if position is empty (no ant, egg, resource, or anthill)
          const hasAnt = Object.values(gameState.ants).some(
            ant => ant.position.q === hex.q && ant.position.r === hex.r
          );
          const hasEgg = Object.values(gameState.eggs).some(
            egg => egg.position.q === hex.q && egg.position.r === hex.r
          );
          const hasResource = Object.values(gameState.resources).some(
            res => res.position.q === hex.q && res.position.r === hex.r
          );
          const hasAnthill = Object.values(gameState.anthills).some(
            anthill => anthill.position.q === hex.q && anthill.position.r === hex.r
          );

          if (!hasAnt && !hasEgg && !hasResource && !hasAnthill) {
            validPositions.push(hex);
          }
        }
      }
    }
  }

  // If we found valid positions, pick one randomly
  if (validPositions.length > 0) {
    const randomPos = validPositions[Math.floor(Math.random() * validPositions.length)];
    const newResourceId = `resource_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;

    return {
      id: newResourceId,
      type: resourceType,
      position: randomPos
    };
  }

  // No valid positions found
  return null;
}

// Create a new ant instance
export function createAnt(type, owner, position, heroId = null) {
  const antType = AntTypes[type.toUpperCase()];
  if (!antType) {
    throw new Error(`Unknown ant type: ${type}`);
  }

  let health = antType.maxHealth;
  let maxHealth = antType.maxHealth;
  let attack = antType.attack;

  // Apply hero bonuses if heroId is provided
  if (heroId) {
    const { applyHeroBonuses } = require('./heroQueens');
    const bonusedStats = applyHeroBonuses({ health, maxHealth, attack }, type.toLowerCase(), heroId);
    console.log(`Creating ${type} with heroId ${heroId}:`, {
      before: { health, maxHealth, attack },
      after: bonusedStats
    });
    health = bonusedStats.health;
    maxHealth = bonusedStats.maxHealth;
    attack = bonusedStats.attack;
  }

  const ant = {
    id: `ant_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
    type: antType.id,
    owner,
    position,
    health,
    maxHealth,
    hasMoved: false
  };

  // Store heroId if provided (needed for queen spawning spot calculations)
  if (heroId) {
    ant.heroId = heroId;
  }

  // Store bonus attack if different from base
  if (attack !== antType.attack) {
    ant.bonusAttack = attack - antType.attack;
  }

  // Add energy system for units that have it (like healers and queens)
  if (antType.maxEnergy) {
    ant.energy = antType.maxEnergy;
    ant.maxEnergy = antType.maxEnergy;
  }

  // Add queenTier for queen ants
  if (type.toLowerCase() === 'queen') {
    ant.queenTier = 'queen'; // Start at base tier
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
    maxHealth: 20, // Full health once completed
    resourcesGathered: 0 // Track total resources gathered (depletes at 75)
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
  let cost = type.cost;

  // Apply hero cost modifier if player has a hero
  if (player.heroId) {
    const { applyHeroCostModifier } = require('./heroQueens');
    cost = applyHeroCostModifier(cost, player.heroId);
  }

  return player.resources.food >= cost.food &&
         player.resources.minerals >= cost.minerals;
}

// Deduct cost from player resources
export function deductCost(player, antType) {
  const type = AntTypes[antType.toUpperCase()];
  let cost = type.cost;

  // Apply hero cost modifier if player has a hero
  if (player.heroId) {
    const { applyHeroCostModifier } = require('./heroQueens');
    cost = applyHeroCostModifier(cost, player.heroId);
  }

  return {
    ...player,
    resources: {
      food: player.resources.food - cost.food,
      minerals: player.resources.minerals - cost.minerals
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
      // Egg hatches - pass hero ID from player state
      const heroId = gameState.players[egg.owner]?.heroId || null;
      const newAnt = createAnt(egg.antType, egg.owner, egg.position, heroId);
      newAnts[newAnt.id] = newAnt;

      // Track hatched ant stat (will be added to finalGameState later)
      // Stats tracking will be handled in the final game state construction
    } else {
      remainingEggs[egg.id] = egg;
    }
  });

  // Generate passive income from anthills and reset ant action flags
  const updatedPlayers = { ...gameState.players };
  // Clear revealed hexes at end of current player's turn
  if (updatedPlayers[gameState.currentPlayer]) {
    updatedPlayers[gameState.currentPlayer] = {
      ...updatedPlayers[gameState.currentPlayer],
      revealedHexes: []
    };
  }
  const updatedAnts = {};
  const resourceGains = []; // Track what resources were gathered for animations
  let updatedAnthills = { ...gameState.anthills };
  let updatedResources = { ...gameState.resources };
  const depletedAnthills = []; // Track anthills that got depleted this turn

  // Track stats for this turn
  const updatedStats = {
    player1: { ...gameState.stats.player1 },
    player2: { ...gameState.stats.player2 }
  };

  // Track hatched ants stats
  Object.values(gameState.eggs).forEach(egg => {
    if (isNewRound && egg.hatchTurn <= gameState.turn) {
      const antTypeLower = egg.antType.toLowerCase();
      if (updatedStats[egg.owner].antsHatched[antTypeLower] !== undefined) {
        updatedStats[egg.owner].antsHatched[antTypeLower]++;
      }
    }
  });

  // Grant passive income from completed anthills at the start of each new round
  if (isNewRound) {
    Object.values(updatedAnthills).forEach(anthill => {
      // Only grant income from completed anthills
      if (anthill.isComplete) {
        const income = GameConstants.ANTHILL_PASSIVE_INCOME[anthill.resourceType];
        updatedPlayers[anthill.owner].resources[anthill.resourceType] += income;

        // Track stat for resources mined
        if (anthill.resourceType === 'food') {
          updatedStats[anthill.owner].foodMined = (updatedStats[anthill.owner].foodMined || 0) + income;
        } else if (anthill.resourceType === 'minerals') {
          updatedStats[anthill.owner].mineralsMined = (updatedStats[anthill.owner].mineralsMined || 0) + income;
        }

        // Track resources gathered
        const newResourcesGathered = (anthill.resourcesGathered || 0) + income;
        updatedAnthills[anthill.id] = {
          ...anthill,
          resourcesGathered: newResourcesGathered
        };

        // Track this resource gain for animation
        resourceGains.push({
          amount: income,
          type: anthill.resourceType,
          position: anthill.position,
          anthillId: anthill.id,
          owner: anthill.owner
        });

        // Check if anthill is depleted (75+ resources gathered)
        if (newResourcesGathered >= 75) {
          depletedAnthills.push(anthill);
        }
      }
    });

    // Handle depleted anthills - remove them and respawn resources on same side
    depletedAnthills.forEach(anthill => {
      // Remove the anthill
      delete updatedAnthills[anthill.id];

      // Remove the resource at the anthill's position
      const resourceAtPosition = Object.values(updatedResources).find(
        res => res.position.q === anthill.position.q && res.position.r === anthill.position.r
      );
      if (resourceAtPosition) {
        delete updatedResources[resourceAtPosition.id];
      }

      // Determine which side of the board (north = r < 0, south = r >= 0)
      const isNorthSide = anthill.position.r < 0;

      // Respawn resource on same side
      const newResource = respawnResource(
        { ...gameState, resources: updatedResources, anthills: updatedAnthills },
        anthill.resourceType,
        isNorthSide
      );

      if (newResource) {
        updatedResources[newResource.id] = newResource;
        console.log(`Resource depleted at (${anthill.position.q},${anthill.position.r}), respawned at (${newResource.position.q},${newResource.position.r})`);
      } else {
        console.warn(`Could not find empty spot to respawn ${anthill.resourceType} on ${isNorthSide ? 'north' : 'south'} side`);
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
    // ALWAYS reset flags for the next player to ensure clean state
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

      // Regenerate energy for healers and cordyphages at the start of their turn
      if (ant.type === 'healer' && ant.maxEnergy) {
        const healerType = AntTypes.HEALER;
        const newEnergy = Math.min(ant.maxEnergy, (ant.energy || 0) + healerType.energyRegen);
        updates.energy = newEnergy;
      }
      if (ant.type === 'cordyphage' && ant.maxEnergy) {
        const cordyphageType = AntTypes.CORDYPHAGE;
        const newEnergy = Math.min(ant.maxEnergy, (ant.energy || 0) + cordyphageType.energyRegen);
        updates.energy = newEnergy;
      }

      // Decrease ensnare duration
      if (ant.ensnared && ant.ensnared > 0) {
        updates.ensnared = ant.ensnared - 1;
        if (updates.ensnared <= 0) {
          delete updates.ensnared;
        }
      }

      // Apply plague damage and decrease duration
      if (ant.plagued && ant.plagued > 0) {
        const cordyphageType = AntTypes.CORDYPHAGE;
        const plagueDamage = Math.ceil(ant.maxHealth * cordyphageType.plagueHealthLoss);
        updates.health = Math.max(1, updates.health - plagueDamage); // Min 1 health

        // Decrease plague duration
        updates.plagued = ant.plagued - 1;
        if (updates.plagued <= 0) {
          delete updates.plagued;
        }
      }

      updatedAnts[ant.id] = updates;
    } else {
      // Keep other player's ants as-is
      updatedAnts[ant.id] = ant;
    }
  });

  // Double-check: Force reset flags for ALL ants of the next player (safety measure)
  Object.keys(updatedAnts).forEach(antId => {
    const ant = updatedAnts[antId];
    if (ant.owner === nextPlayer) {
      updatedAnts[antId] = {
        ...ant,
        hasMoved: false,
        hasAttacked: false,
        hasBuilt: false
      };
    }
  });

  // Deactivate hero ability if it was active only for one turn (Gorlak, Sorlorg, Vexxara, Skrazzit)
  // Check if hero ability should expire at start of player's turn
  const currentPlayerData = updatedPlayers[gameState.currentPlayer];
  if (currentPlayerData && currentPlayerData.heroAbilityActive) {
    // Check if ability should expire based on turn counter
    if (currentPlayerData.heroAbilityEndsOnTurn && currentPlayerData.heroAbilityEndsOnTurn <= gameState.turn) {
      // Deactivate ability when it expires
      updatedPlayers[gameState.currentPlayer] = {
        ...updatedPlayers[gameState.currentPlayer],
        heroAbilityActive: false,
        heroAbilityEndsOnTurn: null
      };
    }
  }

  // Clear revealed hexes from Reveal ability at end of turn
  updatedPlayers[gameState.currentPlayer] = {
    ...updatedPlayers[gameState.currentPlayer],
    revealedHexes: []
  };

  // Calculate and record army strength for both players at end of turn
  const finalGameState = {
    ...gameState,
    turn: isNewRound ? gameState.turn + 1 : gameState.turn,
    currentPlayer: nextPlayer,
    players: updatedPlayers,
    ants: {
      ...updatedAnts,
      ...newAnts
    },
    eggs: remainingEggs,
    resources: updatedResources,
    anthills: updatedAnthills,
    stats: updatedStats,
    selectedAnt: null,
    selectedAction: null
  };

  // Track army strength history at the end of each complete round
  if (isNewRound) {
    const player1Strength = calculateArmyStrength(finalGameState, 'player1');
    const player2Strength = calculateArmyStrength(finalGameState, 'player2');

    finalGameState.armyStrengthHistory = {
      player1: [...(finalGameState.armyStrengthHistory?.player1 || []), player1Strength],
      player2: [...(finalGameState.armyStrengthHistory?.player2 || []), player2Strength]
    };
  }

  return {
    gameState: finalGameState,
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

  // Check if drone is ON the resource node (must be standing on it)
  const distance = Math.max(
    Math.abs(drone.position.q - resource.position.q),
    Math.abs(drone.position.r - resource.position.r),
    Math.abs((-drone.position.q - drone.position.r) - (-resource.position.q - resource.position.r))
  );

  if (distance > 0) return gameState; // Must be exactly on the resource (distance = 0)

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
  const queen = Object.values(gameState.ants).find(a => a.type === 'queen' && a.owner === gameState.currentPlayer);
  const currentTier = currentPlayer.upgrades[upgradeId] || 0;

  if (currentTier >= upgrade.maxTier) return gameState; // Already at max tier
  if (!canAffordUpgrade(currentPlayer, upgradeId, queen)) return gameState; // Can't afford

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

  // Apply hero bonus attack (stored when ant was created)
  if (ant.bonusAttack) {
    attack += ant.bonusAttack;
  }

  // Apply melee attack upgrade (for attackRange <= 1)
  // Each tier adds +10% (rounded down, minimum +1 per tier)
  if (antType.attackRange <= 1) {
    const tier = player.upgrades.meleeAttack || 0;
    if (tier > 0) {
      const bonus = Math.max(tier, Math.floor(antType.attack * 0.1 * tier));
      attack += bonus;
    }
  }
  // Apply ranged attack upgrade (for attackRange > 1)
  else {
    const tier = player.upgrades.rangedAttack || 0;
    if (tier > 0) {
      const bonus = Math.max(tier, Math.floor(antType.attack * 0.1 * tier));
      attack += bonus;
    }
  }

  // Apply active hero ability bonuses
  if (player.heroAbilityActive && player.heroId) {
    const { getHeroById } = require('./heroQueens');
    const hero = getHeroById(player.heroId);
    const ability = hero?.heroAbility;

    if (ability) {
      // Gorlak: +20% attack for all units
      if (player.heroId === 'gorlak' && ability.attackBonus) {
        attack = Math.floor(attack * (1 + ability.attackBonus));
      }
      // Sorlorg: +10% damage for ranged units
      else if (player.heroId === 'sorlorg' && antType.attackRange > 1 && ability.rangedDamageBonus) {
        attack = Math.floor(attack * (1 + ability.rangedDamageBonus));
      }
      // Skrazzit: +10% attack for all units
      else if (player.heroId === 'skrazzit' && ability.attackBonus) {
        attack = Math.floor(attack * (1 + ability.attackBonus));
      }
      // Thorgrim: +2 attack for all units
      else if (player.heroId === 'thorgrim' && ability.attackBonus) {
        attack += ability.attackBonus;
      }
      // Vexxara: +10% attack for all units
      else if (player.heroId === 'vexxara' && ability.attackBonus) {
        attack = Math.floor(attack * (1 + ability.attackBonus));
      }
    }
  }

  return attack;
}

// Get ant's defense with upgrades applied
export function getAntDefense(ant, player, gameState) {
  const antType = AntTypes[ant.type.toUpperCase()];
  let defense = antType.defense;

  // Apply defense upgrade: +10% per tier (rounded down, minimum +1 per tier)
  const tier = player.upgrades.defense || 0;
  if (tier > 0) {
    const bonus = Math.max(tier, Math.floor(antType.defense * 0.1 * tier));
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

  // Apply active hero ability bonuses
  if (player.heroAbilityActive && player.heroId) {
    const { getHeroById } = require('./heroQueens');
    const hero = getHeroById(player.heroId);
    const ability = hero?.heroAbility;

    if (ability) {
      // Thorgrim: +2 defense for all units
      if (player.heroId === 'thorgrim' && ability.defenseBonus) {
        defense += ability.defenseBonus;
      }
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
export function healAnt(gameState, healerId, targetId) {
  const healer = gameState.ants[healerId];
  const target = gameState.ants[targetId];

  if (!healer || !target) return gameState;
  if (healer.type !== 'queen' && healer.type !== 'healer') return gameState;

  // Get heal amount and cost based on healer type
  const isHealer = healer.type === 'healer';
  const healAmount = isHealer ? AntTypes.HEALER.healAmount : GameConstants.HEAL_AMOUNT;

  // Apply hero heal cost modifier for queens
  const currentPlayer = gameState.players[healer.owner];
  const { getHealEnergyCost, canQueenHealTwice } = require('./heroQueens');
  const baseHealCost = isHealer ? AntTypes.HEALER.healEnergyCost : GameConstants.HEAL_ENERGY_COST;
  const healCost = healer.type === 'queen'
    ? getHealEnergyCost(baseHealCost, currentPlayer?.heroId)
    : baseHealCost;

  if (!hasEnoughEnergy(healer, healCost)) return gameState;

  // Can't heal enemy ants
  if (healer.owner !== target.owner) return gameState;

  // Calculate new health (can't exceed max health)
  const newHealth = Math.min(target.maxHealth, target.health + healAmount);

  // Check if queen can heal twice (Vexxara bonus) - only applies to queens
  const doubleHealAllowed = healer.type === 'queen' && canQueenHealTwice(currentPlayer?.heroId);
  const hasHealedOnce = healer.hasHealed === true;
  const hasHealedTwice = healer.healCount >= 2;

  // Prevent healing if already used terminal action or maxed out heals
  if (healer.hasAttacked && !doubleHealAllowed) return gameState;
  if (doubleHealAllowed && hasHealedTwice) return gameState;

  // Healing removes plague and ensnare conditions
  const cleansedTarget = {
    ...target,
    health: newHealth
  };
  // Remove debuff properties entirely (don't set to undefined)
  delete cleansedTarget.plagued;
  delete cleansedTarget.ensnared;

  // Update game state
  return {
    ...gameState,
    ants: {
      ...gameState.ants,
      [healerId]: {
        ...deductEnergy(healer, healCost),
        hasAttacked: doubleHealAllowed ? (hasHealedOnce ? true : healer.hasAttacked) : true, // Terminal after first heal (normal) or second heal (Vexxara)
        hasHealed: true,
        healCount: (healer.healCount || 0) + 1
      },
      [targetId]: cleansedTarget
    }
  };
}

// Reveal fog of war with queen's reveal ability
export function revealArea(gameState, queenId, targetHex) {
  const queen = gameState.ants[queenId];
  if (!queen || queen.type !== 'queen') return gameState;

  const queenType = AntTypes.QUEEN;
  if (!hasEnoughEnergy(queen, queenType.revealEnergyCost)) return gameState;

  // Check if Reveal upgrade has been purchased
  const playerUpgrades = gameState.players[queen.owner]?.upgrades || {};
  if (!playerUpgrades.reveal || playerUpgrades.reveal < 1) return gameState;

  // Get all hexes in the reveal area (center + 6 adjacent = 7 hexes)
  const { getNeighbors } = require('./hexUtils');
  const revealedHexes = [targetHex, ...getNeighbors(targetHex)];

  // Store the revealed hexes with the player's state (lasts until end of turn)
  const currentRevealed = gameState.players[queen.owner]?.revealedHexes || [];

  return {
    ...gameState,
    ants: {
      ...gameState.ants,
      [queenId]: {
        ...deductEnergy(queen, queenType.revealEnergyCost),
        hasAttacked: true // Reveal is a terminal action
      }
    },
    players: {
      ...gameState.players,
      [queen.owner]: {
        ...gameState.players[queen.owner],
        revealedHexes: [...currentRevealed, ...revealedHexes.map(h => h.toString())]
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

  // Queens, tanks, and bombardiers cannot burrow
  if (ant.type === 'queen' || ant.type === 'tank' || ant.type === 'bombardier') return false;
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

  // Apply hero heal cost modifier
  const currentPlayer = gameState.players[healer.owner];
  const { getHealEnergyCost } = require('./heroQueens');
  const healCost = getHealEnergyCost(healerType.healEnergyCost, currentPlayer?.heroId);

  // Check energy cost
  if ((healer.energy || 0) < healCost) return gameState;

  // Check range
  const distance = Math.max(
    Math.abs(healer.position.q - target.position.q),
    Math.abs(healer.position.r - target.position.r),
    Math.abs((-healer.position.q - healer.position.r) - (-target.position.q - target.position.r))
  );
  if (distance > healerType.healRange) return gameState;

  // Apply healing
  const newHealth = Math.min(target.maxHealth, target.health + healerType.healAmount);

  // Healing removes plague and ensnare conditions
  const cleansedTarget = {
    ...target,
    health: newHealth
  };
  // Remove debuff properties entirely (don't set to undefined)
  delete cleansedTarget.plagued;
  delete cleansedTarget.ensnared;

  return {
    ...gameState,
    ants: {
      ...gameState.ants,
      [healerId]: {
        ...healer,
        energy: healer.energy - healCost,
        hasAttacked: true // Using heal counts as an action
      },
      [targetId]: cleansedTarget
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

// Mind control an enemy unit (Cordyceps Purge) - Cordyphage ability
export function cordycepsPurge(gameState, cordyphageId, targetId) {
  const cordyphage = gameState.ants[cordyphageId];
  const target = gameState.ants[targetId];

  if (!cordyphage || !target) return gameState;
  if (cordyphage.type !== 'cordyphage') return gameState;
  if (cordyphage.owner === target.owner) return gameState; // Can only mind control enemies
  if (target.type === 'queen') return gameState; // Cannot mind control queens

  const cordyphageType = AntTypes.CORDYPHAGE;
  const player = gameState.players[cordyphage.owner];

  // Check if upgrade is researched
  if (!player.upgrades.cordycepsPurge || player.upgrades.cordycepsPurge === 0) return gameState;

  // Check energy cost
  if ((cordyphage.energy || 0) < cordyphageType.cordycepsEnergyCost) return gameState;

  // Check range
  const distance = Math.max(
    Math.abs(cordyphage.position.q - target.position.q),
    Math.abs(cordyphage.position.r - target.position.r),
    Math.abs((-cordyphage.position.q - cordyphage.position.r) - (-target.position.q - target.position.r))
  );
  if (distance > cordyphageType.cordycepsRange) return gameState;

  // Transfer ownership
  return {
    ...gameState,
    ants: {
      ...gameState.ants,
      [cordyphageId]: {
        ...cordyphage,
        energy: cordyphage.energy - cordyphageType.cordycepsEnergyCost,
        hasAttacked: true // Using mind control counts as an action
      },
      [targetId]: {
        ...target,
        owner: cordyphage.owner, // Change ownership
        hasMoved: true, // Mark as moved so it can't act this turn
        hasAttacked: true
      }
    }
  };
}

// Get valid cordyceps targets for a cordyphage
export function getValidCordycepsTargets(gameState, cordyphageId) {
  const cordyphage = gameState.ants[cordyphageId];
  if (!cordyphage || cordyphage.type !== 'cordyphage') return [];

  const cordyphageType = AntTypes.CORDYPHAGE;
  const player = gameState.players[cordyphage.owner];

  // Check if upgrade is researched
  if (!player.upgrades.cordycepsPurge || player.upgrades.cordycepsPurge === 0) return [];

  // Check energy
  if ((cordyphage.energy || 0) < cordyphageType.cordycepsEnergyCost) return [];

  return Object.values(gameState.ants).filter(enemy => {
    if (enemy.owner === cordyphage.owner) return false;
    if (enemy.type === 'queen') return false; // Cannot mind control queens

    const distance = Math.max(
      Math.abs(cordyphage.position.q - enemy.position.q),
      Math.abs(cordyphage.position.r - enemy.position.r),
      Math.abs((-cordyphage.position.q - cordyphage.position.r) - (-enemy.position.q - enemy.position.r))
    );
    return distance <= cordyphageType.cordycepsRange;
  });
}

// Cordyphage: Inflict plague on an enemy unit
export function plagueEnemy(gameState, cordyphageId, targetId) {
  const cordyphage = gameState.ants[cordyphageId];
  const target = gameState.ants[targetId];

  if (!cordyphage || !target) return gameState;
  if (cordyphage.type !== 'cordyphage') return gameState;
  if (cordyphage.owner === target.owner) return gameState; // Can only plague enemies
  if (target.plagued) return gameState; // Already plagued

  const cordyphageType = AntTypes.CORDYPHAGE;

  // Check energy cost
  if ((cordyphage.energy || 0) < cordyphageType.plagueEnergyCost) return gameState;

  // Check range
  const distance = Math.max(
    Math.abs(cordyphage.position.q - target.position.q),
    Math.abs(cordyphage.position.r - target.position.r),
    Math.abs((-cordyphage.position.q - cordyphage.position.r) - (-target.position.q - target.position.r))
  );
  if (distance > cordyphageType.plagueRange) return gameState;

  // Apply plague
  return {
    ...gameState,
    ants: {
      ...gameState.ants,
      [cordyphageId]: {
        ...cordyphage,
        energy: cordyphage.energy - cordyphageType.plagueEnergyCost,
        hasAttacked: true // Using plague counts as an action
      },
      [targetId]: {
        ...target,
        plagued: cordyphageType.plagueDuration // Turns remaining
      }
    }
  };
}

// Get valid plague targets for a cordyphage
export function getValidPlagueTargets(gameState, cordyphageId) {
  const cordyphage = gameState.ants[cordyphageId];
  if (!cordyphage || cordyphage.type !== 'cordyphage') return [];

  const cordyphageType = AntTypes.CORDYPHAGE;

  // Check energy
  if ((cordyphage.energy || 0) < cordyphageType.plagueEnergyCost) return [];

  return Object.values(gameState.ants).filter(enemy => {
    if (enemy.owner === cordyphage.owner) return false;
    if (enemy.plagued) return false; // Already plagued

    const distance = Math.max(
      Math.abs(cordyphage.position.q - enemy.position.q),
      Math.abs(cordyphage.position.r - enemy.position.r),
      Math.abs((-cordyphage.position.q - cordyphage.position.r) - (-enemy.position.q - enemy.position.r))
    );
    return distance <= cordyphageType.plagueRange;
  });
}

// Get valid heal targets for a healer
export function getValidHealTargets(gameState, healerId) {
  const healer = gameState.ants[healerId];
  if (!healer || healer.type !== 'healer') return [];

  const healerType = AntTypes.HEALER;

  // Apply hero heal cost modifier
  const currentPlayer = gameState.players[healer.owner];
  const { getHealEnergyCost } = require('./heroQueens');
  const healCost = getHealEnergyCost(healerType.healEnergyCost, currentPlayer?.heroId);

  if ((healer.energy || 0) < healCost) return [];

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
  let spawningSpots = queenTier.spawningSpots;

  // Apply hero bonus if applicable (Skrazzit gets +1 spawning spot)
  if (queen.heroId) {
    const { getHeroById } = require('./heroQueens');
    const hero = getHeroById(queen.heroId);
    if (hero && hero.bonuses && hero.bonuses.spawningSpotBonus) {
      spawningSpots += hero.bonuses.spawningSpotBonus;
    }
  }

  // Get all neighbors
  const allNeighbors = getNeighborsFunc(queen.position);

  // Return the first N spots based on queen tier and hero bonuses
  // We'll use a consistent ordering to make it predictable
  // Order: top-right, right, bottom-right, bottom-left, left, top-left
  return allNeighbors.slice(0, spawningSpots);
}


// Update hero power based on damage dealt or received
export function updateHeroPower(gameState, playerId, damageAmount) {
  if (!gameState.players[playerId]) return gameState;

  const player = gameState.players[playerId];

  // Don't add power if ability is already at 100% or active
  if (player.heroPower >= 100) return gameState;

  // Calculate new hero power: 150 total damage = 100% power
  // So each point of damage = 100/150 = 0.6667% power
  const powerGain = (damageAmount / 150) * 100;
  const newPower = Math.min(100, (player.heroPower || 0) + powerGain);

  return {
    ...gameState,
    players: {
      ...gameState.players,
      [playerId]: {
        ...player,
        heroPower: newPower
      }
    }
  };
}

// Activate hero ability
export function activateHeroAbility(gameState, playerId) {
  const player = gameState.players[playerId];
  
  if (!player) return gameState;
  if (player.heroPower < 100) return gameState; // Need full hero power
  if (player.heroAbilityActive) return gameState; // Already active

  const heroId = player.heroId;
  if (!heroId) return gameState;

  const updatedAnts = { ...gameState.ants };
  const updatedPlayers = { ...gameState.players };

  // Get player ants
  const playerAnts = Object.values(updatedAnts).filter(ant => ant.owner === playerId);

  // Apply hero ability based on hero ID
  switch (heroId) {
    case "gorlak":
      // Melee units can move one more space this turn (temporary buff)
      // Attack boost is passive, handled in combat calculations
      updatedPlayers[playerId] = {
        ...updatedPlayers[playerId],
        heroAbilityEndsOnTurn: gameState.turn + 2 // Lasts until next turn
      };
      break;

    case "sorlorg":
      // Ranged units gain +1 range (temporary buff)
      // Damage boost is passive, handled in combat calculations
      updatedPlayers[playerId] = {
        ...updatedPlayers[playerId],
        heroAbilityEndsOnTurn: gameState.turn + 2 // Lasts until next turn
      };
      break;

    case "skrazzit":
      // Multiply resources by 1.5 and grant attack boost
      updatedPlayers[playerId] = {
        ...updatedPlayers[playerId],
        resources: {
          food: Math.floor(player.resources.food * 1.5),
          minerals: Math.floor(player.resources.minerals * 1.5)
        },
        heroAbilityEndsOnTurn: gameState.turn + 2 // Lasts until next turn
      };
      break;

    case "thorgrim":
      // Units gain +2 defense and +2 attack until next turn (handled in combat)
      updatedPlayers[playerId] = {
        ...updatedPlayers[playerId],
        heroAbilityEndsOnTurn: gameState.turn + 2 // Lasts until next turn
      };
      break;

    case "vexxara":
      // Restore all units to full health and energy
      playerAnts.forEach(ant => {
        const updatedAnt = {
          ...ant,
          health: ant.maxHealth
        };

        // Only set energy if the ant has maxEnergy (queens, healers, cordyphages)
        if (ant.maxEnergy !== undefined) {
          updatedAnt.energy = ant.maxEnergy;
        }

        updatedAnts[ant.id] = updatedAnt;
      });
      updatedPlayers[playerId] = {
        ...updatedPlayers[playerId],
        heroAbilityEndsOnTurn: gameState.turn + 2 // Lasts until next turn
      };
      break;

    default:
      break;
  }

  // Activate ability and reset hero power
  updatedPlayers[playerId] = {
    ...updatedPlayers[playerId],
    heroPower: 0,
    heroAbilityActive: true
  };

  return {
    ...gameState,
    players: updatedPlayers,
    ants: updatedAnts
  };
}

