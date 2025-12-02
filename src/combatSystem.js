import { AntTypes, GameConstants, getAntTypeById } from './antTypes';
import { hexDistance, getNeighbors } from './hexUtils';
import { getAntAttack, getAntDefense } from './gameState';

// Helper function to create a dead ant
export function createDeadAnt(ant) {
  return {
    id: `dead_${ant.id}_${Date.now()}`,
    position: ant.position,
    owner: ant.owner,
    createdAt: Date.now()
  };
}

// Helper function to check if two players are on the same team
function areTeammates(gameState, playerId1, playerId2) {
  if (playerId1 === playerId2) return true;

  const player1 = gameState.players[playerId1];
  const player2 = gameState.players[playerId2];

  // If either player has no team (null/undefined), they are not teammates
  if (!player1?.team || !player2?.team) return false;

  // Check if they're on the same team
  return player1.team === player2.team;
}

// Check win conditions after a queen dies
// Returns { gameOver: boolean, winner: string|null, winningTeam: string|null }
export function checkWinCondition(gameState, killerPlayerId, deadQueenOwner) {
  const playerCount = gameState.playerCount || 2;

  // Get all living queens
  const livingQueens = Object.values(gameState.ants).filter(
    ant => ant.type === 'queen' && !ant.isDead && ant.owner !== deadQueenOwner
  );

  // For 2-player games, simple: killer wins
  if (playerCount === 2) {
    return { gameOver: true, winner: killerPlayerId, winningTeam: null };
  }

  // For team games, check if all queens on a team are dead
  const teamA = gameState.players ? Object.keys(gameState.players).filter(
    pid => gameState.players[pid]?.team === 'A'
  ) : [];
  const teamB = gameState.players ? Object.keys(gameState.players).filter(
    pid => gameState.players[pid]?.team === 'B'
  ) : [];

  const hasTeams = teamA.length > 0 && teamB.length > 0;

  if (hasTeams) {
    // Team game win condition: all queens on opposing team are dead
    const teamAQueensAlive = livingQueens.filter(q => teamA.includes(q.owner)).length;
    const teamBQueensAlive = livingQueens.filter(q => teamB.includes(q.owner)).length;

    if (teamAQueensAlive === 0 && teamBQueensAlive > 0) {
      // Team B wins
      return { gameOver: true, winner: killerPlayerId, winningTeam: 'B' };
    } else if (teamBQueensAlive === 0 && teamAQueensAlive > 0) {
      // Team A wins
      return { gameOver: true, winner: killerPlayerId, winningTeam: 'A' };
    }
    // Game continues - not all opposing queens are dead
    return { gameOver: false, winner: null, winningTeam: null };
  }

  // FFA game (no teams): last player standing wins
  // Count unique players with living queens
  const playersWithQueens = new Set(livingQueens.map(q => q.owner));

  if (playersWithQueens.size === 1) {
    // Only one player has a queen left - they win
    const winner = [...playersWithQueens][0];
    return { gameOver: true, winner, winningTeam: null };
  }

  // Game continues
  return { gameOver: false, winner: null, winningTeam: null };
}

// Attack an egg
export function attackEgg(gameState, attackerId, eggId) {
  const attacker = gameState.ants[attackerId];
  const egg = gameState.eggs[eggId];

  if (!attacker || !egg) {
    return { gameState, damageDealt: [], attackAnimation: null };
  }

  // Can't attack your own egg or teammate's egg
  if (attacker.owner === egg.owner || areTeammates(gameState, attacker.owner, egg.owner)) {
    return { gameState, damageDealt: [], attackAnimation: null };
  }

  const attackerType = getAntTypeById(attacker.type);
  const attackerPlayer = gameState.players[attacker.owner];
  const baseAttack = getAntAttack(attacker, attackerPlayer);

  // Health-based damage scaling
  const healthPercent = attacker.health / attacker.maxHealth;
  const damageMultiplier = Math.min(1.0, healthPercent + 0.05);
  const damage = Math.floor(baseAttack * damageMultiplier);

  const damageDealt = [{ damage, position: egg.position }];
  const newEggHealth = egg.health - damage;

  // Update hero power for attacker (damage dealt to egg)
  const { updateHeroPower } = require('./gameState');
  let updatedGameState = updateHeroPower(gameState, attacker.owner, damage);

  const updatedEggs = { ...updatedGameState.eggs };

  if (newEggHealth <= 0) {
    // Egg is destroyed
    delete updatedEggs[eggId];
  } else {
    updatedEggs[eggId] = {
      ...egg,
      health: newEggHealth
    };
  }

  // Include attack animation data
  const attackAnimation = {
    attackerId: attackerId,
    targetPosition: egg.position,
    isRanged: attackerType.attackRange > 1
  };

  return {
    gameState: {
      ...updatedGameState,
      eggs: updatedEggs
    },
    damageDealt,
    attackAnimation
  };
}

