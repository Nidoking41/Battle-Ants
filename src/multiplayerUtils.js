import { ref, set, onValue, push, get, update, remove } from 'firebase/database';
import { database } from './firebaseConfig';
import { HexCoord, hexDistance } from './hexUtils';
import { AntTypes } from './antTypes';

// Serialize game state for Firebase (convert HexCoord objects to plain objects)
export function serializeGameState(gameState) {
  // Handle null/undefined game state (e.g., when creating room from lobby)
  if (!gameState) {
    return null;
  }

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

// Create a lobby with metadata (name, password, etc.)
export async function createLobbyWithMetadata(roomCode, playerId, metadata = {}) {
  try {
    const lobbyRef = ref(database, `lobbies/${roomCode}`);
    const snapshot = await get(lobbyRef);

    if (snapshot.exists()) {
      throw new Error('Room code already exists. Please try again.');
    }

    // Create lobby with metadata
    const lobbyData = {
      roomCode: roomCode,
      gameName: metadata.gameName || `Game ${roomCode}`,
      hasPassword: !!metadata.password,
      password: metadata.password || null,
      hostId: playerId,
      createdAt: Date.now(),
      player1: {
        id: playerId,
        color: '#FF0000',
        hero: 'gorlak',
        ready: false
      },
      player2: {
        id: null,
        color: '#0000FF',
        hero: 'sorlorg',
        ready: false
      },
      mapSize: 'medium',
      fogOfWar: true,
      gameStarted: false
    };

    await set(lobbyRef, lobbyData);
    return { success: true, roomCode };
  } catch (error) {
    console.error('Error creating lobby:', error);
    throw error;
  }
}

// Join a lobby with optional password
export async function joinLobbyWithPassword(roomCode, playerId, password = null) {
  try {
    const lobbyRef = ref(database, `lobbies/${roomCode}`);
    const snapshot = await get(lobbyRef);

    if (!snapshot.exists()) {
      throw new Error('Game not found');
    }

    const lobbyData = snapshot.val();

    // Check password if required
    if (lobbyData.hasPassword && lobbyData.password !== password) {
      throw new Error('Incorrect password');
    }

    // Check if room is full
    if (lobbyData.player2.id) {
      throw new Error('Room is full');
    }

    // Check if player1 is this player (rejoining)
    if (lobbyData.player1.id === playerId) {
      return { playerRole: 'player1', isHost: true };
    }

    // Join as player 2
    await update(lobbyRef, {
      'player2/id': playerId
    });

    return { playerRole: 'player2', isHost: false };
  } catch (error) {
    console.error('Error joining lobby:', error);
    throw error;
  }
}

// Get list of available lobbies
export async function getAvailableLobbies() {
  try {
    const lobbiesRef = ref(database, 'lobbies');
    const snapshot = await get(lobbiesRef);

    if (!snapshot.exists()) {
      return [];
    }

    const lobbies = [];
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);

    snapshot.forEach((childSnapshot) => {
      const lobby = childSnapshot.val();

      // Only show lobbies that:
      // 1. Haven't started yet
      // 2. Have space (no player2)
      // 3. Were created within the last hour
      if (!lobby.gameStarted &&
          !lobby.player2?.id &&
          lobby.createdAt > oneHourAgo) {
        lobbies.push({
          roomCode: lobby.roomCode,
          gameName: lobby.gameName,
          hasPassword: lobby.hasPassword,
          createdAt: lobby.createdAt,
          mapSize: lobby.mapSize,
          fogOfWar: lobby.fogOfWar
        });
      }
    });

    // Sort by creation time (newest first)
    lobbies.sort((a, b) => b.createdAt - a.createdAt);

    return lobbies;
  } catch (error) {
    console.error('Error getting available lobbies:', error);
    throw error;
  }
}

// Create or join a game room with a room code (legacy compatibility)
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

  // Add revealed hexes from Reveal ability
  if (gameState.players?.[playerId]?.revealedHexes) {
    gameState.players[playerId].revealedHexes.forEach(hex => {
      visibleHexes.add(`${hex.q},${hex.r}`);
    });
  }

  // Add vision from dead ants (1 hex radius)
  if (gameState.deadAnts) {
    Object.values(gameState.deadAnts).forEach(deadAnt => {
      if (deadAnt.owner === playerId) {
        const DEAD_ANT_VISION = 1;
        // Add all hexes within 1 radius of dead ant
        for (let q = -DEAD_ANT_VISION; q <= DEAD_ANT_VISION; q++) {
          for (let r = -DEAD_ANT_VISION; r <= DEAD_ANT_VISION; r++) {
            const s = -q - r;
            if (Math.abs(q) <= DEAD_ANT_VISION && Math.abs(r) <= DEAD_ANT_VISION && Math.abs(s) <= DEAD_ANT_VISION) {
              const visibleHex = new HexCoord(deadAnt.position.q + q, deadAnt.position.r + r);
              if (hexDistance(deadAnt.position, visibleHex) <= DEAD_ANT_VISION) {
                visibleHexes.add(`${visibleHex.q},${visibleHex.r}`);
              }
            }
          }
        }
      }
    });
  }

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

  // Filter dead ants - only show dead ants in visible range
  const filteredDeadAnts = {};
  if (gameState.deadAnts) {
    Object.entries(gameState.deadAnts).forEach(([id, deadAnt]) => {
      const hexKey = `${deadAnt.position.q},${deadAnt.position.r}`;
      if (visibleHexes.has(hexKey)) {
        filteredDeadAnts[id] = deadAnt;
      }
    });
  }

  return {
    ...gameState,
    ants: filteredAnts,
    eggs: filteredEggs,
    resources: filteredResources,
    anthills: filteredAnthills,
    deadAnts: filteredDeadAnts
  };
}

// Clean up old/stale game rooms
// Rooms older than maxAgeHours will be deleted
export async function cleanupOldRooms(maxAgeHours = 24) {
  try {
    const gamesRef = ref(database, 'games');
    const snapshot = await get(gamesRef);

    if (!snapshot.exists()) {
      console.log('No rooms to clean up');
      return { deleted: 0, errors: 0 };
    }

    const rooms = snapshot.val();
    const now = Date.now();
    const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert hours to milliseconds

    let deleted = 0;
    let errors = 0;

    for (const [roomCode, room] of Object.entries(rooms)) {
      try {
        // Delete if room has a createdAt timestamp and is too old
        if (room.createdAt && (now - room.createdAt) > maxAge) {
          await remove(ref(database, `games/${roomCode}`));
          deleted++;
          console.log(`Deleted old room: ${roomCode}`);
        }
        // Also delete if room has no createdAt (legacy rooms)
        else if (!room.createdAt) {
          await remove(ref(database, `games/${roomCode}`));
          deleted++;
          console.log(`Deleted legacy room (no timestamp): ${roomCode}`);
        }
      } catch (error) {
        console.error(`Error deleting room ${roomCode}:`, error);
        errors++;
      }
    }

    console.log(`Cleanup complete: ${deleted} rooms deleted, ${errors} errors`);
    return { deleted, errors };
  } catch (error) {
    console.error('Error during room cleanup:', error);
    throw error;
  }
}

// Delete all game rooms (use with caution!)
export async function clearAllRooms() {
  try {
    const gamesRef = ref(database, 'games');
    await remove(gamesRef);
    console.log('All rooms cleared');
    return { success: true };
  } catch (error) {
    console.error('Error clearing all rooms:', error);
    throw error;
  }
}
