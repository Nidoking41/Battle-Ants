import { ref, set, onValue, push, get, update } from 'firebase/database';
import { database } from './firebaseConfig';
import { HexCoord, hexDistance } from './hexUtils';
import { AntTypes } from './antTypes';

// Serialize game state for Firebase (convert HexCoord objects to plain objects)
export function serializeGameState(gameState) {
  const serialized = {
    ...gameState,
    ants: {},
    eggs: {},
    resources: {}
  };

  // Serialize ants
  if (gameState.ants) {
    Object.entries(gameState.ants).forEach(([id, ant]) => {
      serialized.ants[id] = {
        ...ant,
        position: { q: ant.position.q, r: ant.position.r }
      };
    });
  }

  // Serialize eggs
  if (gameState.eggs) {
    Object.entries(gameState.eggs).forEach(([id, egg]) => {
      serialized.eggs[id] = {
        ...egg,
        position: { q: egg.position.q, r: egg.position.r }
      };
    });
  }

  // Serialize resources
  if (gameState.resources) {
    Object.entries(gameState.resources).forEach(([id, resource]) => {
      serialized.resources[id] = {
        ...resource,
        position: { q: resource.position.q, r: resource.position.r }
      };
    });
  }

  return serialized;
}

// Deserialize game state from Firebase (convert plain objects to HexCoord)
export function deserializeGameState(serialized) {
  const gameState = {
    ...serialized,
    ants: {},
    eggs: {},
    resources: {}
  };

  // Deserialize ants
  if (serialized.ants) {
    Object.entries(serialized.ants).forEach(([id, ant]) => {
      gameState.ants[id] = {
        ...ant,
        position: new HexCoord(ant.position.q, ant.position.r)
      };
    });
  }

  // Deserialize eggs
  if (serialized.eggs) {
    Object.entries(serialized.eggs).forEach(([id, egg]) => {
      gameState.eggs[id] = {
        ...egg,
        position: new HexCoord(egg.position.q, egg.position.r)
      };
    });
  }

  // Deserialize resources
  if (serialized.resources) {
    Object.entries(serialized.resources).forEach(([id, resource]) => {
      gameState.resources[id] = {
        ...resource,
        position: new HexCoord(resource.position.q, resource.position.r)
      };
    });
  }

  return gameState;
}

// Create or join a game room with a room code
export async function createOrJoinGameRoom(roomCode, initialGameState, playerId) {
  try {
    const gameRef = ref(database, `games/${roomCode}`);
    const snapshot = await get(gameRef);

    if (!snapshot.exists()) {
      // Room doesn't exist, create it
      console.log('Creating new room with code:', roomCode);
      const gameData = {
        gameState: serializeGameState(initialGameState),
        player1: playerId,
        player2: null,
        createdAt: Date.now(),
        roomCode: roomCode
      };
      await set(gameRef, gameData);
      return { playerRole: 'player1', isNewRoom: true };
    } else {
      // Room exists, try to join as player 2
      const gameData = snapshot.val();
      console.log('Room exists. Game data:', gameData);
      console.log('Current playerId:', playerId);
      console.log('player1 in room:', gameData.player1);
      console.log('player2 in room:', gameData.player2);

      // Check if player1 is this player (rejoining)
      if (gameData.player1 === playerId) {
        console.log('Rejoining as player 1');
        return { playerRole: 'player1', isNewRoom: false };
      }

      // Check if player2 is this player (rejoining)
      if (gameData.player2 === playerId) {
        console.log('Rejoining as player 2');
        return { playerRole: 'player2', isNewRoom: false };
      }

      // Check if room is full (both slots taken by different players)
      console.log('Checking if room is full. player2 truthy:', !!gameData.player2);
      console.log('player2 !== playerId:', gameData.player2 !== playerId);
      if (gameData.player2 && gameData.player2 !== playerId) {
        throw new Error('Room is full');
      }

      // Join as player 2
      console.log('Joining existing room as player 2');
      await update(gameRef, { player2: playerId });
      return { playerRole: 'player2', isNewRoom: false };
    }
  } catch (error) {
    console.error('Error in createOrJoinGameRoom:', error);
    throw error;
  }
}