// Attack an anthill
export function attackAnthill(gameState, attackerId, anthillId) {
  const attacker = gameState.ants[attackerId];
  const anthill = gameState.anthills[anthillId];

  if (!attacker || !anthill) {
    return { gameState, damageDealt: [], attackAnimation: null };
  }

  // Can't attack your own anthill or teammate's anthill
  if (attacker.owner === anthill.owner || areTeammates(gameState, attacker.owner, anthill.owner)) {
    return { gameState, damageDealt: [], attackAnimation: null };
  }

  const attackerType = getAntTypeById(attacker.type);
  const attackerPlayer = gameState.players[attacker.owner];
  const baseAttack = getAntAttack(attacker, attackerPlayer);

  // Health-based damage scaling
  const healthPercent = attacker.health / attacker.maxHealth;
  const damageMultiplier = Math.min(1.0, healthPercent + 0.05);
  const damage = Math.floor(baseAttack * damageMultiplier);

  const damageDealt = [{ damage, position: anthill.position }];
  const newAnthillHealth = anthill.health - damage;

  // Update hero power for attacker (damage dealt to anthill)
  const { updateHeroPower } = require('./gameState');
  let updatedGameState = updateHeroPower(gameState, attacker.owner, damage);

  const updatedAnthills = { ...updatedGameState.anthills };

  if (newAnthillHealth <= 0) {
    // Anthill is destroyed
    delete updatedAnthills[anthillId];
  } else {
    updatedAnthills[anthillId] = {
      ...anthill,
      health: newAnthillHealth
    };
  }

  // Include attack animation data
  const attackAnimation = {
    attackerId: attackerId,
    targetPosition: anthill.position,
    isRanged: attackerType.attackRange > 1
  };

  return {
    gameState: {
      ...updatedGameState,
      anthills: updatedAnthills
    },
    damageDealt,
    attackAnimation
  };
}

// Detonate a bomber ant, dealing damage to all adjacent tiles
export function detonateBomber(gameState, bomberId) {
  const bomber = gameState.ants[bomberId];
  if (!bomber || bomber.type !== 'bomber') {
    return gameState;
  }

  const bomberType = AntTypes.BOMBER;
  const updatedAnts = { ...gameState.ants };
  let updatedGameState = { ...gameState, ants: updatedAnts };

  // Get all adjacent hexes
  const adjacentHexes = getNeighbors(bomber.position);

  // Find all ants in adjacent hexes
  const adjacentAnts = Object.values(updatedAnts).filter(ant => {
    return ant.id !== bomberId &&
           adjacentHexes.some(hex => hex.equals(ant.position));
  });

  // Apply detonation damage to all adjacent ants (including friendly fire)
  const damageDealt = [];
  const { updateHeroPower } = require('./gameState');

  // Initialize stats if needed
  if (!updatedGameState.stats) {
    updatedGameState.stats = { player1: {}, player2: {} };
  }

  adjacentAnts.forEach(target => {
    const targetType = getAntTypeById(target.type);
    const defense = targetType.defense;
    const damage = Math.max(1, bomberType.attack - Math.floor(defense));
    const newHealth = target.health - damage;

    // Track damage for animation
    damageDealt.push({ damage, position: target.position });

    // Update hero power for bomber detonation
    updatedGameState = updateHeroPower(updatedGameState, bomber.owner, damage); // Bomber deals damage
    updatedGameState = updateHeroPower(updatedGameState, target.owner, damage, 0.65); // Target receives damage (0.65 multiplier)

    // Track bomber detonation damage stats
    updatedGameState.stats[bomber.owner].damageDealt = (updatedGameState.stats[bomber.owner].damageDealt || 0) + damage;
    updatedGameState.stats[target.owner].damageReceived = (updatedGameState.stats[target.owner].damageReceived || 0) + damage;

    if (newHealth <= 0) {
      // Target dies - create dead ant
      const deadAnt = createDeadAnt(target);
      updatedGameState.deadAnts = {
        ...updatedGameState.deadAnts,
        [deadAnt.id]: deadAnt
      };
      delete updatedAnts[target.id];

      // Track kills and losses stats
      updatedGameState.stats[bomber.owner].antsKilled = (updatedGameState.stats[bomber.owner].antsKilled || 0) + 1;
      updatedGameState.stats[target.owner].antsLost = (updatedGameState.stats[target.owner].antsLost || 0) + 1;

      // Check if bomber killed a queen
      if (target.type === 'queen') {
        // Update ants first so checkWinCondition sees the dead queen removed
        updatedGameState.ants = updatedAnts;
        const winResult = checkWinCondition(updatedGameState, bomber.owner, target.owner);
        updatedGameState.gameOver = winResult.gameOver;
        updatedGameState.winner = winResult.winner;
        updatedGameState.winningTeam = winResult.winningTeam;
      }

      // If killed ant is also a bomber, trigger chain reaction
      if (target.type === 'bomber') {
        updatedGameState = detonateBomber(updatedGameState, target.id);
      }
    } else {
      updatedAnts[target.id] = {
        ...target,
        health: newHealth
      };
    }
  });

  // Remove the bomber itself and create dead ant
  const deadBomber = createDeadAnt(bomber);
  updatedGameState.deadAnts = {
    ...updatedGameState.deadAnts,
    [deadBomber.id]: deadBomber
  };
  delete updatedAnts[bomberId];

  return {
    gameState: {
      ...updatedGameState,
      ants: updatedAnts
    },
    damageDealt
  };
}

