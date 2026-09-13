import { HexCoord, hexDistance } from './hexUtils';


// Fog of war and visibility rules. These are pure functions - they previously
// lived in multiplayerUtils.js, which meant importing them pulled in Firebase
// and initialized a network connection even for offline single-player games.

// Fog of War: Calculate visible hexes for a player
export function getVisibleHexes(gameState, playerId) {
  const visibleHexes = new Set();

  // Helper to check if two players are teammates
  const areTeammates = (id1, id2) => {
    if (id1 === id2) return true;
    const player1 = gameState.players?.[id1];
    const player2 = gameState.players?.[id2];
    if (!player1?.team || !player2?.team) return false;
    return player1.team === player2.team;
  };

  // Get all players who share vision (self + teammates)
  const sharedVisionPlayers = new Set([playerId]);
  if (gameState.players) {
    Object.keys(gameState.players).forEach(otherPlayerId => {
      if (areTeammates(playerId, otherPlayerId)) {
        sharedVisionPlayers.add(otherPlayerId);
      }
    });
  }

  // Get all ants owned by the player or teammates
  let playerAntCount = 0;
  if (gameState.ants) {
    Object.values(gameState.ants).forEach(ant => {
      if (sharedVisionPlayers.has(ant.owner)) {
        playerAntCount++;

        // Base vision
        // Scouts and Queens get 2 vision range, all others get 1
        let VISION_RADIUS = (ant.type === 'scout' || ant.type === 'queen') ? 2 : 1;

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

  // Add player-owned and teammate anthills to visible hexes (always visible)
  if (gameState.anthills) {
    Object.values(gameState.anthills).forEach(anthill => {
      if (sharedVisionPlayers.has(anthill.owner)) {
        visibleHexes.add(`${anthill.position.q},${anthill.position.r}`);
      }
    });
  }

  // Add revealed hexes from Reveal ability for player and teammates
  sharedVisionPlayers.forEach(sharedPlayerId => {
    if (gameState.players?.[sharedPlayerId]?.revealedHexes) {
      gameState.players[sharedPlayerId].revealedHexes.forEach(hexStr => {
        visibleHexes.add(hexStr); // hexStr is already in "q,r" format
      });
    }
  });

  // Add vision from dead ants (1 hex radius) - includes teammate dead ants
  if (gameState.deadAnts) {
    Object.values(gameState.deadAnts).forEach(deadAnt => {
      if (sharedVisionPlayers.has(deadAnt.owner)) {
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

// Check if an enemy ant is obscured by a tree
// Returns true if the ant should be hidden from the player
export function isAntObscuredByTree(gameState, ant, playerId) {
  // Helper to check if two players are teammates
  const areTeammates = (id1, id2) => {
    if (id1 === id2) return true;
    const player1 = gameState.players?.[id1];
    const player2 = gameState.players?.[id2];
    if (!player1?.team || !player2?.team) return false;
    return player1.team === player2.team;
  };

  // Only check enemy ants (not self or teammates)
  if (!ant || areTeammates(ant.owner, playerId)) {
    return false;
  }

  // Check if ant is on a tree hex
  const treeAtPosition = gameState.trees ? Object.values(gameState.trees).find(
    tree => tree.position.q === ant.position.q && tree.position.r === ant.position.r
  ) : null;

  if (!treeAtPosition) {
    return false; // No tree, not obscured
  }

  // Ant is on a tree - check if player or teammates have an adjacent ant
  const friendlyAnts = gameState.ants ? Object.values(gameState.ants).filter(
    a => areTeammates(a.owner, playerId) && !a.isDead
  ) : [];

  for (const friendlyAnt of friendlyAnts) {
    const distance = hexDistance(friendlyAnt.position, ant.position);
    if (distance === 1) {
      return false; // Player or teammate has adjacent ant, enemy is visible
    }
  }

  // No adjacent friendly ants, enemy is obscured by tree
  return true;
}

// Get detected burrowed enemy ants (scouts and revealed hexes are detectors)
export function getDetectedBurrowedAnts(gameState, playerId) {
  const detectedBurrowed = new Set(); // Set of ant IDs

  if (!gameState.ants) {
    return detectedBurrowed;
  }

  // Helper to check if two players are teammates
  const areTeammates = (id1, id2) => {
    if (id1 === id2) return true;
    const player1 = gameState.players?.[id1];
    const player2 = gameState.players?.[id2];
    if (!player1?.team || !player2?.team) return false;
    return player1.team === player2.team;
  };

  // Get all players who share vision (self + teammates)
  const sharedVisionPlayers = new Set([playerId]);
  if (gameState.players) {
    Object.keys(gameState.players).forEach(otherPlayerId => {
      if (areTeammates(playerId, otherPlayerId)) {
        sharedVisionPlayers.add(otherPlayerId);
      }
    });
  }

  // Get all enemy burrowed ants (not owned by player or teammates)
  const enemyBurrowedAnts = Object.values(gameState.ants).filter(
    ant => !sharedVisionPlayers.has(ant.owner) && ant.isBurrowed
  );

  // Check if any friendly scouts can detect them
  const friendlyScouts = Object.values(gameState.ants).filter(
    ant => sharedVisionPlayers.has(ant.owner) && ant.type === 'scout'
  );

  friendlyScouts.forEach(scout => {
    // Scouts detect in vision range (same as their vision)
    let DETECTION_RADIUS = 2; // Base scout vision

    // Scouts on friendly anthills get +1 detection bonus (consistent with vision)
    if (gameState.anthills) {
      const anthillAtPosition = Object.values(gameState.anthills).find(
        anthill => anthill.position.q === scout.position.q &&
                   anthill.position.r === scout.position.r &&
                   sharedVisionPlayers.has(anthill.owner)
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

  // Check revealed hexes from player and teammates - they also detect burrowed units
  const allRevealedHexes = [];
  sharedVisionPlayers.forEach(sharedPlayerId => {
    const revealed = gameState.players?.[sharedPlayerId]?.revealedHexes || [];
    allRevealedHexes.push(...revealed);
  });
  enemyBurrowedAnts.forEach(burrowedAnt => {
    const hexKey = `${burrowedAnt.position.q},${burrowedAnt.position.r}`;
    if (allRevealedHexes.includes(hexKey)) {
      detectedBurrowed.add(burrowedAnt.id);
    }
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
      // Safety check - skip ants without position
      if (!ant.position) return;

      const hexKey = `${ant.position.q},${ant.position.r}`;
      // Always show own ants
      if (ant.owner === playerId) {
        filteredAnts[id] = ant;
      }
      // Show enemy ants if visible OR if detected while burrowed
      else if (visibleHexes.has(hexKey) || detectedBurrowed.has(id)) {
        // Additional check: is the enemy ant obscured by a tree?
        if (!isAntObscuredByTree(gameState, ant, playerId)) {
          filteredAnts[id] = ant;
        }
      }
    });
  }

  // Filter eggs - only show eggs in visible range
  const filteredEggs = {};
  if (gameState.eggs) {
    Object.entries(gameState.eggs).forEach(([id, egg]) => {
      // Safety check - skip eggs without position
      if (!egg.position) return;

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
    // Safety check - skip anthills without position
    if (!anthill.position) return;

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
      // Safety check - skip dead ants without position
      if (!deadAnt.position) return;

      const hexKey = `${deadAnt.position.q},${deadAnt.position.r}`;
      if (visibleHexes.has(hexKey)) {
        filteredDeadAnts[id] = deadAnt;
      }
    });
  }

  // Filter players - hide opponent's resources
  // Only include the current player's full data
  const filteredPlayers = {};
  Object.entries(gameState.players || {}).forEach(([id, player]) => {
    if (id === playerId) {
      // Show full data for current player
      filteredPlayers[id] = player;
    } else {
      // For opponent, only show name and color (hide resources)
      filteredPlayers[id] = {
        name: player.name,
        color: player.color,
        heroId: player.heroId,
        resources: { food: '??', minerals: '??' }, // Hide actual resource counts
        upgrades: player.upgrades || {}, // Keep upgrades for calculations
        queenTier: player.queenTier, // Keep queen tier
        energy: player.energy, // Keep energy for UI calculations
        heroAbilityActive: player.heroAbilityActive, // Show hero ability aura for both players
        heroAbilityExpiresAtOwnTurnStart: player.heroAbilityExpiresAtOwnTurnStart, // Keep so expiry matches on both clients
        heroPower: player.heroPower // Show hero power meter
      };
    }
  });

  return {
    ...gameState,
    ants: filteredAnts,
    eggs: filteredEggs,
    resources: filteredResources,
    anthills: filteredAnthills,
    deadAnts: filteredDeadAnts,
    players: filteredPlayers
  };
}