// Create a new game room (legacy function, keeping for compatibility)
export async function createGameRoom(initialGameState) {
  try {
    console.log('Database object:', database);
    const gamesRef = ref(database, 'games');
    console.log('Games ref created:', gamesRef);
    const newGameRef = push(gamesRef);
    const gameId = newGameRef.key;
    console.log('New game ref key:', gameId);

    const gameData = {
      gameState: serializeGameState(initialGameState),
      player1: null,
      player2: null,
      createdAt: Date.now()
    };
    console.log('About to write game data:', gameData);

    await set(newGameRef, gameData);
    console.log('Game data written successfully');

    return gameId;
  } catch (error) {
    console.error('Error in createGameRoom:', error);
    throw error;
  }
}

// Join a game room
export async function joinGameRoom(gameId, playerId) {
  const gameRef = ref(database, `games/${gameId}`);
  const snapshot = await get(gameRef);

  if (!snapshot.exists()) {
    throw new Error('Game not found');
  }

  const gameData = snapshot.val();

  if (!gameData.player1) {
    await update(gameRef, { player1: playerId });
    return 'player1';
  } else if (!gameData.player2) {
    await update(gameRef, { player2: playerId });
    return 'player2';
  } else {
    throw new Error('Game is full');
  }
}

// Update game state in Firebase
export async function updateGameState(gameId, gameState) {
  const gameRef = ref(database, `games/${gameId}/gameState`);
  await set(gameRef, serializeGameState(gameState));
}

// Listen to game state changes
export function subscribeToGameState(gameId, callback) {
  const gameRef = ref(database, `games/${gameId}/gameState`);

  const unsubscribe = onValue(gameRef, (snapshot) => {
    if (snapshot.exists()) {
      const serialized = snapshot.val();
      const gameState = deserializeGameState(serialized);
      callback(gameState);
    }
  });

  return unsubscribe;
}

// Get list of available games
export async function getAvailableGames() {
  const gamesRef = ref(database, 'games');
  const snapshot = await get(gamesRef);

  if (!snapshot.exists()) {
    return [];
  }

  const games = [];
  snapshot.forEach((childSnapshot) => {
    const game = childSnapshot.val();
    if (!game.player2) { // Only show games waiting for player 2
      games.push({
        id: childSnapshot.key,
        ...game
      });
    }
  });

  return games;
}

// Fog of War: Calculate visible hexes for a player
export function getVisibleHexes(gameState, playerId) {
  const visibleHexes = new Set();

  console.log('getVisibleHexes called with playerId:', playerId);
  console.log('Total ants in game state:', gameState.ants ? Object.keys(gameState.ants).length : 0);

  // Debug: Log all ant owners
  if (gameState.ants) {
    const antOwners = Object.values(gameState.ants).map(a => a.owner);
    console.log('Ant owners:', antOwners);
  }

  // Get all ants owned by the player
  let playerAntCount = 0;
  if (gameState.ants) {
    Object.values(gameState.ants).forEach(ant => {
      if (ant.owner === playerId) {
        playerAntCount++;

        // Base vision
        // Scouts get 2 vision range, all others get 1
        let VISION_RADIUS = ant.type === 'scout' ? 2 : 1;

        // Any unit on a player-owned anthill gets +1 vision bonus
        if (gameState.anthills) {
          const anthillAtPosition = Object.values(gameState.anthills).find(
            anthill => anthill.position.q === ant.position.q &&
                       anthill.position.r === ant.position.r &&
                       anthill.owner === playerId
          );
          if (anthillAtPosition) {
            VISION_RADIUS += 1; // +1 vision bonus on friendly anthill
          }
        }

        // Add all hexes within vision radius of this ant
        for (let q = -VISION_RADIUS; q <= VISION_RADIUS; q++) {
          for (let r = -VISION_RADIUS; r <= VISION_RADIUS; r++) {
            const s = -q - r;
            if (Math.abs(q) <= VISION_RADIUS && Math.abs(r) <= VISION_RADIUS && Math.abs(s) <= VISION_RADIUS) {
              const visibleHex = new HexCoord(ant.position.q + q, ant.position.r + r);
              if (hexDistance(ant.position, visibleHex) <= VISION_RADIUS) {
                visibleHexes.add(`${visibleHex.q},${visibleHex.r}`);
              }
            }
          }
        }
      }
    });
  }

  // Add player-owned anthills to visible hexes (always visible)
  if (gameState.anthills) {
    Object.values(gameState.anthills).forEach(anthill => {
      if (anthill.owner === playerId) {
        visibleHexes.add(`${anthill.position.q},${anthill.position.r}`);
      }
    });
  }

  console.log(`Player ${playerId} has ${playerAntCount} ants, visible hexes:`, visibleHexes.size);
  return visibleHexes;
}