// Calculate damage for an attack with health-based scaling
export function calculateDamage(attacker, defender, gameState) {
  const attackerPlayer = gameState.players[attacker.owner];
  const defenderPlayer = gameState.players[defender.owner];

  const baseAttack = getAntAttack(attacker, attackerPlayer);
  const defense = getAntDefense(defender, defenderPlayer, gameState);

  // Health-based damage scaling: (health% + 5%) with max of 100%
  const healthPercent = attacker.health / attacker.maxHealth;
  const damageMultiplier = Math.min(1.0, healthPercent + 0.05);

  // Apply health scaling to attack
  const scaledAttack = baseAttack * damageMultiplier;

  // Damage formula: attack - defense, minimum 1
  const damage = Math.max(1, Math.floor(scaledAttack - defense));

  return damage;
}

// Execute combat between two ants
export function resolveCombat(gameState, attackerId, defenderId) {
  const attacker = gameState.ants[attackerId];
  const defender = gameState.ants[defenderId];

  if (!attacker || !defender) {
    return { gameState, damageDealt: [], attackAnimation: null };
  }

  const attackerType = getAntTypeById(attacker.type);
  const damage = calculateDamage(attacker, defender, gameState);

  // Track all damage dealt for animations
  const damageDealt = [{ damage, position: defender.position }];

  // Include attack animation data
  const attackAnimation = {
    attackerId: attackerId,
    targetPosition: defender.position,
    isRanged: attackerType.attackRange > 1
  };

  // Check if it's a splash damage attack
  const updatedAnts = { ...gameState.ants };
  let updatedGameState = { ...gameState };

  // Update hero power for attacker (damage dealt)
  const { updateHeroPower } = require('./gameState');
  updatedGameState = updateHeroPower(updatedGameState, attacker.owner, damage);

  // Update hero power for defender (damage received with 0.65 multiplier)
  updatedGameState = updateHeroPower(updatedGameState, defender.owner, damage, 0.65);

  // Track damage dealt and received stats
  if (!updatedGameState.stats) {
    updatedGameState.stats = { player1: {}, player2: {} };
  }
  updatedGameState.stats[attacker.owner].damageDealt = (updatedGameState.stats[attacker.owner].damageDealt || 0) + damage;
  updatedGameState.stats[defender.owner].damageReceived = (updatedGameState.stats[defender.owner].damageReceived || 0) + damage;

  // Apply damage to primary target
  const newDefenderHealth = defender.health - damage;

  if (newDefenderHealth <= 0) {
    // Defender dies - create dead ant
    const deadAnt = createDeadAnt(defender);
    updatedGameState.deadAnts = {
      ...updatedGameState.deadAnts,
      [deadAnt.id]: deadAnt
    };
    delete updatedAnts[defenderId];

    // Track kills and losses stats
    updatedGameState.stats[attacker.owner].antsKilled = (updatedGameState.stats[attacker.owner].antsKilled || 0) + 1;
    updatedGameState.stats[defender.owner].antsLost = (updatedGameState.stats[defender.owner].antsLost || 0) + 1;

    // Grant cannibalism food if attacker is melee and player has the upgrade
    const attackerPlayer = updatedGameState.players[attacker.owner];
    const isMeleeAttack = attackerType.attackRange <= 1;
    if (isMeleeAttack && attackerPlayer.upgrades.cannibalism > 0) {
      updatedGameState.players = {
        ...updatedGameState.players,
        [attacker.owner]: {
          ...attackerPlayer,
          resources: {
            ...attackerPlayer.resources,
            food: attackerPlayer.resources.food + GameConstants.CANNIBALISM_FOOD_GAIN,
            minerals: attackerPlayer.resources.minerals + GameConstants.CANNIBALISM_MINERAL_GAIN
          }
        }
      };
    }

    // Check if it was a queen
    if (defender.type === 'queen') {
      // Update ants first so checkWinCondition sees the dead queen removed
      updatedGameState.ants = updatedAnts;
      const winResult = checkWinCondition(updatedGameState, attacker.owner, defender.owner);
      updatedGameState.gameOver = winResult.gameOver;
      updatedGameState.winner = winResult.winner;
      updatedGameState.winningTeam = winResult.winningTeam;
    }

    // If defender was a bomber, trigger detonation
    if (defender.type === 'bomber') {
      updatedGameState.ants = updatedAnts;
      updatedGameState = detonateBomber(updatedGameState, defenderId);
      return { gameState: updatedGameState, damageDealt, attackAnimation };
    }
  } else {
    updatedAnts[defenderId] = {
      ...defender,
      health: newDefenderHealth
    };
  }

  // Apply splash damage if applicable
  if (attackerType.splashDamage && attackerType.splashRadius) {
    const splashTargets = Object.values(updatedAnts).filter(ant => {
      return ant.id !== defenderId &&
             ant.owner !== attacker.owner &&
             hexDistance(ant.position, defender.position) <= attackerType.splashRadius;
    });

    splashTargets.forEach(target => {
      const splashDamage = Math.floor(damage * 0.5); // Splash does 50% damage
      damageDealt.push({ damage: splashDamage, position: target.position });

      // Update hero power for splash damage
      updatedGameState = updateHeroPower(updatedGameState, attacker.owner, splashDamage); // Attacker deals splash damage
      updatedGameState = updateHeroPower(updatedGameState, target.owner, splashDamage); // Target receives splash damage

      // Track splash damage stats
      updatedGameState.stats[attacker.owner].damageDealt = (updatedGameState.stats[attacker.owner].damageDealt || 0) + splashDamage;
      updatedGameState.stats[target.owner].damageReceived = (updatedGameState.stats[target.owner].damageReceived || 0) + splashDamage;

      const newHealth = target.health - splashDamage;

      if (newHealth <= 0) {
        // Target dies from splash - create dead ant
        const deadAnt = createDeadAnt(target);
        updatedGameState.deadAnts = {
          ...updatedGameState.deadAnts,
          [deadAnt.id]: deadAnt
        };
        delete updatedAnts[target.id];

        // Track kills and losses stats
        updatedGameState.stats[attacker.owner].antsKilled = (updatedGameState.stats[attacker.owner].antsKilled || 0) + 1;
        updatedGameState.stats[target.owner].antsLost = (updatedGameState.stats[target.owner].antsLost || 0) + 1;

        if (target.type === 'queen') {
          updatedGameState.gameOver = true;
          updatedGameState.winner = attacker.owner;
        }
      } else {
        updatedAnts[target.id] = {
          ...target,
          health: newHealth
        };
      }
    });
  }

  // Counter-attack: If defender survived and both are in melee range, defender attacks back
  const defenderType = getAntTypeById(defender.type);
  const distance = hexDistance(attacker.position, defender.position);
  const defenderSurvived = updatedAnts[defenderId] && updatedAnts[defenderId].health > 0;
  const isMeleeRange = distance <= 1 && attackerType.attackRange <= 1 && defenderType.attackRange <= 1;

  if (defenderSurvived && isMeleeRange) {
    // Defender counter-attacks with updated health
    const updatedDefender = updatedAnts[defenderId];
    const counterDamage = calculateDamage(updatedDefender, attacker, { ...updatedGameState, ants: updatedAnts });
    damageDealt.push({ damage: counterDamage, position: attacker.position });

    // Update hero power for counter-attack
    updatedGameState = updateHeroPower(updatedGameState, defender.owner, counterDamage); // Defender deals damage
    updatedGameState = updateHeroPower(updatedGameState, attacker.owner, counterDamage); // Attacker receives damage

    // Track counter-attack damage stats
    updatedGameState.stats[defender.owner].damageDealt = (updatedGameState.stats[defender.owner].damageDealt || 0) + counterDamage;
    updatedGameState.stats[attacker.owner].damageReceived = (updatedGameState.stats[attacker.owner].damageReceived || 0) + counterDamage;

    const newAttackerHealth = attacker.health - counterDamage;

    if (newAttackerHealth <= 0) {
      // Attacker dies from counter-attack - create dead ant
      const deadAnt = createDeadAnt(attacker);
      updatedGameState.deadAnts = {
        ...updatedGameState.deadAnts,
        [deadAnt.id]: deadAnt
      };
      delete updatedAnts[attackerId];

      // Track kills and losses stats
      updatedGameState.stats[defender.owner].antsKilled = (updatedGameState.stats[defender.owner].antsKilled || 0) + 1;
      updatedGameState.stats[attacker.owner].antsLost = (updatedGameState.stats[attacker.owner].antsLost || 0) + 1;

      // Grant cannibalism food to defender if they have the upgrade
      const defenderPlayer = updatedGameState.players[defender.owner];
      if (defenderPlayer.upgrades.cannibalism > 0) {
        updatedGameState.players = {
          ...updatedGameState.players,
          [defender.owner]: {
            ...defenderPlayer,
            resources: {
              ...defenderPlayer.resources,
              food: defenderPlayer.resources.food + GameConstants.CANNIBALISM_FOOD_GAIN,
              minerals: defenderPlayer.resources.minerals + GameConstants.CANNIBALISM_MINERAL_GAIN
            }
          }
        };
      }

      // Check if it was a queen (attacker died from counterattack)
      if (attacker.type === 'queen') {
        // Update ants first so checkWinCondition sees the dead queen removed
        updatedGameState.ants = updatedAnts;
        const winResult = checkWinCondition(updatedGameState, defender.owner, attacker.owner);
        updatedGameState.gameOver = winResult.gameOver;
        updatedGameState.winner = winResult.winner;
        updatedGameState.winningTeam = winResult.winningTeam;
      }

      // If attacker was a bomber, trigger detonation
      if (attacker.type === 'bomber') {
        updatedGameState.ants = updatedAnts;
        updatedGameState = detonateBomber(updatedGameState, attackerId);
        return { gameState: updatedGameState, damageDealt, attackAnimation };
      }
    } else {
      updatedAnts[attackerId] = {
        ...attacker,
        health: newAttackerHealth
      };
    }
  }

  return {
    gameState: {
      ...updatedGameState,
      ants: updatedAnts
    },
    damageDealt,
    attackAnimation
  };
}

