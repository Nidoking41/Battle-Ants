import { ref, set, onValue, push, get, update, remove, onDisconnect } from 'firebase/database';
import { database } from './firebaseConfig';
import { HexCoord } from './hexUtils';


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
    resources: {},
    anthills: {},
    trees: {},
    deadAnts: {}
  };

  // Serialize ants - skip any with undefined position
  if (gameState.ants) {
    Object.entries(gameState.ants).forEach(([id, ant]) => {
      if (!ant || !ant.position) {
        console.warn('Skipping ant with undefined position:', id, ant);
        return;
      }
      serialized.ants[id] = {
        ...ant,
        position: { q: ant.position.q, r: ant.position.r }
      };
    });
  }

  // Serialize eggs - skip any with undefined position
  if (gameState.eggs) {
    Object.entries(gameState.eggs).forEach(([id, egg]) => {
      if (!egg || !egg.position) {
        console.warn('Skipping egg with undefined position:', id, egg);
        return;
      }
      serialized.eggs[id] = {
        ...egg,
        position: { q: egg.position.q, r: egg.position.r }
      };
    });
  }

  // Serialize resources - skip any with undefined position
  if (gameState.resources) {
    Object.entries(gameState.resources).forEach(([id, resource]) => {
      if (!resource || !resource.position) {
        console.warn('Skipping resource with undefined position:', id, resource);
        return;
      }
      serialized.resources[id] = {
        ...resource,
        position: { q: resource.position.q, r: resource.position.r }
      };
    });
  }

  // Serialize anthills - skip any with undefined position
  if (gameState.anthills) {
    Object.entries(gameState.anthills).forEach(([id, anthill]) => {
      if (!anthill || !anthill.position) {
        console.warn('Skipping anthill with undefined position:', id, anthill);
        return;
      }
      serialized.anthills[id] = {
        ...anthill,
        position: { q: anthill.position.q, r: anthill.position.r }
      };
    });
  }

  // Serialize trees - skip any with undefined position
  if (gameState.trees) {
    Object.entries(gameState.trees).forEach(([id, tree]) => {
      if (!tree || !tree.position) {
        console.warn('Skipping tree with undefined position:', id, tree);
        return;
      }
      serialized.trees[id] = {
        ...tree,
        position: { q: tree.position.q, r: tree.position.r }
      };
    });
  }

  // Serialize dead ants - skip any with undefined position
  if (gameState.deadAnts) {
    Object.entries(gameState.deadAnts).forEach(([id, deadAnt]) => {
      if (!deadAnt || !deadAnt.position) {
        console.warn('Skipping dead ant with undefined position:', id, deadAnt);
        return;
      }
      serialized.deadAnts[id] = {
        ...deadAnt,
        position: { q: deadAnt.position.q, r: deadAnt.position.r }
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
    resources: {},
    anthills: {},
    trees: {},
    deadAnts: {}
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

  // Deserialize anthills
  if (serialized.anthills) {
    Object.entries(serialized.anthills).forEach(([id, anthill]) => {
      gameState.anthills[id] = {
        ...anthill,
        position: new HexCoord(anthill.position.q, anthill.position.r)
      };
    });
  }

  // Deserialize trees
  if (serialized.trees) {
    Object.entries(serialized.trees).forEach(([id, tree]) => {
      gameState.trees[id] = {
        ...tree,
        position: new HexCoord(tree.position.q, tree.position.r)
      };
    });
  }

  // Deserialize dead ants
  if (serialized.deadAnts) {
    Object.entries(serialized.deadAnts).forEach(([id, deadAnt]) => {
      gameState.deadAnts[id] = {
        ...deadAnt,
        position: new HexCoord(deadAnt.position.q, deadAnt.position.r)
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

    // Player count determines map shape
    const playerCount = metadata.playerCount || 2;
    let mapShape = 'rectangle';
    if (playerCount === 3) mapShape = 'triangle';
    if (playerCount === 4) mapShape = 'square';

    // Create lobby with metadata
    const lobbyData = {
      roomCode: roomCode,
      gameName: metadata.gameName || `Game ${roomCode}`,
      hasPassword: !!metadata.password,
      password: metadata.password || null,
      hostId: playerId,
      createdAt: Date.now(),
      playerCount: playerCount,
      mapShape: mapShape,
      player1: {
        id: playerId,
        color: '#FF0000',
        hero: 'gorlak',
        team: null, // Team A, B, or null (FFA)
        ready: false
      },
      player2: {
        id: null,
        color: '#0000FF',
        hero: 'sorlorg',
        team: null,
        ready: false
      },
      mapSize: 'medium',
      fogOfWar: true,
      gameStarted: false
    };

    // Add player3 slot for 3+ player games
    if (playerCount >= 3) {
      lobbyData.player3 = {
        id: null,
        color: '#00FF00',
        hero: 'skrazzit',
        team: null,
        ready: false
      };
    }

    // Add player4 slot for 4-player games
    if (playerCount >= 4) {
      lobbyData.player4 = {
        id: null,
        color: '#FFFF00',
        hero: 'thorgrim',
        team: null,
        ready: false
      };
    }

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

    // Check if player is already in the lobby (rejoining)
    if (lobbyData.player1?.id === playerId) {
      return { playerRole: 'player1', isHost: true };
    }
    if (lobbyData.player2?.id === playerId) {
      return { playerRole: 'player2', isHost: false };
    }
    if (lobbyData.player3?.id === playerId) {
      return { playerRole: 'player3', isHost: false };
    }
    if (lobbyData.player4?.id === playerId) {
      return { playerRole: 'player4', isHost: false };
    }

    // Find an empty slot based on player count
    const playerCount = lobbyData.playerCount || 2;

    if (!lobbyData.player2?.id) {
      await update(lobbyRef, { 'player2/id': playerId });
      return { playerRole: 'player2', isHost: false };
    }

    if (playerCount >= 3 && lobbyData.player3 && !lobbyData.player3.id) {
      await update(lobbyRef, { 'player3/id': playerId });
      return { playerRole: 'player3', isHost: false };
    }

    if (playerCount >= 4 && lobbyData.player4 && !lobbyData.player4.id) {
      await update(lobbyRef, { 'player4/id': playerId });
      return { playerRole: 'player4', isHost: false };
    }

    throw new Error('Room is full');
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
      const maxPlayers = lobby.playerCount || 2;

      // Count how many players have joined
      let joinedCount = 0;
      if (lobby.player1?.id) joinedCount++;
      if (lobby.player2?.id) joinedCount++;
      if (lobby.player3?.id) joinedCount++;
      if (lobby.player4?.id) joinedCount++;

      // Only show lobbies that:
      // 1. Haven't started yet
      // 2. Have space for more players
      // 3. Were created within the last hour
      if (!lobby.gameStarted &&
          joinedCount < maxPlayers &&
          lobby.createdAt > oneHourAgo) {
        lobbies.push({
          roomCode: lobby.roomCode,
          gameName: lobby.gameName,
          hasPassword: lobby.hasPassword,
          createdAt: lobby.createdAt,
          mapSize: lobby.mapSize,
          fogOfWar: lobby.fogOfWar,
          playerCount: maxPlayers,
          joinedCount: joinedCount
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
  const serialized = serializeGameState(gameState);

  // Use set with onComplete to ensure the write completes
  return new Promise((resolve, reject) => {
    set(gameRef, serialized)
      .then(() => {
        console.log('Firebase write completed successfully');
        resolve();
      })
      .catch((error) => {
        console.error('Firebase write failed:', error);
        reject(error);
      });
  });
}

// Listen to game state changes
export function subscribeToGameState(gameId, callback) {
  const gameRef = ref(database, `games/${gameId}/gameState`);

  const unsubscribe = onValue(gameRef, (snapshot) => {
    if (snapshot.exists()) {
      const receiveTime = Date.now();
      const serialized = snapshot.val();
      const gameState = deserializeGameState(serialized);

      // Add timing information for debugging
      if (gameState.lastUpdateTimestamp) {
        const delay = receiveTime - gameState.lastUpdateTimestamp;
        console.log(`Firebase sync delay: ${delay}ms`);
      }

      callback(gameState);
    }
  }, (error) => {
    console.error('Firebase subscription error:', error);
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

// Fog of war helpers moved to fogOfWar.js (they are pure functions and pulling
// them from here forced Firebase to load). Re-exported so existing imports work.
export { getVisibleHexes, isAntObscuredByTree, getDetectedBurrowedAnts, applyFogOfWar } from './fogOfWar';


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