// Get detected burrowed enemy ants (scouts are detectors)
export function getDetectedBurrowedAnts(gameState, playerId) {
  const detectedBurrowed = new Set(); // Set of ant IDs

  if (!gameState.ants) {
    return detectedBurrowed;
  }

  // Get all enemy burrowed ants
  const enemyBurrowedAnts = Object.values(gameState.ants).filter(
    ant => ant.owner !== playerId && ant.isBurrowed
  );

  // Check if any player scouts can detect them
  const playerScouts = Object.values(gameState.ants).filter(
    ant => ant.owner === playerId && ant.type === 'scout'
  );

  playerScouts.forEach(scout => {
    // Scouts detect in vision range (same as their vision)
    let DETECTION_RADIUS = 2; // Base scout vision

    // Scouts on player-owned anthills get +1 detection bonus (consistent with vision)
    if (gameState.anthills) {
      const anthillAtPosition = Object.values(gameState.anthills).find(
        anthill => anthill.position.q === scout.position.q &&
                   anthill.position.r === scout.position.r &&
                   anthill.owner === playerId
      );
      if (anthillAtPosition) {
        DETECTION_RADIUS += 1; // Scouts on anthills get 3 detection range
      }
    }

    enemyBurrowedAnts.forEach(burrowedAnt => {
      const distance = hexDistance(scout.position, burrowedAnt.position);
      if (distance <= DETECTION_RADIUS) {
        detectedBurrowed.add(burrowedAnt.id);
      }
    });
  });

  return detectedBurrowed;
}

// Apply fog of war to game state for a specific player
export function applyFogOfWar(gameState, playerId) {
  const visibleHexes = getVisibleHexes(gameState, playerId);
  const detectedBurrowed = getDetectedBurrowedAnts(gameState, playerId);

  // Filter ants - only show enemy ants in visible range OR if they are detected while burrowed
  const filteredAnts = {};
  if (gameState.ants) {
    Object.entries(gameState.ants).forEach(([id, ant]) => {
      const hexKey = `${ant.position.q},${ant.position.r}`;
      // Always show own ants
      if (ant.owner === playerId) {
        filteredAnts[id] = ant;
      }
      // Show enemy ants if visible OR if detected while burrowed
      else if (visibleHexes.has(hexKey) || detectedBurrowed.has(id)) {
        filteredAnts[id] = ant;
      }
    });
  }

  // Filter eggs - only show eggs in visible range
  const filteredEggs = {};
  if (gameState.eggs) {
    Object.entries(gameState.eggs).forEach(([id, egg]) => {
      const hexKey = `${egg.position.q},${egg.position.r}`;
      if (visibleHexes.has(hexKey)) {
        filteredEggs[id] = egg;
      }
    });
  }

  // Resources are always visible (no fog of war for resource nodes)
  // This helps players plan their strategy from the start
  const filteredResources = gameState.resources || {};

  // Filter anthills - only show anthills in visible range
  const filteredAnthills = {};
  Object.entries(gameState.anthills || {}).forEach(([id, anthill]) => {
    const hexKey = `${anthill.position.q},${anthill.position.r}`;
    // Always show own anthills, only show enemy anthills if visible
    if (anthill.owner === playerId || visibleHexes.has(hexKey)) {
      filteredAnthills[id] = anthill;
    }
  });

  return {
    ...gameState,
    ants: filteredAnts,
    eggs: filteredEggs,
    resources: filteredResources,
    anthills: filteredAnthills
  };
}