// Check if an attack is valid
export function canAttack(attacker, defender, gameState) {
  if (!attacker || !defender) return false;

  // Can't attack self or teammates
  if (attacker.owner === defender.owner) return false;
  if (areTeammates(gameState, attacker.owner, defender.owner)) return false;

  // Bombers cannot use normal attack - they can only detonate manually
  if (attacker.type === 'bomber') return false;

  // Burrowed units cannot attack except soldiers/marauders
  if (attacker.isBurrowed && attacker.type !== 'soldier') return false;

  const attackerType = getAntTypeById(attacker.type);
  const distance = hexDistance(attacker.position, defender.position);

  // Get attack range with Sorlorg bonus if active
  let attackRange = attackerType.attackRange;
  const attackerPlayer = gameState.players[attacker.owner];
  if (attackerPlayer?.heroAbilityActive && attackerPlayer?.heroId === 'sorlorg' && attackerType.attackRange > 1) {
    const { getHeroById } = require('./heroQueens');
    const hero = getHeroById('sorlorg');
    if (hero?.heroAbility?.rangedRangeBonus) {
      attackRange += hero.heroAbility.rangedRangeBonus;
    }
  }

  // Check if within attack range
  if (distance > attackRange) return false;

  // Check minimum attack range (e.g., Bombardier cannot attack adjacent enemies)
  if (attackerType.minAttackRange && distance < attackerType.minAttackRange) return false;

  // Check if unit moved this turn and cannot move and attack (Bombardier)
  if (attackerType.cannotMoveAndAttack && attacker.hasMoved) return false;

  return true;
}

// Get all valid attack targets for an ant
export function getValidTargets(antId, gameState) {
  const attacker = gameState.ants[antId];
  if (!attacker) return [];

  const attackerType = getAntTypeById(attacker.type);
  const minRange = attackerType.minAttackRange || 0;

  return Object.values(gameState.ants).filter(ant => {
    // Can't target self or teammates
    if (ant.owner === attacker.owner) return false;
    if (areTeammates(gameState, attacker.owner, ant.owner)) return false;

    const distance = hexDistance(ant.position, attacker.position);
    return distance >= minRange && distance <= attackerType.attackRange;
  });
}

// Move ant to new position (no auto-attack)
export function moveAnt(gameState, antId, targetPosition) {
  const ant = gameState.ants[antId];
  if (!ant) return gameState;

  // Queens cannot move
  if (ant.type === 'queen') {
    return gameState;
  }

  // Normal move - just update position
  return {
    ...gameState,
    ants: {
      ...gameState.ants,
      [antId]: {
        ...ant,
        position: targetPosition
      }
    }
  };
}

// Bombardier splash attack at target hex (affects 3-hex area in a line based on rotation)
export function bombardierSplashAttack(gameState, attackerId, targetHex, rotation = 0) {
  const attacker = gameState.ants[attackerId];
  if (!attacker || attacker.type !== 'bombardier') {
    return { gameState, damageDealt: [], attackAnimation: null };
  }

  const attackerType = AntTypes.BOMBARDIER;
  const attackerPlayer = gameState.players[attacker.owner];

  // Check range to target hex
  const distance = hexDistance(attacker.position, targetHex);
  if (distance < attackerType.minAttackRange || distance > attackerType.attackRange) {
    return { gameState, damageDealt: [], attackAnimation: null };
  }

  // Get 3 hexes in a triangle based on rotation (0-5)
  // Triangle has center hex + one hex pointing in rotation direction + one adjacent to the point
  const directions = [
    { q: 1, r: 0 },   // 0: East
    { q: 1, r: -1 },  // 1: Northeast
    { q: 0, r: -1 },  // 2: Northwest
    { q: -1, r: 0 },  // 3: West
    { q: -1, r: 1 },  // 4: Southwest
    { q: 0, r: 1 }    // 5: Southeast
  ];

  const dir = directions[rotation % 6];
  const leftDir = directions[(rotation + 5) % 6]; // One direction counter-clockwise from rotation

  // Get center + point in rotation direction + left adjacent to the point
  const splashHexes = [
    targetHex, // Center
    { q: targetHex.q + dir.q, r: targetHex.r + dir.r }, // Point
    { q: targetHex.q + leftDir.q, r: targetHex.r + leftDir.r } // Left adjacent
  ];

  // Find all ants in splash area (including friendly fire)
  const affectedAnts = Object.values(gameState.ants).filter(ant => {
    return splashHexes.some(hex =>
      hex.q === ant.position.q && hex.r === ant.position.r
    );
  });

  const updatedAnts = { ...gameState.ants };
  const damageDealt = [];
  let updatedGameState = { ...gameState };
  const { updateHeroPower } = require('./gameState');

  // Initialize stats if needed
  if (!updatedGameState.stats) {
    updatedGameState.stats = { player1: {}, player2: {} };
  }

  // Apply splash damage to all affected ants
  affectedAnts.forEach(target => {
    const targetType = getAntTypeById(target.type);
    const targetPlayer = gameState.players[target.owner];
    const defense = targetType.defense;

    // Splash damage uses splashAttack value
    const damage = Math.max(1, attackerType.splashAttack - Math.floor(defense));
    const newHealth = target.health - damage;

    damageDealt.push({ damage, position: target.position });

    // Update hero power for bombardier splash damage
    updatedGameState = updateHeroPower(updatedGameState, attacker.owner, damage); // Attacker deals damage
    updatedGameState = updateHeroPower(updatedGameState, target.owner, damage); // Target receives damage

    // Track bombardier splash damage stats
    updatedGameState.stats[attacker.owner].damageDealt = (updatedGameState.stats[attacker.owner].damageDealt || 0) + damage;
    updatedGameState.stats[target.owner].damageReceived = (updatedGameState.stats[target.owner].damageReceived || 0) + damage;

    if (newHealth <= 0) {
      // Target dies - create dead ant
      const deadAnt = createDeadAnt(target);
      updatedGameState.deadAnts = {
        ...updatedGameState.deadAnts,
        [deadAnt.id]: deadAnt
      };
      delete updatedAnts[target.id];

      // Track kills and losses stats
      updatedGameState.stats[attacker.owner].antsKilled = (updatedGameState.stats[attacker.owner].antsKilled || 0) + 1;
      updatedGameState.stats[target.owner].antsLost = (updatedGameState.stats[target.owner].antsLost || 0) + 1;

      // Grant cannibalism if applicable (bombardier is ranged, so no cannibalism)

      // Check if killed a queen
      if (target.type === 'queen') {
        updatedGameState.gameOver = true;
        updatedGameState.winner = attacker.owner;
      }

      // If killed a bomber, trigger detonation
      if (target.type === 'bomber') {
        updatedGameState.ants = updatedAnts;
        const detonationResult = detonateBomber(updatedGameState, target.id);
        updatedGameState = detonationResult.gameState;
        if (detonationResult.damageDealt) {
          damageDealt.push(...detonationResult.damageDealt);
        }
      }
    } else {
      updatedAnts[target.id] = {
        ...target,
        health: newHealth
      };
    }
  });

  // Include attack animation data
  const attackAnimation = {
    attackerId: attackerId,
    targetPosition: targetHex,
    isRanged: true,
    isSplash: true
  };

  return {
    gameState: {
      ...updatedGameState,
      ants: updatedAnts
    },
    damageDealt,
    attackAnimation
  };
}

// Resolve ambush when a unit moves into fog of war onto a hidden enemy
// Returns: { gameState, damageDealt, attackAnimations, ambushOccurred }
export function resolveAmbush(gameState, movingAntId, ambusherAntId) {
  const movingAnt = gameState.ants[movingAntId];
  const ambusher = gameState.ants[ambusherAntId];

  if (!movingAnt || !ambusher) {
    return {
      gameState,
      damageDealt: [],
      attackAnimations: [],
      ambushOccurred: false
    };
  }

  const movingAntType = getAntTypeById(movingAnt.type);
  const ambusherType = getAntTypeById(ambusher.type);

  let updatedGameState = { ...gameState };
  let damageDealt = [];
  let attackAnimations = [];

  // Check if combat occurs
  // If hidden unit is ranged, neither unit attacks
  if (ambusherType.attackRange > 1) {
    return {
      gameState: updatedGameState,
      damageDealt,
      attackAnimations,
      ambushOccurred: true // Ambush happened, but no combat
    };
  }

  // Ambusher attacks first
  const ambusherDamage = calculateDamage(ambusher, movingAnt, updatedGameState);
  damageDealt.push({ damage: ambusherDamage, position: movingAnt.position });

  // Add ambusher's attack animation
  attackAnimations.push({
    attackerId: ambusherAntId,
    targetPosition: movingAnt.position,
    isRanged: false
  });

  // Update hero power for ambusher (damage dealt)
  const { updateHeroPower } = require('./gameState');
  updatedGameState = updateHeroPower(updatedGameState, ambusher.owner, ambusherDamage);

  // Update hero power for moving ant (damage received)
  updatedGameState = updateHeroPower(updatedGameState, movingAnt.owner, ambusherDamage, 0.65);

  // Track damage dealt and received stats
  if (!updatedGameState.stats) {
    updatedGameState.stats = { player1: {}, player2: {} };
  }
  updatedGameState.stats[ambusher.owner].damageDealt = (updatedGameState.stats[ambusher.owner].damageDealt || 0) + ambusherDamage;
  updatedGameState.stats[movingAnt.owner].damageReceived = (updatedGameState.stats[movingAnt.owner].damageReceived || 0) + ambusherDamage;

  // Apply damage to moving ant
  const updatedAnts = { ...updatedGameState.ants };
  const newMovingAntHealth = movingAnt.health - ambusherDamage;

  if (newMovingAntHealth <= 0) {
    // Moving ant dies - create dead ant
    const deadAnt = createDeadAnt(movingAnt);
    updatedGameState.deadAnts = {
      ...updatedGameState.deadAnts,
      [deadAnt.id]: deadAnt
    };
    delete updatedAnts[movingAntId];

    // Track kills and losses stats
    updatedGameState.stats[ambusher.owner].antsKilled = (updatedGameState.stats[ambusher.owner].antsKilled || 0) + 1;
    updatedGameState.stats[movingAnt.owner].antsLost = (updatedGameState.stats[movingAnt.owner].antsLost || 0) + 1;

    // Grant cannibalism food if ambusher has the upgrade
    const ambusherPlayer = updatedGameState.players[ambusher.owner];
    if (ambusherPlayer.upgrades.cannibalism > 0) {
      updatedGameState.players = {
        ...updatedGameState.players,
        [ambusher.owner]: {
          ...ambusherPlayer,
          resources: {
            ...ambusherPlayer.resources,
            food: ambusherPlayer.resources.food + GameConstants.CANNIBALISM_FOOD_GAIN,
            minerals: ambusherPlayer.resources.minerals + GameConstants.CANNIBALISM_MINERAL_GAIN
          }
        }
      };
    }

    // Check if moving ant was a queen
    if (movingAnt.type === 'queen') {
      updatedGameState.gameOver = true;
      updatedGameState.winner = ambusher.owner;
    }

    // If moving ant was a bomber, trigger detonation
    if (movingAnt.type === 'bomber') {
      updatedGameState.ants = updatedAnts;
      updatedGameState = detonateBomber(updatedGameState, movingAntId);
    }

    return {
      gameState: {
        ...updatedGameState,
        ants: updatedAnts
      },
      damageDealt,
      attackAnimations,
      ambushOccurred: true
    };
  }

  // Moving ant survived - update health
  updatedAnts[movingAntId] = {
    ...movingAnt,
    health: newMovingAntHealth
  };

  // Counter-attack if moving ant is melee
  if (movingAntType.attackRange <= 1) {
    const updatedMovingAnt = updatedAnts[movingAntId];
    const counterDamage = calculateDamage(updatedMovingAnt, ambusher, { ...updatedGameState, ants: updatedAnts });
    damageDealt.push({ damage: counterDamage, position: ambusher.position });

    // Add counter-attack animation
    attackAnimations.push({
      attackerId: movingAntId,
      targetPosition: ambusher.position,
      isRanged: false
    });

    // Update hero power for counter-attack
    updatedGameState = updateHeroPower(updatedGameState, movingAnt.owner, counterDamage);
    updatedGameState = updateHeroPower(updatedGameState, ambusher.owner, counterDamage, 0.65);

    // Track counter-attack damage stats
    updatedGameState.stats[movingAnt.owner].damageDealt = (updatedGameState.stats[movingAnt.owner].damageDealt || 0) + counterDamage;
    updatedGameState.stats[ambusher.owner].damageReceived = (updatedGameState.stats[ambusher.owner].damageReceived || 0) + counterDamage;

    const newAmbusherHealth = ambusher.health - counterDamage;

    if (newAmbusherHealth <= 0) {
      // Ambusher dies - create dead ant
      const deadAnt = createDeadAnt(ambusher);
      updatedGameState.deadAnts = {
        ...updatedGameState.deadAnts,
        [deadAnt.id]: deadAnt
      };
      delete updatedAnts[ambusherAntId];

      // Track kills and losses stats
      updatedGameState.stats[movingAnt.owner].antsKilled = (updatedGameState.stats[movingAnt.owner].antsKilled || 0) + 1;
      updatedGameState.stats[ambusher.owner].antsLost = (updatedGameState.stats[ambusher.owner].antsLost || 0) + 1;

      // Grant cannibalism if moving ant has the upgrade
      const movingAntPlayer = updatedGameState.players[movingAnt.owner];
      if (movingAntPlayer.upgrades.cannibalism > 0) {
        updatedGameState.players = {
          ...updatedGameState.players,
          [movingAnt.owner]: {
            ...movingAntPlayer,
            resources: {
              ...movingAntPlayer.resources,
              food: movingAntPlayer.resources.food + GameConstants.CANNIBALISM_FOOD_GAIN,
              minerals: movingAntPlayer.resources.minerals + GameConstants.CANNIBALISM_MINERAL_GAIN
            }
          }
        };
      }

      // Check if ambusher was a queen
      if (ambusher.type === 'queen') {
        updatedGameState.gameOver = true;
        updatedGameState.winner = movingAnt.owner;
      }

      // If ambusher was a bomber, trigger detonation
      if (ambusher.type === 'bomber') {
        updatedGameState.ants = updatedAnts;
        updatedGameState = detonateBomber(updatedGameState, ambusherAntId);
      }
    } else {
      updatedAnts[ambusherAntId] = {
        ...ambusher,
        health: newAmbusherHealth
      };
    }
  }

  return {
    gameState: {
      ...updatedGameState,
      ants: updatedAnts
    },
    damageDealt,
    attackAnimations,
    ambushOccurred: true
  };
}
