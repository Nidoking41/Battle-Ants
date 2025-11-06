import React, { useState, useEffect } from 'react';
import './App.css';
import { createInitialGameState, endTurn, markAntMoved, canAfford, deductCost, createEgg, canAffordUpgrade, purchaseUpgrade, buildAnthill, hasEnoughEnergy, getEggLayCost, deductEnergy, healAnt, upgradeQueen, canAffordQueenUpgrade, getSpawningPoolHexes, burrowAnt, unburrowAnt, canBurrow, canUnburrow, teleportAnt, getValidTeleportDestinations, healAlly, ensnareEnemy, getValidHealTargets, getValidEnsnareTargets } from './gameState';
import { moveAnt, resolveCombat, canAttack, detonateBomber, attackAnthill, attackEgg } from './combatSystem';
import { AntTypes, Upgrades, GameConstants, QueenTiers } from './antTypes';
import { hexToPixel, getMovementRange, HexCoord, getNeighbors } from './hexUtils';
import MultiplayerMenu from './MultiplayerMenu';
import { subscribeToGameState, updateGameState, applyFogOfWar, getVisibleHexes } from './multiplayerUtils';

function App() {
  const [gameMode, setGameMode] = useState(null); // null = menu, object = game started
  const [gameState, setGameState] = useState(createInitialGameState());
  const [fullGameState, setFullGameState] = useState(null); // Store unfiltered state for multiplayer
  const [selectedAnt, setSelectedAnt] = useState(null);
  const [selectedAction, setSelectedAction] = useState(null); // 'move', 'layEgg', or 'detonate'
  const [selectedEggHex, setSelectedEggHex] = useState(null); // Store hex for egg laying
  const [showAntTypeSelector, setShowAntTypeSelector] = useState(false); // Show ant type buttons
  const [selectedEgg, setSelectedEgg] = useState(null); // Store selected egg for viewing info
  const [damageNumbers, setDamageNumbers] = useState([]); // Array of {id, damage, position, timestamp}
  const [attackAnimations, setAttackAnimations] = useState([]); // Array of {id, attackerId, targetPos, timestamp, isRanged}
  const [projectiles, setProjectiles] = useState([]); // Array of {id, startPos, endPos, timestamp}
  const [resourceGainNumbers, setResourceGainNumbers] = useState([]); // Array of {id, amount, type, position, timestamp}
  const [explosions, setExplosions] = useState([]); // Array of {id, position, timestamp} for bomber explosions
  const [showHelpGuide, setShowHelpGuide] = useState(false); // Show help/guide popup
  const [showUpgradesModal, setShowUpgradesModal] = useState(false); // Show upgrades modal
  const [attackTarget, setAttackTarget] = useState(null); // Store target enemy when selecting attack position
  const [attackPositions, setAttackPositions] = useState([]); // Valid positions to attack from

  // Camera/view state for pan and zoom
  const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0 }); // Camera position offset
  const [zoomLevel, setZoomLevel] = useState(1.0); // Zoom level (0.5 to 2.0)
  const [isDragging, setIsDragging] = useState(false); // Is user dragging the view
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 }); // Drag start position

  const hexSize = 50;
  const gridRadius = 6; // Creates a hexagon with radius 6
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 2.0;

  // Helper function to compare hex positions (works with HexCoord objects or plain objects)
  const hexEquals = (pos1, pos2) => {
    if (!pos1 || !pos2) return false;
    return pos1.q === pos2.q && pos1.r === pos2.r;
  };

  // Center camera on queen
  const centerOnQueen = () => {
    const currentPlayerId = gameMode?.isMultiplayer ? gameMode.playerRole : gameState.currentPlayer;
    const queen = Object.values(gameState.ants).find(
      ant => ant.type === 'queen' && ant.owner === currentPlayerId
    );

    if (queen) {
      const queenPixel = hexToPixel(queen.position, hexSize);
      // Center on queen (account for the SVG viewport center)
      setCameraOffset({
        x: -queenPixel.x,
        y: -queenPixel.y
      });
    }
  };

  // Camera no longer auto-centers on turn change - players keep their current view

  // Handle mouse down for panning (middle mouse button or ctrl+left click)
  const handleMouseDown = (e) => {
    // Middle mouse button or Ctrl+Left click for panning
    if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
      e.preventDefault();
      setIsDragging(true);
      setDragStart({ x: e.clientX - cameraOffset.x, y: e.clientY - cameraOffset.y });
    }
  };

  // Handle mouse move for panning
  const handleMouseMove = (e) => {
    if (isDragging) {
      setCameraOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  // Handle mouse up for panning
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Handle mouse wheel for zooming
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel + delta));
    setZoomLevel(newZoom);
  };

  // Keyboard controls for panning
  useEffect(() => {
    const handleKeyDown = (e) => {
      const panSpeed = 50;
      switch(e.key) {
        case 'Tab':
          if (isMyTurn()) {
            cycleToNextActiveAnt();
            e.preventDefault();
          }
          break;
        case 'ArrowUp':
        case 'w':
        case 'W':
          setCameraOffset(prev => ({ x: prev.x, y: prev.y + panSpeed }));
          e.preventDefault();
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          setCameraOffset(prev => ({ x: prev.x, y: prev.y - panSpeed }));
          e.preventDefault();
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          setCameraOffset(prev => ({ x: prev.x + panSpeed, y: prev.y }));
          e.preventDefault();
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          setCameraOffset(prev => ({ x: prev.x - panSpeed, y: prev.y }));
          e.preventDefault();
          break;
        case '+':
        case '=':
          setZoomLevel(prev => Math.min(MAX_ZOOM, prev + 0.1));
          e.preventDefault();
          break;
        case '-':
        case '_':
          setZoomLevel(prev => Math.max(MIN_ZOOM, prev - 0.1));
          e.preventDefault();
          break;
        case 'Home':
        case 'c':
        case 'C':
          centerOnQueen();
          e.preventDefault();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, gameMode, selectedAnt]);

  // Function to show damage number
  const showDamageNumber = (damage, position) => {
    const id = `damage_${Date.now()}_${Math.random()}`;
    const newDamage = {
      id,
      damage,
      position,
      timestamp: Date.now()
    };
    setDamageNumbers(prev => [...prev, newDamage]);

    // Remove after animation completes (1 second)
    setTimeout(() => {
      setDamageNumbers(prev => prev.filter(d => d.id !== id));
    }, 1000);
  };

  // Function to trigger attack animation
  const showAttackAnimation = (attackerId, targetPosition, isRanged) => {
    const id = `attack_${Date.now()}_${Math.random()}`;
    const newAnimation = {
      id,
      attackerId,
      targetPos: targetPosition,
      timestamp: Date.now(),
      isRanged
    };
    setAttackAnimations(prev => [...prev, newAnimation]);

    // If ranged, spawn projectile after shake animation (0.2s)
    if (isRanged) {
      setTimeout(() => {
        const attacker = gameState.ants[attackerId];
        if (attacker) {
          const projectileId = `projectile_${Date.now()}_${Math.random()}`;
          setProjectiles(prev => [...prev, {
            id: projectileId,
            startPos: attacker.position,
            endPos: targetPosition,
            timestamp: Date.now()
          }]);
          // Remove projectile after it reaches target (0.3s)
          setTimeout(() => {
            setProjectiles(prev => prev.filter(p => p.id !== projectileId));
          }, 300);
        }
      }, 200);
    }

    // Remove attack animation after completion (melee: 0.4s, ranged: 0.2s)
    setTimeout(() => {
      setAttackAnimations(prev => prev.filter(a => a.id !== id));
    }, isRanged ? 200 : 400);
  };

  // Function to show resource gain number
  const showResourceGain = (amount, type, position) => {
    const id = `resource_${Date.now()}_${Math.random()}`;
    const newGain = {
      id,
      amount,
      type,
      position,
      timestamp: Date.now()
    };
    setResourceGainNumbers(prev => [...prev, newGain]);

    // Remove after animation completes (1 second)
    setTimeout(() => {
      setResourceGainNumbers(prev => prev.filter(r => r.id !== id));
    }, 1000);
  };

  // Animate damage numbers
  useEffect(() => {
    if (damageNumbers.length === 0) return;

    const interval = setInterval(() => {
      // Force re-render for animation
      setDamageNumbers(prev => [...prev]);
    }, 16); // ~60fps

    return () => clearInterval(interval);
  }, [damageNumbers.length]);

  // Animate attack animations
  useEffect(() => {
    if (attackAnimations.length === 0) return;

    const interval = setInterval(() => {
      setAttackAnimations(prev => [...prev]);
    }, 16); // ~60fps

    return () => clearInterval(interval);
  }, [attackAnimations.length]);

  // Animate projectiles
  useEffect(() => {
    if (projectiles.length === 0) return;

    const interval = setInterval(() => {
      setProjectiles(prev => [...prev]);
    }, 16); // ~60fps

    return () => clearInterval(interval);
  }, [projectiles.length]);

  // Animate resource gain numbers
  useEffect(() => {
    if (resourceGainNumbers.length === 0) return;

    const interval = setInterval(() => {
      // Force re-render for animation
      setResourceGainNumbers(prev => [...prev]);
    }, 16); // ~60fps

    return () => clearInterval(interval);
  }, [resourceGainNumbers.length]);

  // Subscribe to multiplayer game state
  useEffect(() => {
    if (gameMode?.isMultiplayer && gameMode.gameId) {
      const unsubscribe = subscribeToGameState(gameMode.gameId, (newState) => {
        // Store the full state for fog of war calculations
        setFullGameState(newState);

        // Check if there was a recent combat action and show animations
        if (newState.lastCombatAction) {
          const { attackerId, targetPosition, isRanged, damageDealt } = newState.lastCombatAction;

          // Check if attacker is visible to current player
          const visibleHexes = getVisibleHexes(newState, gameMode.playerRole);
          const attacker = newState.ants[attackerId];
          const attackerVisible = attacker && visibleHexes.has(`${attacker.position.q},${attacker.position.r}`);
          const targetVisible = visibleHexes.has(`${targetPosition.q},${targetPosition.r}`);

          // Show animation based on visibility
          if (targetVisible) {
            // If target is visible, show appropriate animation
            if (isRanged && !attackerVisible) {
              // Ranged attack from fog of war - only show projectile impact
              if (damageDealt && damageDealt.length > 0) {
                damageDealt.forEach(({ damage, position }) => {
                  showDamageNumber(damage, position);
                });
              }
            } else if (attackerVisible) {
              // Attacker is visible, show full animation
              showAttackAnimation(attackerId, targetPosition, isRanged);
              if (damageDealt && damageDealt.length > 0) {
                setTimeout(() => {
                  damageDealt.forEach(({ damage, position }) => {
                    showDamageNumber(damage, position);
                  });
                }, isRanged ? 300 : 200);
              }
            }
          }
        }

        // Apply fog of war for multiplayer games
        const filteredState = applyFogOfWar(newState, gameMode.playerRole);
        setGameState(filteredState);
      });

      return () => unsubscribe();
    }
  }, [gameMode]);

  // Get the game state to use for game logic (full state for multiplayer, filtered for local)
  const getGameStateForLogic = () => {
    if (gameMode?.isMultiplayer) {
      return fullGameState || gameState;
    }
    return gameState;
  };

  // Update game state (local or multiplayer)
  const updateGame = (newState) => {
    if (gameMode?.isMultiplayer) {
      // For multiplayer, newState is the full unfiltered state
      // Update Firebase with the full state
      if (gameMode.gameId) {
        updateGameState(gameMode.gameId, newState);
      }
      // The Firebase subscription will handle updating both fullGameState and the filtered gameState
    } else {
      // For local games, just update the state directly
      setGameState(newState);
    }
  };

  // Check if it's current player's turn
  const isMyTurn = () => {
    if (!gameMode) return false;
    if (!gameMode.isMultiplayer) return true; // Local game = always your turn
    return gameState.currentPlayer === gameMode.playerRole;
  };

  // Handle start game from menu
  const handleStartGame = (mode) => {
    setGameMode(mode);
    if (!mode.isMultiplayer) {
      setGameState(createInitialGameState());
    }
  };

  // Show menu if game hasn't started
  if (!gameMode) {
    return <MultiplayerMenu onStartGame={handleStartGame} />;
  }

  // Handle detonating a bomber
  const handleDetonate = () => {
    if (!isMyTurn()) {
      alert("It's not your turn!");
      return;
    }

    const currentState = getGameStateForLogic();
    if (!selectedAnt || !currentState.ants[selectedAnt]) return;
    const ant = currentState.ants[selectedAnt];

    if (ant.type !== 'bomber') {
      alert('Only bombers can detonate!');
      return;
    }

    if (ant.hasAttacked) {
      alert('This bomber has already detonated this turn!');
      return;
    }

    // Show explosion animation
    const explosionId = `explosion_${Date.now()}`;
    setExplosions(prev => [...prev, {
      id: explosionId,
      position: ant.position,
      timestamp: Date.now()
    }]);

    // Remove explosion after animation completes (1 second)
    setTimeout(() => {
      setExplosions(prev => prev.filter(e => e.id !== explosionId));
    }, 1000);

    const newState = detonateBomber(currentState, selectedAnt);
    updateGame(newState);
    setSelectedAction(null);
    setSelectedAnt(null);
  };

  // Get enemies in attack range for selected ant
  const getEnemiesInRange = () => {
    if (!selectedAnt) return [];
    const currentState = getGameStateForLogic();
    const ant = currentState.ants[selectedAnt];
    if (!ant) return [];

    // Burrowed units cannot attack (detonate is handled separately)
    if (ant.isBurrowed) return [];

    const antType = AntTypes[ant.type.toUpperCase()];
    const enemies = [];

    Object.values(currentState.ants).forEach(enemyAnt => {
      if (enemyAnt.owner !== ant.owner) {
        const distance = Math.max(
          Math.abs(ant.position.q - enemyAnt.position.q),
          Math.abs(ant.position.r - enemyAnt.position.r),
          Math.abs((-ant.position.q - ant.position.r) - (-enemyAnt.position.q - enemyAnt.position.r))
        );
        if (distance <= antType.attackRange) {
          enemies.push(enemyAnt);
        }
      }
    });

    return enemies;
  };

  // Check if ant can still perform actions after moving
  const canAntStillAct = (antId, state) => {
    const ant = state.ants?.[antId];
    if (!ant || ant.hasAttacked) return false;

    const antType = AntTypes[ant.type.toUpperCase()];

    // Check if can attack enemies
    const hasEnemiesInRange = state.ants ? Object.values(state.ants).some(enemyAnt => {
      if (enemyAnt.owner !== ant.owner) {
        const distance = Math.max(
          Math.abs(ant.position.q - enemyAnt.position.q),
          Math.abs(ant.position.r - enemyAnt.position.r),
          Math.abs((-ant.position.q - ant.position.r) - (-enemyAnt.position.q - enemyAnt.position.r))
        );
        return distance <= antType.attackRange;
      }
      return false;
    }) : false;

    if (hasEnemiesInRange) return true;

    // Check if can attack eggs
    const hasEggsInRange = state.eggs ? Object.values(state.eggs).some(egg => {
      if (egg.owner !== ant.owner) {
        const distance = Math.max(
          Math.abs(ant.position.q - egg.position.q),
          Math.abs(ant.position.r - egg.position.r),
          Math.abs((-ant.position.q - ant.position.r) - (-egg.position.q - egg.position.r))
        );
        return distance <= antType.attackRange;
      }
      return false;
    }) : false;

    if (hasEggsInRange) return true;

    // Check if can attack anthills
    const hasAnthillsInRange = state.anthills ? Object.values(state.anthills).some(anthill => {
      if (anthill.owner !== ant.owner) {
        const distance = Math.max(
          Math.abs(ant.position.q - anthill.position.q),
          Math.abs(ant.position.r - anthill.position.r),
          Math.abs((-ant.position.q - ant.position.r) - (-anthill.position.q - anthill.position.r))
        );
        return distance <= antType.attackRange;
      }
      return false;
    }) : false;

    if (hasAnthillsInRange) return true;

    // Check if drone can build anthill
    if (ant.type === 'drone') {
      const isOnResourceNode = state.resourceNodes ? Object.values(state.resourceNodes).some(
        node => node.position.q === ant.position.q && node.position.r === ant.position.r
      ) : false;
      if (isOnResourceNode) return true;
    }

    return false;
  };

  // Handle hex click
  const handleHexClick = (hex) => {
    if (!isMyTurn()) {
      alert("It's not your turn!");
      return;
    }

    // If detonating a bomber (click anywhere to confirm)
    if (selectedAction === 'detonate' && selectedAnt) {
      handleDetonate();
      return;
    }

    const currentState = getGameStateForLogic();

    // If attacking
    if (selectedAction === 'attack' && selectedAnt) {
      const ant = currentState.ants[selectedAnt];

      // Check if ant has already attacked
      if (ant.hasAttacked) {
        alert('This unit has already attacked this turn!');
        return;
      }

      // Find if there's an enemy at the clicked hex
      const enemyAtHex = Object.values(currentState.ants).find(
        a => hexEquals(a.position, hex) && a.owner !== ant.owner
      );

      // Find if there's an enemy egg at the clicked hex
      const eggAtHex = Object.values(currentState.eggs || {}).find(
        e => hexEquals(e.position, hex) && e.owner !== ant.owner
      );

      // Find if there's an enemy anthill at the clicked hex (complete or incomplete)
      const anthillAtHex = Object.values(currentState.anthills || {}).find(
        a => hexEquals(a.position, hex) && a.owner !== ant.owner
      );

      // If there's an ant on the hex, must attack the ant first
      if (enemyAtHex) {
        // Check if enemy is in range
        if (canAttack(ant, enemyAtHex, currentState)) {
          // Determine if this is a ranged attack
          const antType = AntTypes[ant.type.toUpperCase()];
          const isRanged = antType.attackRange > 1;

          // Show attack animation
          showAttackAnimation(selectedAnt, enemyAtHex.position, isRanged);

          // Delay damage and state update to match animation timing
          setTimeout(() => {
            const combatResult = resolveCombat(currentState, selectedAnt, enemyAtHex.id);
            const newState = combatResult.gameState;

            // Show damage numbers
            combatResult.damageDealt.forEach(({ damage, position }) => {
              showDamageNumber(damage, position);
            });

            // Mark ant as having attacked and store combat action for multiplayer
            const markedState = {
              ...newState,
              ants: {
                ...newState.ants,
                [selectedAnt]: newState.ants[selectedAnt] ? {
                  ...newState.ants[selectedAnt],
                  hasAttacked: true
                } : undefined
              },
              // Store combat action for multiplayer animation replay
              lastCombatAction: combatResult.attackAnimation ? {
                ...combatResult.attackAnimation,
                damageDealt: combatResult.damageDealt,
                timestamp: Date.now()
              } : undefined
            };
            // Remove undefined ants (in case the attacker died in combat)
            if (markedState.ants[selectedAnt] === undefined) {
              delete markedState.ants[selectedAnt];
            }
            updateGame(markedState);
            setSelectedAction(null);
            setSelectedAnt(null);
          }, isRanged ? 500 : 400); // Ranged: wait for projectile, Melee: wait for lunge
          return;
        } else {
          alert('Enemy is out of attack range!');
          return;
        }
      }
      // If there's an egg and no ant, can attack the egg
      else if (eggAtHex) {
        // Check if egg is in range
        const antType = AntTypes[ant.type.toUpperCase()];
        const distance = Math.max(
          Math.abs(ant.position.q - eggAtHex.position.q),
          Math.abs(ant.position.r - eggAtHex.position.r),
          Math.abs((-ant.position.q - ant.position.r) - (-eggAtHex.position.q - eggAtHex.position.r))
        );

        if (distance > antType.attackRange) {
          alert('Egg is out of attack range!');
          return;
        }

        // Check minimum attack range
        if (antType.minAttackRange && distance < antType.minAttackRange) {
          alert('Too close! This unit cannot attack at this range.');
          return;
        }

        // Determine if this is a ranged attack
        const isRanged = antType.attackRange > 1;

        // Show attack animation
        showAttackAnimation(selectedAnt, eggAtHex.position, isRanged);

        // Delay damage and state update to match animation timing
        setTimeout(() => {
          const combatResult = attackEgg(currentState, selectedAnt, eggAtHex.id);
          const newState = combatResult.gameState;

          // Show damage numbers
          combatResult.damageDealt.forEach(({ damage, position }) => {
            showDamageNumber(damage, position);
          });

          // Mark ant as having attacked and store combat action for multiplayer
          const markedState = {
            ...newState,
            ants: {
              ...newState.ants,
              [selectedAnt]: {
                ...newState.ants[selectedAnt],
                hasAttacked: true
              }
            },
            // Store combat action for multiplayer animation replay
            lastCombatAction: combatResult.attackAnimation ? {
              ...combatResult.attackAnimation,
              damageDealt: combatResult.damageDealt,
              timestamp: Date.now()
            } : undefined
          };
          updateGame(markedState);
          setSelectedAction(null);
          setSelectedAnt(null);
        }, isRanged ? 500 : 400);
        return;
      }
      // If there's an anthill and no ant/egg, can attack the anthill
      else if (anthillAtHex) {
        // Check if anthill is in range
        const antType = AntTypes[ant.type.toUpperCase()];
        const distance = Math.max(
          Math.abs(ant.position.q - anthillAtHex.position.q),
          Math.abs(ant.position.r - anthillAtHex.position.r),
          Math.abs((-ant.position.q - ant.position.r) - (-anthillAtHex.position.q - anthillAtHex.position.r))
        );

        if (distance > antType.attackRange) {
          alert('Anthill is out of attack range!');
          return;
        }

        // Check minimum attack range
        if (antType.minAttackRange && distance < antType.minAttackRange) {
          alert('Too close! This unit cannot attack at this range.');
          return;
        }

        // Determine if this is a ranged attack
        const isRanged = antType.attackRange > 1;

        // Show attack animation
        showAttackAnimation(selectedAnt, anthillAtHex.position, isRanged);

        // Delay damage and state update to match animation timing
        setTimeout(() => {
          const combatResult = attackAnthill(currentState, selectedAnt, anthillAtHex.id);
          const newState = combatResult.gameState;

          // Show damage numbers
          combatResult.damageDealt.forEach(({ damage, position }) => {
            showDamageNumber(damage, position);
          });

          // Mark ant as having attacked and store combat action for multiplayer
          const markedState = {
            ...newState,
            ants: {
              ...newState.ants,
              [selectedAnt]: {
                ...newState.ants[selectedAnt],
                hasAttacked: true
              }
            },
            // Store combat action for multiplayer animation replay
            lastCombatAction: combatResult.attackAnimation ? {
              ...combatResult.attackAnimation,
              damageDealt: combatResult.damageDealt,
              timestamp: Date.now()
            } : undefined
          };
          updateGame(markedState);
          setSelectedAction(null);
          setSelectedAnt(null);
        }, isRanged ? 500 : 400);
        return;
      }
      // No valid target
      else {
        alert('No enemy at that location!');
        return;
      }
    }

    // If healing (Queen only)
    if (selectedAction === 'heal' && selectedAnt) {
      const queen = currentState.ants[selectedAnt];

      // Check if it's a queen
      if (queen.type !== 'queen') {
        alert('Only queens can heal!');
        setSelectedAction(null);
        return;
      }

      // Check if queen has already attacked (healing is a terminal action)
      if (queen.hasAttacked) {
        alert('This queen has already used a terminal action this turn!');
        return;
      }

      // Check energy
      if (!hasEnoughEnergy(queen, GameConstants.HEAL_ENERGY_COST)) {
        alert(`Not enough energy! Need ${GameConstants.HEAL_ENERGY_COST} energy to heal.`);
        return;
      }

      // Find if there's a friendly unit at the clicked hex
      const friendlyAtHex = Object.values(currentState.ants).find(
        a => hexEquals(a.position, hex) && a.owner === queen.owner
      );

      if (!friendlyAtHex) {
        alert('No friendly unit at that location!');
        return;
      }

      // Check if unit is already at full health
      if (friendlyAtHex.health >= friendlyAtHex.maxHealth) {
        alert('That unit is already at full health!');
        return;
      }

      // Check if within heal range (queen's attack range)
      const antType = AntTypes[queen.type.toUpperCase()];
      const distance = Math.max(
        Math.abs(queen.position.q - friendlyAtHex.position.q),
        Math.abs(queen.position.r - friendlyAtHex.position.r),
        Math.abs((-queen.position.q - queen.position.r) - (-friendlyAtHex.position.q - friendlyAtHex.position.r))
      );

      if (distance > antType.attackRange) {
        alert('Target is out of heal range!');
        return;
      }

      // Perform heal
      const newState = healAnt(currentState, selectedAnt, friendlyAtHex.id);

      // Show heal animation (green +HP number)
      const healAmount = Math.min(GameConstants.HEAL_AMOUNT, friendlyAtHex.maxHealth - friendlyAtHex.health);
      showResourceGain(healAmount, 'heal', friendlyAtHex.position); // Reuse resource gain animation

      updateGame(newState);
      setSelectedAction(null);
      setSelectedAnt(null);
      return;
    }

    // If laying egg
    if (selectedAction === 'layEgg' && selectedAnt) {
      const ant = currentState.ants[selectedAnt];

      // Only queens can lay eggs
      if (ant.type !== 'queen') {
        alert('Only queens can lay eggs!');
        setSelectedAction(null);
        return;
      }

      // Check if hex is in the spawning pool
      const spawningPool = getSpawningPoolHexes(ant, getNeighbors);
      const isInSpawningPool = spawningPool.some(n => hexEquals(n, hex));

      if (!isInSpawningPool) {
        const queenTier = QueenTiers[ant.queenTier || 'queen'];
        alert(`Can only lay eggs in the ${queenTier.spawningSpots} spawning pool hexes adjacent to your queen!`);
        return;
      }

      // Check if hex is empty
      const occupied = Object.values(currentState.ants).some(a => hexEquals(a.position, hex)) ||
                       Object.values(currentState.eggs).some(e => hexEquals(e.position, hex));

      if (occupied) {
        alert('Space is occupied!');
        return;
      }

      // If we have a selected ant type from clicking a button, lay the egg
      if (selectedEggHex && selectedEggHex.antType) {
        handleLayEgg(selectedEggHex.antType, hex);
        return;
      }

      // Otherwise, show ant type selector
      setSelectedEggHex(hex);
      setShowAntTypeSelector(true);
      return;
    }

    // If building anthill
    if (selectedAction === 'buildAnthill' && selectedAnt) {
      const drone = currentState.ants[selectedAnt];

      // Only drones can build anthills
      if (drone.type !== 'drone') {
        alert('Only drones can build anthills!');
        setSelectedAction(null);
        return;
      }

      // Find the resource at the clicked hex
      const resourceAtHex = Object.values(currentState.resources).find(
        r => hexEquals(r.position, hex)
      );

      if (!resourceAtHex) {
        alert('Click on a resource node to build an anthill!');
        return;
      }

      // Check if drone is adjacent to or on the resource (distance <= 1)
      const distance = Math.max(
        Math.abs(drone.position.q - resourceAtHex.position.q),
        Math.abs(drone.position.r - resourceAtHex.position.r),
        Math.abs((-drone.position.q - drone.position.r) - (-resourceAtHex.position.q - resourceAtHex.position.r))
      );

      if (distance > 1) {
        alert('Must be adjacent to or on the resource node to build an anthill!');
        return;
      }

      // Check if there's already a completed anthill at the resource location
      const existingAnthill = Object.values(currentState.anthills || {}).find(
        a => hexEquals(a.position, resourceAtHex.position)
      );

      // Get resource hex label for better user feedback
      const resourceLabel = String.fromCharCode(65 + resourceAtHex.position.q + 6) + (resourceAtHex.position.r + 7);

      if (existingAnthill && existingAnthill.isComplete && existingAnthill.owner === drone.owner) {
        alert(`There is already a completed ${existingAnthill.resourceType} anthill at ${resourceLabel}!`);
        return;
      }

      if (existingAnthill && existingAnthill.owner !== drone.owner) {
        alert(`Cannot build on enemy anthill at ${resourceLabel}! Destroy it first.`);
        return;
      }

      // Check if player can afford to start a new anthill
      if (!existingAnthill) {
        const player = currentState.players[drone.owner];
        if (player.resources.food < GameConstants.ANTHILL_BUILD_COST) {
          alert(`Not enough food to start building an anthill! Cost: ${GameConstants.ANTHILL_BUILD_COST} food`);
          return;
        }
      }

      // Build or continue building the anthill
      const newState = buildAnthill(currentState, selectedAnt, resourceAtHex.id);
      updateGame(newState);
      setSelectedAction(null);
      setSelectedAnt(null);
      return;
    }

    // If moving ant
    if (selectedAction === 'move' && selectedAnt) {
      const ant = currentState.ants[selectedAnt];

      // Check if clicking on an enemy to attack
      const enemyAtHex = Object.values(currentState.ants).find(
        a => hexEquals(a.position, hex) && a.owner !== ant.owner
      );

      // Check if clicking on an enemy egg to attack
      const eggAtHex = Object.values(currentState.eggs || {}).find(
        e => hexEquals(e.position, hex) && e.owner !== ant.owner
      );

      // Check if clicking on an enemy anthill to attack (complete or incomplete)
      const anthillAtHex = Object.values(currentState.anthills || {}).find(
        a => hexEquals(a.position, hex) && a.owner !== ant.owner
      );

      // If there's an enemy ant, prioritize attacking the ant
      if (enemyAtHex) {
        // Check if ant has already attacked
        if (ant.hasAttacked) {
          alert('This unit has already attacked this turn!');
          return;
        }

        // Check if we can attack this enemy
        if (canAttack(ant, enemyAtHex, currentState)) {
          // Determine if this is a ranged attack
          const antType = AntTypes[ant.type.toUpperCase()];
          const isRanged = antType.attackRange > 1;

          // Show attack animation
          showAttackAnimation(selectedAnt, enemyAtHex.position, isRanged);

          // Delay damage and state update to match animation timing
          setTimeout(() => {
            const combatResult = resolveCombat(currentState, selectedAnt, enemyAtHex.id);
            const newState = combatResult.gameState;

            // Show damage numbers
            combatResult.damageDealt.forEach(({ damage, position }) => {
              showDamageNumber(damage, position);
            });

            // Mark as both moved and attacked after attacking and store combat action for multiplayer
            const markedState = {
              ...newState,
              ants: {
                ...newState.ants,
                [selectedAnt]: {
                  ...newState.ants[selectedAnt],
                  hasMoved: true,
                  hasAttacked: true
                }
              },
              // Store combat action for multiplayer animation replay
              lastCombatAction: combatResult.attackAnimation ? {
                ...combatResult.attackAnimation,
                damageDealt: combatResult.damageDealt,
                timestamp: Date.now()
              } : undefined
            };
            updateGame(markedState);
            setSelectedAction(null);
            setSelectedAnt(null);
          }, isRanged ? 500 : 400);
          return;
        } else {
          alert('Enemy is out of attack range!');
          return;
        }
      }
      // If there's an enemy egg and no ant, can attack the egg
      else if (eggAtHex) {
        // Check if ant has already attacked
        if (ant.hasAttacked) {
          alert('This unit has already attacked this turn!');
          return;
        }

        // Check if egg is in range
        const antType = AntTypes[ant.type.toUpperCase()];
        const distance = Math.max(
          Math.abs(ant.position.q - eggAtHex.position.q),
          Math.abs(ant.position.r - eggAtHex.position.r),
          Math.abs((-ant.position.q - ant.position.r) - (-eggAtHex.position.q - eggAtHex.position.r))
        );

        if (distance > antType.attackRange) {
          alert('Egg is out of attack range!');
          return;
        }

        // Check minimum attack range
        if (antType.minAttackRange && distance < antType.minAttackRange) {
          alert('Too close! This unit cannot attack at this range.');
          return;
        }

        // Determine if this is a ranged attack
        const isRanged = antType.attackRange > 1;

        // Show attack animation
        showAttackAnimation(selectedAnt, eggAtHex.position, isRanged);

        // Delay damage and state update to match animation timing
        setTimeout(() => {
          const combatResult = attackEgg(currentState, selectedAnt, eggAtHex.id);
          const newState = combatResult.gameState;

          // Show damage numbers
          combatResult.damageDealt.forEach(({ damage, position }) => {
            showDamageNumber(damage, position);
          });

          // Mark as both moved and attacked after attacking and store combat action for multiplayer
          const markedState = {
            ...newState,
            ants: {
              ...newState.ants,
              [selectedAnt]: {
                ...newState.ants[selectedAnt],
                hasMoved: true,
                hasAttacked: true
              }
            },
            // Store combat action for multiplayer animation replay
            lastCombatAction: combatResult.attackAnimation ? {
              ...combatResult.attackAnimation,
              damageDealt: combatResult.damageDealt,
              timestamp: Date.now()
            } : undefined
          };
          updateGame(markedState);
          setSelectedAction(null);
          setSelectedAnt(null);
        }, isRanged ? 500 : 400);
        return;
      }
      // If there's an enemy anthill and no ant/egg, can attack the anthill
      else if (anthillAtHex) {
        // Check if ant has already attacked
        if (ant.hasAttacked) {
          alert('This unit has already attacked this turn!');
          return;
        }

        // Check if anthill is in range
        const antType = AntTypes[ant.type.toUpperCase()];
        const distance = Math.max(
          Math.abs(ant.position.q - anthillAtHex.position.q),
          Math.abs(ant.position.r - anthillAtHex.position.r),
          Math.abs((-ant.position.q - ant.position.r) - (-anthillAtHex.position.q - anthillAtHex.position.r))
        );

        if (distance > antType.attackRange) {
          alert('Anthill is out of attack range!');
          return;
        }

        // Check minimum attack range
        if (antType.minAttackRange && distance < antType.minAttackRange) {
          alert('Too close! This unit cannot attack at this range.');
          return;
        }

        // Determine if this is a ranged attack
        const isRanged = antType.attackRange > 1;

        // Show attack animation
        showAttackAnimation(selectedAnt, anthillAtHex.position, isRanged);

        // Delay damage and state update to match animation timing
        setTimeout(() => {
          const combatResult = attackAnthill(currentState, selectedAnt, anthillAtHex.id);
          const newState = combatResult.gameState;

          // Show damage numbers
          combatResult.damageDealt.forEach(({ damage, position }) => {
            showDamageNumber(damage, position);
          });

          // Mark as both moved and attacked after attacking and store combat action for multiplayer
          const markedState = {
            ...newState,
            ants: {
              ...newState.ants,
              [selectedAnt]: {
                ...newState.ants[selectedAnt],
                hasMoved: true,
                hasAttacked: true
              }
            },
            // Store combat action for multiplayer animation replay
            lastCombatAction: combatResult.attackAnimation ? {
              ...combatResult.attackAnimation,
              damageDealt: combatResult.damageDealt,
              timestamp: Date.now()
            } : undefined
          };
          updateGame(markedState);
          setSelectedAction(null);
          setSelectedAnt(null);
        }, isRanged ? 500 : 400);
        return;
      }

      // Check if ant has already attacked (can't move after attacking)
      if (ant.hasAttacked) {
        alert('This unit has already attacked and cannot move!');
        return;
      }

      // Check if ant has already moved
      if (ant.hasMoved) {
        alert('This unit has already moved this turn!');
        return;
      }

      // Queens cannot move
      if (ant.type === 'queen') {
        alert('Queens cannot move! They stay on their throne.');
        return;
      }

      const antType = AntTypes[ant.type.toUpperCase()];
      const validMoves = getMovementRange(ant.position, antType.moveRange, gridRadius);

      if (validMoves.some(h => hexEquals(h, hex))) {
        // Check if there's ANY ant at the target position
        const antAtHex = Object.values(currentState.ants).find(
          a => hexEquals(a.position, hex)
        );

        if (antAtHex) {
          alert('Cannot move to a space occupied by another ant!');
          return;
        }

        // Check if there's an egg at the target position
        const eggAtHex = Object.values(currentState.eggs).find(e => hexEquals(e.position, hex));
        if (eggAtHex) {
          alert('Cannot move to a space occupied by an egg!');
          return;
        }

        // Ants can now move onto anthills (no restriction needed)

        const newState = moveAnt(currentState, selectedAnt, hex);
        const finalState = markAntMoved(newState, selectedAnt);
        updateGame(finalState);

        // Keep ant selected if it can still perform actions
        if (canAntStillAct(selectedAnt, finalState)) {
          setSelectedAction(null); // Clear the move action
          // selectedAnt stays selected
        } else {
          setSelectedAction(null);
          setSelectedAnt(null);
        }
      } else {
        alert('Invalid move!');
      }
      return;
    }

    // If teleporting ant
    if (selectedAction === 'teleport' && selectedAnt) {
      const ant = currentState.ants[selectedAnt];
      const validDestinations = getValidTeleportDestinations(currentState, selectedAnt);

      // Check if clicked hex contains a valid destination anthill
      const destinationAnthill = validDestinations.find(
        anthill => hexEquals(anthill.position, hex)
      );

      if (destinationAnthill) {
        const newState = teleportAnt(currentState, selectedAnt, destinationAnthill.id);
        updateGame(newState);
        setSelectedAction(null);
        setSelectedAnt(null);
      } else {
        alert('Invalid teleport destination! Must click on a friendly anthill.');
      }
      return;
    }

    // If using heal ability (healer only)
    if (selectedAction === 'heal' && selectedAnt) {
      const healer = currentState.ants[selectedAnt];
      if (!healer || healer.type !== 'healer') return;

      // Find if there's an ally at the clicked hex
      const allyAtHex = Object.values(currentState.ants).find(
        a => hexEquals(a.position, hex) && a.owner === healer.owner
      );

      if (allyAtHex) {
        const newState = healAlly(currentState, selectedAnt, allyAtHex.id);
        updateGame(newState);
        setSelectedAction(null);
        setSelectedAnt(null);
      } else {
        alert('Invalid heal target! Must click on a wounded ally.');
      }
      return;
    }

    // If using ensnare ability (healer only)
    if (selectedAction === 'ensnare' && selectedAnt) {
      const healer = currentState.ants[selectedAnt];
      if (!healer || healer.type !== 'healer') return;

      // Find if there's an enemy at the clicked hex
      const enemyAtHex = Object.values(currentState.ants).find(
        a => hexEquals(a.position, hex) && a.owner !== healer.owner
      );

      if (enemyAtHex) {
        const newState = ensnareEnemy(currentState, selectedAnt, enemyAtHex.id);
        updateGame(newState);
        setSelectedAction(null);
        setSelectedAnt(null);
      } else {
        alert('Invalid ensnare target! Must click on an enemy unit.');
      }
      return;
    }

    // Check if clicking on an egg
    const clickedEgg = Object.values(currentState.eggs).find(e => hexEquals(e.position, hex));
    if (clickedEgg) {
      setSelectedEgg(clickedEgg);
      setSelectedAnt(null);
      setSelectedAction(null);
      return;
    }

    // If an ant is selected and user clicks on an enemy, handle smart attack
    if (selectedAnt && selectedAction === 'move') {
      const ant = currentState.ants[selectedAnt];
      const clickedEnemy = Object.values(currentState.ants).find(
        a => hexEquals(a.position, hex) && a.owner !== ant.owner
      );

      if (clickedEnemy) {
        const antType = AntTypes[ant.type.toUpperCase()];

        // Check if enemy is already in attack range
        if (canAttack(ant, clickedEnemy, currentState)) {
          // Enemy is in range, attack directly
          setSelectedAction('attack');
          // Trigger attack in next frame
          setTimeout(() => handleHexClick(hex), 0);
          return;
        }

        // Check if ant has already moved
        if (ant.hasMoved) {
          alert('This unit has already moved and cannot reach the enemy!');
          return;
        }

        // Enemy not in range - find positions we can move to that would put enemy in range
        const validMoves = getMovementRange(ant.position, antType.moveRange, gridRadius);
        const attackablePositions = validMoves.filter(movePos => {
          // Check if this position is occupied by a friendly unit
          const occupiedByFriendly = Object.values(currentState.ants).some(
            a => a.id !== ant.id && a.owner === ant.owner && hexEquals(a.position, movePos)
          );
          if (occupiedByFriendly) return false;

          // Calculate distance from this position to enemy
          const distance = Math.max(
            Math.abs(movePos.q - clickedEnemy.position.q),
            Math.abs(movePos.r - clickedEnemy.position.r),
            Math.abs((-movePos.q - movePos.r) - (-clickedEnemy.position.q - clickedEnemy.position.r))
          );

          // Check if enemy would be in attack range from this position
          return distance <= antType.attackRange && (!antType.minAttackRange || distance >= antType.minAttackRange);
        });

        if (attackablePositions.length === 0) {
          alert('Cannot reach enemy to attack!');
          return;
        } else if (attackablePositions.length === 1) {
          // Only one position - auto-move there
          const movePos = attackablePositions[0];
          const newState = moveAnt(currentState, selectedAnt, movePos);
          const markedState = markAntMoved(newState, selectedAnt);
          updateGame(markedState);

          // Keep ant selected and set to attack mode, targeting the enemy
          setSelectedAction('attack');
          setTimeout(() => handleHexClick(clickedEnemy.position), 100);
          return;
        } else {
          // Multiple positions - let user choose
          setAttackTarget(clickedEnemy);
          setAttackPositions(attackablePositions);
          alert('Click on a hex to attack from (highlighted in red)');
          return;
        }
      }
    }

    // If selecting an attack position from multiple options
    if (attackTarget && attackPositions.length > 0) {
      const selectedPosition = attackPositions.find(pos => hexEquals(pos, hex));
      if (selectedPosition) {
        const ant = currentState.ants[selectedAnt];
        // Move to selected position
        const newState = moveAnt(currentState, selectedAnt, selectedPosition);
        const markedState = markAntMoved(newState, selectedAnt);
        updateGame(markedState);

        // Clear attack position selection
        setAttackPositions([]);

        // Set to attack mode and attack the target
        setSelectedAction('attack');
        setTimeout(() => {
          handleHexClick(attackTarget.position);
          setAttackTarget(null);
        }, 100);
        return;
      } else {
        // Clicked somewhere else - cancel attack position selection
        setAttackTarget(null);
        setAttackPositions([]);
      }
    }

    // Select ant and auto-select move action
    const clickedAnt = Object.values(currentState.ants).find(
      a => hexEquals(a.position, hex) && a.owner === currentState.currentPlayer
    );

    if (clickedAnt) {
      // If clicking on the already-selected ant, deselect it
      if (selectedAnt === clickedAnt.id) {
        setSelectedAnt(null);
        setSelectedAction(null);
        setSelectedEgg(null);
        return;
      }

      // If the ant has already moved and attacked, inform the user and don't select it
      if (clickedAnt.hasMoved && clickedAnt.hasAttacked) {
        alert('This unit has already completed all actions this turn!');
        setSelectedAnt(null);
        setSelectedAction(null);
        setSelectedEgg(null);
        return;
      }

      // If the ant has only attacked (can't move after attacking), inform the user
      if (clickedAnt.hasAttacked && clickedAnt.type !== 'queen') {
        alert('This unit has already attacked and cannot move!');
        setSelectedAnt(null);
        setSelectedAction(null);
        setSelectedEgg(null);
        return;
      }

      setSelectedAnt(clickedAnt.id);
      // Auto-select action based on unit type:
      // - Queens: lay egg
      // - Others (including bombers): move
      if (clickedAnt.type === 'queen') {
        setSelectedAction('layEgg');
      } else {
        setSelectedAction('move');
      }
      setSelectedEgg(null);
    }
  };

  // Handle laying egg with selected ant type
  const handleLayEgg = (antType, hexPosition) => {
    const currentState = getGameStateForLogic();
    const currentPlayer = currentState.players[currentState.currentPlayer];
    const type = antType.toUpperCase();

    // Find the queen
    const queen = Object.values(currentState.ants).find(
      ant => ant.type === 'queen' && ant.owner === currentState.currentPlayer
    );

    if (!queen) {
      alert('No queen found!');
      return;
    }

    // Check energy cost
    const energyCost = getEggLayCost(queen);
    if (!hasEnoughEnergy(queen, energyCost)) {
      alert(`Not enough energy! Need ${energyCost} energy to lay an egg.`);
      return;
    }

    if (!canAfford(currentPlayer, type)) {
      alert('Not enough resources!');
      return;
    }

    // Use provided hex position or the stored one
    const eggPosition = hexPosition || (selectedEggHex && !selectedEggHex.antType ? selectedEggHex : null);

    if (!eggPosition) {
      alert('Select a tile next to your queen to lay the egg!');
      return;
    }

    // Lay egg
    const newEgg = createEgg(type, currentState.currentPlayer, eggPosition, currentState.turn);
    const updatedPlayer = deductCost(currentPlayer, type);
    const updatedQueen = deductEnergy(queen, energyCost);

    updateGame({
      ...currentState,
      players: {
        ...currentState.players,
        [currentState.currentPlayer]: updatedPlayer
      },
      eggs: {
        ...currentState.eggs,
        [newEgg.id]: newEgg
      },
      ants: {
        ...currentState.ants,
        [queen.id]: updatedQueen
      }
    });

    setSelectedAction(null);
    setSelectedAnt(null);
    setSelectedEggHex(null);
    setShowAntTypeSelector(false);
  };

  // Cycle to next ant with remaining actions
  const cycleToNextActiveAnt = () => {
    const currentState = getGameStateForLogic();
    const currentPlayerId = gameMode?.isMultiplayer ? gameMode.playerRole : currentState.currentPlayer;

    // Get all ants with remaining actions
    const antsWithActions = Object.values(currentState.ants).filter(ant =>
      ant.owner === currentPlayerId && hasRemainingActions(ant)
    );

    if (antsWithActions.length === 0) {
      alert('No ants with available actions!');
      return;
    }

    // Find current selected ant index
    let currentIndex = -1;
    if (selectedAnt) {
      currentIndex = antsWithActions.findIndex(ant => ant.id === selectedAnt);
    }

    // Get next ant (wrap around to start)
    const nextIndex = (currentIndex + 1) % antsWithActions.length;
    const nextAnt = antsWithActions[nextIndex];

    // Select the ant and auto-select appropriate action
    setSelectedAnt(nextAnt.id);
    setSelectedEgg(null);

    if (nextAnt.type === 'queen') {
      setSelectedAction('layEgg');
    } else {
      setSelectedAction('move');
    }

    // Center camera on the selected ant
    const queenPixel = hexToPixel(nextAnt.position, hexSize);
    setCameraOffset({
      x: -queenPixel.x,
      y: -queenPixel.y
    });
  };

  // Check if an ant has any remaining actions this turn
  const hasRemainingActions = (ant) => {
    if (!ant) return false;

    // Not the current player's ant - no actions available
    const currentState = getGameStateForLogic();
    if (ant.owner !== currentState.currentPlayer) return false;

    const antType = AntTypes[ant.type.toUpperCase()];

    // If already attacked, no more actions
    if (ant.hasAttacked) return false;

    // If already moved, check for remaining actions
    if (ant.hasMoved) {
      // Drones can't build if they've already moved (build counts as their move action)
      if (antType.canBuildAnthill) {
        // Check if there are any enemies in attack range (can still attack after building)
        const enemiesInRange = Object.values(currentState.ants).filter(otherAnt => {
          if (otherAnt.owner === ant.owner) return false;
          const distance = Math.max(
            Math.abs(ant.position.q - otherAnt.position.q),
            Math.abs(ant.position.r - otherAnt.position.r),
            Math.abs((-ant.position.q - ant.position.r) - (-otherAnt.position.q - otherAnt.position.r))
          );
          const minRange = antType.minAttackRange || 0;
          return distance >= minRange && distance <= antType.attackRange;
        });

        return enemiesInRange.length > 0;
      }

      // Check if there are any enemies in attack range
      const enemiesInRange = Object.values(currentState.ants).filter(otherAnt => {
        if (otherAnt.owner === ant.owner) return false;
        const distance = Math.max(
          Math.abs(ant.position.q - otherAnt.position.q),
          Math.abs(ant.position.r - otherAnt.position.r),
          Math.abs((-ant.position.q - ant.position.r) - (-otherAnt.position.q - otherAnt.position.r))
        );
        const minRange = antType.minAttackRange || 0;
        return distance >= minRange && distance <= antType.attackRange;
      });

      return enemiesInRange.length > 0;
    }

    // Still has actions (hasn't moved or attacked)
    return true;
  };

  // Calculate valid moves for selected ant
  const getValidMovesForSelectedAnt = () => {
    if (!selectedAnt || !gameState.ants[selectedAnt]) return [];
    const ant = gameState.ants[selectedAnt];
    const antType = AntTypes[ant.type.toUpperCase()];

    if (selectedAction === 'move') {
      // Queens cannot move
      if (ant.type === 'queen') {
        return [];
      }

      // Burrowed units have limited movement
      if (ant.isBurrowed) {
        // Only soldiers can move while burrowed (1 hex)
        if (ant.type === 'soldier') {
          return getMovementRange(ant.position, 1, gridRadius);
        }
        // Other burrowed units cannot move
        return [];
      }

      // Ensnared units can only move 1 hex
      if (ant.ensnared && ant.ensnared > 0) {
        return getMovementRange(ant.position, 1, gridRadius);
      }

      return getMovementRange(ant.position, antType.moveRange, gridRadius);
    } else if (selectedAction === 'layEgg' && ant.type === 'queen') {
      return getNeighbors(ant.position);
    }
    return [];
  };

  // Render hexagons in a symmetrical hexagon shape
  const renderHexGrid = () => {
    const hexagons = [];
    const validMoves = getValidMovesForSelectedAnt();
    const enemiesInRange = selectedAction === 'attack' ? getEnemiesInRange() : [];
    const teleportDestinations = selectedAction === 'teleport' && selectedAnt ?
      getValidTeleportDestinations(getGameStateForLogic(), selectedAnt) : [];
    const healTargets = selectedAction === 'heal' && selectedAnt ?
      getValidHealTargets(getGameStateForLogic(), selectedAnt) : [];
    const ensnareTargets = selectedAction === 'ensnare' && selectedAnt ?
      getValidEnsnareTargets(getGameStateForLogic(), selectedAnt) : [];

    // Calculate visible hexes for fog of war in multiplayer
    let visibleHexes = null;
    if (gameMode?.isMultiplayer && gameMode.playerRole && fullGameState) {
      // Use fullGameState (unfiltered) to calculate vision, not the filtered gameState
      visibleHexes = getVisibleHexes(fullGameState, gameMode.playerRole);
    }

    // Define SVG patterns for birthing pools (only once)
    const patterns = (
      <defs>
        <pattern id="birthingPoolPattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="5" cy="5" r="1.5" fill="#6A0DAD" opacity="0.4" />
          <circle cx="15" cy="10" r="1" fill="#6A0DAD" opacity="0.3" />
          <circle cx="10" cy="15" r="1.2" fill="#4B0082" opacity="0.5" />
          <circle cx="2" cy="12" r="0.8" fill="#8B008B" opacity="0.4" />
          <circle cx="18" cy="3" r="1" fill="#6A0DAD" opacity="0.3" />
        </pattern>
        <radialGradient id="birthingPoolGradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#9932CC" stopOpacity="1" />
          <stop offset="70%" stopColor="#6A0DAD" stopOpacity="1" />
          <stop offset="100%" stopColor="#4B0082" stopOpacity="1" />
        </radialGradient>
      </defs>
    );

    // Create hexagon shape: only include hexes where all three axial coordinates are within gridRadius
    for (let q = -gridRadius; q <= gridRadius; q++) {
      for (let r = -gridRadius; r <= gridRadius; r++) {
        const s = -q - r;
        // Check if hex is within the hexagonal boundary
        if (Math.abs(q) > gridRadius || Math.abs(r) > gridRadius || Math.abs(s) > gridRadius) continue;

        const hex = new HexCoord(q, r);
        const { x, y } = hexToPixel(hex, hexSize);

        // Find what's on this hex
        const ant = Object.values(gameState.ants).find(a => hexEquals(a.position, hex));
        const egg = Object.values(gameState.eggs).find(e => hexEquals(e.position, hex));
        const resource = Object.values(gameState.resources).find(r => hexEquals(r.position, hex));
        const anthill = Object.values(gameState.anthills || {}).find(a => hexEquals(a.position, hex));
        const isValidMove = validMoves.some(v => hexEquals(v, hex));
        const isSelected = selectedAnt && hexEquals(gameState.ants[selectedAnt]?.position, hex);
        const isAttackable = enemiesInRange.some(e => hexEquals(e.position, hex));
        const isTeleportDestination = teleportDestinations.some(anthill => hexEquals(anthill.position, hex));
        const isHealTarget = healTargets.some(ally => hexEquals(ally.position, hex));
        const isEnsnareTarget = ensnareTargets.some(enemy => hexEquals(enemy.position, hex));
        const isAttackPosition = attackPositions.some(pos => hexEquals(pos, hex));

        // Check if this hex is visible (for fog of war)
        const hexKey = `${q},${r}`;
        const isVisible = !visibleHexes || visibleHexes.has(hexKey);

        // Check if this hex is in the spawning pool of any queen
        let isBirthingPool = false;
        let birthingPoolOwner = null;

        Object.values(gameState.ants).forEach(a => {
          if (a.type !== 'queen') return;

          // Check if this is the queen's tile
          if (hexEquals(a.position, hex)) {
            isBirthingPool = true;
            birthingPoolOwner = a.owner;
            return;
          }

          // Check if in the queen's spawning pool
          const spawningPool = getSpawningPoolHexes(a, getNeighbors);
          if (spawningPool.some(n => hexEquals(n, hex))) {
            isBirthingPool = true;
            birthingPoolOwner = a.owner;
          }
        });

        let fillColor = '#ddd';
        let useBirthingPoolPattern = false;

        if (isBirthingPool) {
          fillColor = 'url(#birthingPoolGradient)'; // Gradient for birthing pools
          useBirthingPoolPattern = true;
        }
        if (resource) {
          fillColor = resource.type === 'food' ? '#90EE90' : '#FFD700';
          useBirthingPoolPattern = false;
        }
        if (isValidMove) {
          fillColor = '#AED6F1'; // Light blue for valid moves
          useBirthingPoolPattern = false;
        }
        if (isAttackable) {
          fillColor = '#FF6B6B'; // Red for attackable enemies
          useBirthingPoolPattern = false;
        }
        if (isTeleportDestination) {
          fillColor = '#BB8FCE'; // Purple for teleport destinations
          useBirthingPoolPattern = false;
        }
        if (isHealTarget) {
          fillColor = '#90EE90'; // Light green for heal targets
          useBirthingPoolPattern = false;
        }
        if (isEnsnareTarget) {
          fillColor = '#F0E68C'; // Khaki/yellow for ensnare targets
          useBirthingPoolPattern = false;
        }
        if (isAttackPosition) {
          fillColor = '#FF4444'; // Bright red for attack positions
          useBirthingPoolPattern = false;
        }
        if (isSelected) {
          fillColor = '#F9E79F'; // Yellow for selected
          useBirthingPoolPattern = false;
        }

        hexagons.push(
          <g key={`${q},${r}`} transform={`translate(${x}, ${y})`}>
            <polygon
              points="50,0 25,-43 -25,-43 -50,0 -25,43 25,43"
              fill={fillColor}
              stroke={isSelected ? '#F39C12' : isBirthingPool ? '#4B0082' : '#333'}
              strokeWidth={isSelected ? '3' : isBirthingPool ? '2.5' : '2'}
              style={{ cursor: 'pointer' }}
              onClick={() => handleHexClick(hex)}
              onContextMenu={(e) => {
                e.preventDefault(); // Prevent context menu from showing
                setSelectedAnt(null);
                setSelectedAction(null);
                setSelectedEgg(null);
              }}
            />
            {useBirthingPoolPattern && (
              <polygon
                points="50,0 25,-43 -25,-43 -50,0 -25,43 25,43"
                fill="url(#birthingPoolPattern)"
                style={{ pointerEvents: 'none' }}
              />
            )}
            {/* Coordinate reference label */}
            <text
              x="-15"
              y="-18"
              fontSize="8"
              fill="#000"
              fontWeight="bold"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {String.fromCharCode(65 + q + 6)}{r + 7}
            </text>
            {ant && (() => {
              // Check if this ant is attacking
              const attackAnim = attackAnimations.find(a => a.attackerId === ant.id);
              let transformOffset = '';

              // Check if ant has remaining actions
              const hasActions = hasRemainingActions(ant);

              if (attackAnim) {
                const elapsed = Date.now() - attackAnim.timestamp;
                const antType = AntTypes[ant.type.toUpperCase()];
                const isRanged = antType.attackRange > 1;

                if (isRanged) {
                  // Ranged: shake animation (0.2s)
                  const shakeProgress = Math.min(elapsed / 200, 1);
                  const shakeX = Math.sin(shakeProgress * Math.PI * 4) * 3 * (1 - shakeProgress);
                  const shakeY = Math.cos(shakeProgress * Math.PI * 4) * 3 * (1 - shakeProgress);
                  transformOffset = `translate(${shakeX}, ${shakeY})`;
                } else {
                  // Melee: lunge animation (0.4s)
                  const lungeProgress = Math.min(elapsed / 400, 1);
                  // Ease in-out
                  const eased = lungeProgress < 0.5
                    ? 2 * lungeProgress * lungeProgress
                    : 1 - Math.pow(-2 * lungeProgress + 2, 2) / 2;

                  // Calculate direction to target
                  const dx = attackAnim.targetPos.q - ant.position.q;
                  const dy = attackAnim.targetPos.r - ant.position.r;
                  const distance = Math.sqrt(dx * dx + dy * dy);
                  const lungeDistance = 20; // pixels

                  if (distance > 0) {
                    const offsetX = (dx / distance) * lungeDistance * eased * (eased < 0.5 ? 2 : 2 - 2 * eased);
                    const offsetY = (dy / distance) * lungeDistance * eased * (eased < 0.5 ? 2 : 2 - 2 * eased);
                    transformOffset = `translate(${offsetX}, ${offsetY})`;
                  }
                }
              }

              return (
                <g transform={transformOffset}>
                  <circle
                    cx="0"
                    cy="0"
                    r="18"
                    fill={gameState.players[ant.owner].color}
                    style={{ pointerEvents: 'none' }}
                  />
                  {/* Gray overlay for ants with no actions */}
                  {!hasActions && (
                    <circle
                      cx="0"
                      cy="0"
                      r="18"
                      fill="rgba(128, 128, 128, 0.6)"
                      style={{ pointerEvents: 'none' }}
                    />
                  )}
                  <text
                    textAnchor="middle"
                    dy="0.3em"
                    fontSize="24"
                    fill="white"
                    style={{ pointerEvents: 'none', fontWeight: 'bold', opacity: hasActions ? 1 : 0.5 }}
                  >
                    {ant.isBurrowed ? '🕳️' : AntTypes[ant.type.toUpperCase()].icon}
                  </text>
                  {/* "No moves" indicator */}
                  {!hasActions && (
                    <text
                      textAnchor="middle"
                      x="12"
                      y="-12"
                      fontSize="14"
                      fill="#666"
                      style={{ pointerEvents: 'none', fontWeight: 'bold' }}
                    >
                      💤
                    </text>
                  )}
                  {/* Defense buff indicator - ant on anthill */}
                  {(() => {
                    const onAnthill = Object.values(gameState.anthills || {}).some(anthill =>
                      anthill.position.q === ant.position.q && anthill.position.r === ant.position.r
                    );
                    return onAnthill && (
                      <text
                        textAnchor="middle"
                        x="-12"
                        y="-12"
                        fontSize="16"
                        fill="#FFD700"
                        style={{ pointerEvents: 'none', fontWeight: 'bold' }}
                      >
                        🛡️
                      </text>
                    );
                  })()}
                  {/* Health bar */}
                  <g transform="translate(0, 20)">
                    {/* Background */}
                    <rect
                      x="-20"
                      y="0"
                      width="40"
                      height="4"
                      fill="#333"
                      style={{ pointerEvents: 'none' }}
                    />
                    {/* Health fill */}
                    <rect
                      x="-20"
                      y="0"
                      width={40 * (ant.health / ant.maxHealth)}
                      height="4"
                      fill={ant.health > ant.maxHealth * 0.5 ? '#2ecc71' : ant.health > ant.maxHealth * 0.25 ? '#f39c12' : '#e74c3c'}
                      style={{ pointerEvents: 'none' }}
                    />
                  </g>
                  {/* Energy bar (queens only) */}
                  {ant.type === 'queen' && ant.energy !== undefined && (
                    <g transform="translate(0, 26)">
                      {/* Background */}
                      <rect
                        x="-20"
                        y="0"
                        width="40"
                        height="3"
                        fill="#333"
                        style={{ pointerEvents: 'none' }}
                      />
                      {/* Energy fill */}
                      <rect
                        x="-20"
                        y="0"
                        width={40 * (ant.energy / ant.maxEnergy)}
                        height="3"
                        fill="#FFD700"
                        style={{ pointerEvents: 'none' }}
                      />
                    </g>
                  )}
                </g>
              );
            })()}
            {egg && (
              <text
                textAnchor="middle"
                dy="0.3em"
                fontSize="20"
                style={{ pointerEvents: 'none' }}
              >
                🥚
              </text>
            )}
            {resource && !anthill && (
              <text
                textAnchor="middle"
                dy="0.3em"
                fontSize="16"
                fontWeight="bold"
                style={{ pointerEvents: 'none' }}
              >
                {resource.type === 'food' ? '🍃' : '💎'}
              </text>
            )}
            {anthill && (
              <g>
                {/* Anthill icon - different for under construction */}
                <text
                  textAnchor="middle"
                  dy="0.3em"
                  fontSize="24"
                  fontWeight="bold"
                  style={{ pointerEvents: 'none', opacity: anthill.isComplete ? 1 : 0.6 }}
                >
                  {anthill.isComplete ? '⛰️' : '🚧'}
                </text>
                {/* Owner indicator - colored circle */}
                <circle
                  cx="15"
                  cy="-15"
                  r="8"
                  fill={gameState.players[anthill.owner].color}
                  stroke="#333"
                  strokeWidth="1.5"
                  style={{ pointerEvents: 'none' }}
                />
                {/* Progress/Health bar */}
                <g transform="translate(0, 20)">
                  <rect
                    x="-20"
                    y="0"
                    width="40"
                    height="4"
                    fill="#333"
                    style={{ pointerEvents: 'none' }}
                  />
                  {anthill.isComplete ? (
                    // Health bar for completed anthills
                    <rect
                      x="-20"
                      y="0"
                      width={40 * (anthill.health / 20)}
                      height="4"
                      fill={anthill.health > 10 ? '#2ecc71' : anthill.health > 5 ? '#f39c12' : '#e74c3c'}
                      style={{ pointerEvents: 'none' }}
                    />
                  ) : (
                    // Progress bar for anthills under construction
                    <rect
                      x="-20"
                      y="0"
                      width={40 * (anthill.buildProgress / 2)}
                      height="4"
                      fill="#FFA500"
                      style={{ pointerEvents: 'none' }}
                    />
                  )}
                </g>
                {/* Show progress text for under construction */}
                {!anthill.isComplete && (
                  <text
                    textAnchor="middle"
                    y="30"
                    fontSize="10"
                    fill="#FFA500"
                    fontWeight="bold"
                    style={{ pointerEvents: 'none' }}
                  >
                    {anthill.buildProgress}/2
                  </text>
                )}
              </g>
            )}
            {/* Fog of War overlay - darken non-visible hexes */}
            {!isVisible && (
              <polygon
                points="50,0 25,-43 -25,-43 -50,0 -25,43 25,43"
                fill="rgba(0, 0, 0, 0.7)"
                style={{ pointerEvents: 'none' }}
              />
            )}
          </g>
        );
      }
    }

    return (
      <>
        {patterns}
        {hexagons}
      </>
    );
  };

  return (
    <div className="App" style={{ padding: '10px', backgroundColor: '#f0f0f0', height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <h1 style={{ margin: '0 0 10px 0', fontSize: '24px' }}>Ant Colony Battler</h1>

      <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', alignItems: 'flex-start', width: '100%' }}>
        {/* Ant Types Panel - Left Side */}
        <div style={{ width: '250px', backgroundColor: '#fff', padding: '15px', borderRadius: '8px', maxHeight: 'calc(100vh - 80px)', overflowY: 'auto' }}>
          {isMyTurn() ? (
            <>
              {/* Upgrades Button */}
              <button
                onClick={() => setShowUpgradesModal(true)}
                style={{
                  width: '100%',
                  padding: '15px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  backgroundColor: '#9C27B0',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  marginBottom: '20px'
                }}
              >
                ⚡ Upgrades
              </button>

              <h3 style={{ margin: '0 0 12px 0', fontSize: '18px' }}>Build Ants</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.values(AntTypes).filter(t => t.id !== 'queen').map(ant => {
                  const currentPlayer = gameState.players[gameState.currentPlayer];
                  const affordable = canAfford(currentPlayer, ant.id.toUpperCase());

                  return (
                    <button
                      key={ant.id}
                      onClick={() => {
                        // Check if player has a queen to lay eggs
                        const queen = Object.values(gameState.ants).find(
                          a => a.type === 'queen' && a.owner === gameState.currentPlayer
                        );
                        if (!queen) {
                          alert('You need a queen to lay eggs!');
                          return;
                        }
                        if (!affordable) {
                          alert('Not enough resources!');
                          return;
                        }
                        // Set selected action to lay egg with this ant type
                        setSelectedAnt(queen.id);
                        setSelectedAction('layEgg');
                        setShowAntTypeSelector(false);
                        // Store the ant type to lay
                        setSelectedEggHex({ antType: ant.id });
                      }}
                      disabled={!affordable || !isMyTurn()}
                      style={{
                        padding: '12px',
                        fontSize: '15px',
                        backgroundColor: affordable ? '#4CAF50' : '#ccc',
                        color: affordable ? 'white' : '#666',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: (affordable && isMyTurn()) ? 'pointer' : 'not-allowed',
                        textAlign: 'left',
                        opacity: isMyTurn() ? 1 : 0.6
                      }}
                    >
                      <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{ant.icon} {ant.name}</div>
                      <div style={{ fontSize: '13px', marginTop: '5px' }}>
                        Cost: {ant.cost.food}🍃 {ant.cost.minerals}💎
                      </div>
                      <div style={{ fontSize: '12px', marginTop: '3px', opacity: 0.8 }}>
                        {ant.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#888' }}>Opponent's Turn</h3>
              <p style={{ fontSize: '14px', color: '#666' }}>Waiting for opponent...</p>
            </div>
          )}

        </div>

        {/* Game Board */}
        <div style={{ flex: '0 0 auto' }}>
          <svg
            width="1200"
            height="1200"
            style={{ border: '2px solid #333', backgroundColor: '#fff', cursor: isDragging ? 'grabbing' : 'default' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            <g transform={`translate(600, 600) scale(${zoomLevel}) translate(${cameraOffset.x}, ${cameraOffset.y})`}>
              {renderHexGrid()}

            {/* Projectiles */}
            {projectiles.map(({ id, startPos, endPos, timestamp }) => {
              const start = hexToPixel(startPos, hexSize);
              const end = hexToPixel(endPos, hexSize);
              const elapsed = Date.now() - timestamp;
              const progress = Math.min(elapsed / 300, 1); // 0 to 1 over 0.3 seconds

              // Interpolate position
              const x = start.x + (end.x - start.x) * progress;
              const y = start.y + (end.y - start.y) * progress;

              return (
                <g key={id} transform={`translate(${x}, ${y})`}>
                  <circle
                    r="4"
                    fill="#FF6B00"
                    stroke="#FF0000"
                    strokeWidth="2"
                  />
                </g>
              );
            })}

            {/* Damage Numbers */}
            {damageNumbers.map(({ id, damage, position, timestamp }) => {
              const { x, y } = hexToPixel(position, hexSize);
              const elapsed = Date.now() - timestamp;
              const progress = elapsed / 1000; // 0 to 1 over 1 second

              // Float up and fade out
              const offsetY = -progress * 50; // Move up 50 pixels
              const opacity = 1 - progress; // Fade out
              const scale = 1 + progress * 0.5; // Slightly grow

              return (
                <g
                  key={id}
                  transform={`translate(${x}, ${y + offsetY})`}
                  style={{ pointerEvents: 'none' }}
                >
                  <text
                    textAnchor="middle"
                    dy="0.3em"
                    fontSize={24 * scale}
                    fontWeight="bold"
                    fill="#ff0000"
                    stroke="#ffffff"
                    strokeWidth="3"
                    paintOrder="stroke"
                    opacity={opacity}
                  >
                    -{damage}
                  </text>
                </g>
              );
            })}

            {/* Bomber Explosion Animations */}
            {explosions.map(({ id, position, timestamp }) => {
              const { x, y } = hexToPixel(position, hexSize);
              const elapsed = Date.now() - timestamp;
              const progress = elapsed / 1000; // 0 to 1 over 1 second

              // Create multiple expanding waves in different shades of green
              const waves = [
                { delay: 0, color: '#00ff00', maxRadius: hexSize * 2.5 },
                { delay: 0.1, color: '#32cd32', maxRadius: hexSize * 2.2 },
                { delay: 0.2, color: '#7fff00', maxRadius: hexSize * 1.9 },
                { delay: 0.3, color: '#adff2f', maxRadius: hexSize * 1.6 }
              ];

              return (
                <g key={id} transform={`translate(${x}, ${y})`} style={{ pointerEvents: 'none' }}>
                  {waves.map((wave, idx) => {
                    const waveProgress = Math.max(0, Math.min(1, (progress - wave.delay) / (0.7 - wave.delay)));
                    const radius = waveProgress * wave.maxRadius;
                    const opacity = (1 - waveProgress) * 0.8;

                    return (
                      <circle
                        key={idx}
                        cx={0}
                        cy={0}
                        r={radius}
                        fill="none"
                        stroke={wave.color}
                        strokeWidth={8 * (1 - waveProgress * 0.5)}
                        opacity={opacity}
                      />
                    );
                  })}
                  {/* Central flash */}
                  {progress < 0.3 && (
                    <circle
                      cx={0}
                      cy={0}
                      r={hexSize * 0.8 * (1 - progress / 0.3)}
                      fill="#ffffff"
                      opacity={(1 - progress / 0.3) * 0.9}
                    />
                  )}
                </g>
              );
            })}

            {/* Resource Gain Numbers */}
            {resourceGainNumbers.map(({ id, amount, type, position, timestamp }) => {
              const { x, y } = hexToPixel(position, hexSize);
              const elapsed = Date.now() - timestamp;
              const progress = elapsed / 1000; // 0 to 1 over 1 second

              // Float up and fade out
              const offsetY = -progress * 50; // Move up 50 pixels
              const opacity = 1 - progress; // Fade out
              const scale = 1 + progress * 0.5; // Slightly grow

              // Use different colors for resource gains and healing
              const color = type === 'heal' ? '#00FF00' : (type === 'food' ? '#00BFFF' : '#4169E1'); // Green for heal, Light blue for food, royal blue for minerals

              return (
                <g
                  key={id}
                  transform={`translate(${x}, ${y + offsetY})`}
                  style={{ pointerEvents: 'none' }}
                >
                  <text
                    textAnchor="middle"
                    dy="0.3em"
                    fontSize={24 * scale}
                    fontWeight="bold"
                    fill={color}
                    stroke="#ffffff"
                    strokeWidth="3"
                    paintOrder="stroke"
                    opacity={opacity}
                  >
                    +{amount}
                  </text>
                </g>
              );
            })}
            </g>
          </svg>
        </div>

        {/* Game Info Panel - Right Side */}
        <div style={{ width: '300px', backgroundColor: '#fff', padding: '20px', borderRadius: '8px', maxHeight: 'calc(100vh - 80px)', overflowY: 'auto' }}>
          {gameMode.isMultiplayer && (
            <div style={{ marginBottom: '10px', padding: '10px', backgroundColor: '#ecf0f1', borderRadius: '5px' }}>
              <p><strong>Game Mode:</strong> Online</p>
              <p><strong>You are:</strong> {gameMode.playerRole === 'player1' ? 'Player 1 (Red)' : 'Player 2 (Cyan)'}</p>
              {!isMyTurn() && <p style={{ color: '#e74c3c' }}><strong>Waiting for opponent...</strong></p>}
              {isMyTurn() && <p style={{ color: '#2ecc71' }}><strong>Your turn!</strong></p>}
            </div>
          )}

          <h2>Turn {gameState.turn}</h2>
          <h3 style={{ color: gameState.players[gameState.currentPlayer].color }}>
            {gameState.players[gameState.currentPlayer].name}'s Turn
          </h3>

          {/* Resources */}
          <div style={{ marginBottom: '20px' }}>
            <h4>Your Resources</h4>
            {(() => {
              const currentPlayerId = gameMode?.isMultiplayer ? gameMode.playerRole : gameState.currentPlayer;
              const player = gameState.players[currentPlayerId];

              // Calculate income from anthills
              let foodIncome = 0;
              let mineralIncome = 0;
              Object.values(gameState.anthills || {}).forEach(anthill => {
                if (anthill.owner === currentPlayerId && anthill.isComplete) {
                  if (anthill.resourceType === 'food') {
                    foodIncome += GameConstants.ANTHILL_PASSIVE_INCOME.food;
                  } else {
                    mineralIncome += GameConstants.ANTHILL_PASSIVE_INCOME.minerals;
                  }
                }
              });

              // Add queen food income
              const queen = Object.values(gameState.ants).find(
                ant => ant.type === 'queen' && ant.owner === currentPlayerId
              );
              if (queen) {
                const queenTier = queen.queenTier || 'queen';
                foodIncome += QueenTiers[queenTier].foodIncome;
              }

              return (
                <>
                  <p>
                    🍃 Food: {player.resources.food}
                    {foodIncome > 0 && <span style={{ color: '#27ae60', fontWeight: 'bold' }}> (+{foodIncome}/turn)</span>}
                  </p>
                  <p>
                    💎 Minerals: {player.resources.minerals}
                    {mineralIncome > 0 && <span style={{ color: '#3498db', fontWeight: 'bold' }}> (+{mineralIncome}/turn)</span>}
                  </p>
                </>
              );
            })()}
          </div>

          {/* Queen Upgrade Section */}
          {isMyTurn() && (() => {
            const currentState = getGameStateForLogic();
            const queen = Object.values(currentState.ants).find(
              ant => ant.type === 'queen' && ant.owner === currentState.currentPlayer
            );

            if (!queen) return null;

            const currentTier = queen.queenTier || 'queen';
            if (currentTier === 'swarmQueen') return null; // Already at max tier

            const nextTier = currentTier === 'queen' ? 'broodQueen' : 'swarmQueen';
            const nextTierData = QueenTiers[nextTier];
            const currentPlayer = currentState.players[currentState.currentPlayer];
            const affordable = canAffordQueenUpgrade(currentState, queen.id);

            return (
              <div style={{ marginBottom: '20px', paddingBottom: '15px', borderBottom: '2px solid #ddd' }}>
                <h4>Queen Upgrade</h4>
                <button
                  onClick={() => {
                    if (!affordable) {
                      alert('Not enough resources!');
                      return;
                    }
                    const currentState = getGameStateForLogic();
                    const queen = Object.values(currentState.ants).find(
                      ant => ant.type === 'queen' && ant.owner === currentState.currentPlayer
                    );
                    if (queen) {
                      updateGame(upgradeQueen(currentState, queen.id));
                    }
                  }}
                  disabled={!affordable || !isMyTurn()}
                  style={{
                    padding: '12px',
                    fontSize: '15px',
                    backgroundColor: affordable ? '#FF6B00' : '#ccc',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: (affordable && isMyTurn()) ? 'pointer' : 'not-allowed',
                    textAlign: 'left',
                    width: '100%',
                    opacity: isMyTurn() ? 1 : 0.6
                  }}
                >
                  <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{nextTierData.icon} Upgrade to {nextTierData.name}</div>
                  <div style={{ fontSize: '13px', marginTop: '5px' }}>
                    Cost: {nextTierData.cost.food}🍃 {nextTierData.cost.minerals}💎
                  </div>
                  <div style={{ fontSize: '12px', marginTop: '5px', opacity: 0.9 }}>
                    • +2 Spawning Spots ({QueenTiers[currentTier].spawningSpots} → {nextTierData.spawningSpots})<br/>
                    • -5 Egg Cost ({GameConstants.EGG_LAY_ENERGY_COST - QueenTiers[currentTier].eggCostReduction}⚡ → {GameConstants.EGG_LAY_ENERGY_COST - nextTierData.eggCostReduction}⚡)<br/>
                    • +{nextTierData.maxEnergy - QueenTiers[currentTier].maxEnergy} Max Energy<br/>
                    • +5 Energy Regen/Turn<br/>
                    • +{nextTierData.foodIncome - QueenTiers[currentTier].foodIncome} Food Income/Turn ({QueenTiers[currentTier].foodIncome}🍃 → {nextTierData.foodIncome}🍃)
                  </div>
                </button>
              </div>
            );
          })()}

          {/* Selected Egg Info */}
          {selectedEgg && (
            <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#fff3cd', borderRadius: '5px', border: '2px solid #ffc107' }}>
              <h4>Selected Egg</h4>
              <p><strong>Type:</strong> {AntTypes[selectedEgg.antType.toUpperCase()].icon} {AntTypes[selectedEgg.antType.toUpperCase()].name}</p>
              <p><strong>Owner:</strong> {gameState.players[selectedEgg.owner].name}</p>
              <p><strong>Will hatch on turn:</strong> {selectedEgg.hatchTurn}</p>
              <p><strong>Turns until hatch:</strong> {Math.max(0, selectedEgg.hatchTurn - gameState.turn)}</p>
              <button
                onClick={() => setSelectedEgg(null)}
                style={{
                  marginTop: '10px',
                  padding: '5px 10px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          )}

          {/* Selected Ant Info */}
          {selectedAnt && gameState.ants[selectedAnt] && (
            <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#e0e0e0', borderRadius: '5px' }}>
              <h4>Selected Ant</h4>
              <p>{gameState.ants[selectedAnt].type === 'queen' && gameState.ants[selectedAnt].queenTier ? QueenTiers[gameState.ants[selectedAnt].queenTier].name : AntTypes[gameState.ants[selectedAnt].type.toUpperCase()].name}</p>
              <p>HP: {gameState.ants[selectedAnt].health}/{gameState.ants[selectedAnt].maxHealth}</p>
              {(gameState.ants[selectedAnt].type === 'queen' || gameState.ants[selectedAnt].type === 'healer') && gameState.ants[selectedAnt].maxEnergy && (
                <p>Energy: {gameState.ants[selectedAnt].energy || 0}/{gameState.ants[selectedAnt].maxEnergy}</p>
              )}
              {gameState.ants[selectedAnt].ensnared && gameState.ants[selectedAnt].ensnared > 0 && (
                <p style={{ color: '#f39c12', fontWeight: 'bold' }}>🕸️ Ensnared ({gameState.ants[selectedAnt].ensnared} turns)</p>
              )}

              <>
                <button
                  onClick={() => setSelectedAction('move')}
                  style={{
                    marginRight: '5px',
                    padding: '8px 12px',
                    backgroundColor: selectedAction === 'move' ? '#3498db' : '#ecf0f1',
                    color: selectedAction === 'move' ? 'white' : 'black',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: selectedAction === 'move' ? 'bold' : 'normal'
                  }}
                >
                  Move
                </button>

                {/* Teleport button (Connected Tunnels upgrade) */}
                {(() => {
                  const currentState = getGameStateForLogic();
                  const validDestinations = getValidTeleportDestinations(currentState, selectedAnt);
                  if (validDestinations.length > 0 && !gameState.ants[selectedAnt].hasMoved) {
                    return (
                      <button
                        onClick={() => setSelectedAction('teleport')}
                        style={{
                          marginRight: '5px',
                          padding: '8px 12px',
                          backgroundColor: selectedAction === 'teleport' ? '#9b59b6' : '#ecf0f1',
                          color: selectedAction === 'teleport' ? 'white' : 'black',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: selectedAction === 'teleport' ? 'bold' : 'normal'
                        }}
                      >
                        🌀 Teleport
                      </button>
                    );
                  }
                  return null;
                })()}

                {/* Bomber-specific: only detonate button, no normal attack */}
                {gameState.ants[selectedAnt].type === 'bomber' ? (
                  <button
                    onClick={handleDetonate}
                    disabled={!isMyTurn() || gameState.ants[selectedAnt].hasAttacked}
                    style={{
                      marginTop: '10px',
                      padding: '10px 20px',
                      backgroundColor: gameState.ants[selectedAnt].hasAttacked ? '#95a5a6' : '#e74c3c',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: (isMyTurn() && !gameState.ants[selectedAnt].hasAttacked) ? 'pointer' : 'not-allowed',
                      fontWeight: 'bold',
                      fontSize: '14px',
                      width: '100%',
                      opacity: isMyTurn() ? 1 : 0.6
                    }}
                  >
                    💥 DETONATE (Suicide Attack) 💥
                  </button>
                ) : gameState.ants[selectedAnt].type === 'healer' ? (
                  <>
                    {/* Healer-specific: Heal and Ensnare buttons instead of Attack */}
                    <button
                      onClick={() => setSelectedAction('heal')}
                      disabled={!isMyTurn() || gameState.ants[selectedAnt].hasAttacked}
                      style={{
                        marginRight: '5px',
                        padding: '8px 12px',
                        backgroundColor: selectedAction === 'heal' ? '#27ae60' : '#ecf0f1',
                        color: selectedAction === 'heal' ? 'white' : 'black',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: (isMyTurn() && !gameState.ants[selectedAnt].hasAttacked) ? 'pointer' : 'not-allowed',
                        fontWeight: selectedAction === 'heal' ? 'bold' : 'normal',
                        opacity: isMyTurn() ? 1 : 0.6
                      }}
                    >
                      ✨ Heal
                    </button>
                    <button
                      onClick={() => setSelectedAction('ensnare')}
                      disabled={!isMyTurn() || gameState.ants[selectedAnt].hasAttacked}
                      style={{
                        marginRight: '5px',
                        padding: '8px 12px',
                        backgroundColor: selectedAction === 'ensnare' ? '#f39c12' : '#ecf0f1',
                        color: selectedAction === 'ensnare' ? 'white' : 'black',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: (isMyTurn() && !gameState.ants[selectedAnt].hasAttacked) ? 'pointer' : 'not-allowed',
                        fontWeight: selectedAction === 'ensnare' ? 'bold' : 'normal',
                        opacity: isMyTurn() ? 1 : 0.6
                      }}
                    >
                      🕸️ Ensnare
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setSelectedAction('attack')}
                    style={{
                      marginRight: '5px',
                      padding: '8px 12px',
                      backgroundColor: selectedAction === 'attack' ? '#e74c3c' : '#ecf0f1',
                      color: selectedAction === 'attack' ? 'white' : 'black',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: selectedAction === 'attack' ? 'bold' : 'normal'
                    }}
                  >
                    Attack
                  </button>
                )}
                  {gameState.ants[selectedAnt].type === 'queen' && (
                    <>
                      <button
                        onClick={() => setSelectedAction('layEgg')}
                        style={{
                          marginRight: '5px',
                          padding: '8px 12px',
                          backgroundColor: selectedAction === 'layEgg' ? '#2ecc71' : '#ecf0f1',
                          color: selectedAction === 'layEgg' ? 'white' : 'black',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: selectedAction === 'layEgg' ? 'bold' : 'normal'
                        }}
                      >
                        Lay Egg
                      </button>
                      <button
                        onClick={() => setSelectedAction('heal')}
                        style={{
                          padding: '8px 12px',
                          backgroundColor: selectedAction === 'heal' ? '#27ae60' : '#ecf0f1',
                          color: selectedAction === 'heal' ? 'white' : 'black',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: selectedAction === 'heal' ? 'bold' : 'normal'
                        }}
                      >
                        Heal (25⚡)
                      </button>
                    </>
                  )}
                  {gameState.ants[selectedAnt].type === 'drone' && !gameState.ants[selectedAnt].hasBuilt && (
                    <button
                      onClick={() => setSelectedAction('buildAnthill')}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: selectedAction === 'buildAnthill' ? '#f39c12' : '#ecf0f1',
                        color: selectedAction === 'buildAnthill' ? 'white' : 'black',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: selectedAction === 'buildAnthill' ? 'bold' : 'normal'
                      }}
                    >
                      Build Anthill
                    </button>
                  )}

                  {/* Burrow/Unburrow buttons (not for tank or bombardier) */}
                  {!gameState.ants[selectedAnt].isBurrowed && canBurrow(getGameStateForLogic(), gameState.ants[selectedAnt]) && (
                    <button
                      onClick={() => {
                        const currentState = getGameStateForLogic();
                        const newState = burrowAnt(currentState, selectedAnt);
                        updateGame(newState);
                      }}
                      disabled={!isMyTurn()}
                      style={{
                        marginTop: '10px',
                        padding: '8px 12px',
                        backgroundColor: '#8B4513',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: isMyTurn() ? 'pointer' : 'not-allowed',
                        width: '100%',
                        fontWeight: 'bold',
                        opacity: isMyTurn() ? 1 : 0.6
                      }}
                    >
                      🌍 BURROW
                    </button>
                  )}
                  {gameState.ants[selectedAnt].isBurrowed && canUnburrow(getGameStateForLogic(), selectedAnt) && (
                    <button
                      onClick={() => {
                        const currentState = getGameStateForLogic();
                        const newState = unburrowAnt(currentState, selectedAnt);
                        updateGame(newState);
                      }}
                      disabled={!isMyTurn()}
                      style={{
                        marginTop: '10px',
                        padding: '8px 12px',
                        backgroundColor: '#DAA520',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: isMyTurn() ? 'pointer' : 'not-allowed',
                        width: '100%',
                        fontWeight: 'bold',
                        opacity: isMyTurn() ? 1 : 0.6
                      }}
                    >
                      ⬆️ UNBURROW
                    </button>
                  )}
                </>
            </div>
          )}

          {/* Ant Type Selector */}
          {showAntTypeSelector && (
            <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#fff3cd', borderRadius: '5px', border: '2px solid #ffc107' }}>
              <h4>Select Ant Type to Lay</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.values(AntTypes).filter(t => t.id !== 'queen').map(ant => {
                  const currentPlayer = gameState.players[gameState.currentPlayer];
                  const affordable = canAfford(currentPlayer, ant.id.toUpperCase());

                  return (
                    <button
                      key={ant.id}
                      onClick={() => handleLayEgg(ant.id)}
                      disabled={!affordable}
                      style={{
                        padding: '8px',
                        fontSize: '12px',
                        backgroundColor: affordable ? '#4CAF50' : '#ccc',
                        color: affordable ? 'white' : '#666',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: affordable ? 'pointer' : 'not-allowed',
                        textAlign: 'left'
                      }}
                    >
                      <div>{ant.icon} {ant.name}</div>
                      <div style={{ fontSize: '10px' }}>
                        Cost: {ant.cost.food}🍃 {ant.cost.minerals}💎
                      </div>
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => {
                  setShowAntTypeSelector(false);
                  setSelectedEggHex(null);
                  setSelectedAction(null);
                }}
                style={{
                  marginTop: '10px',
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          )}

          {/* End Turn Button */}
          <button
            onClick={() => {
              const currentState = getGameStateForLogic();
              const { gameState: newState, resourceGains } = endTurn(currentState);

              // Show resource gain animations - only for owned anthills or visible anthills
              if (resourceGains && resourceGains.length > 0) {
                const currentPlayerId = gameMode?.isMultiplayer ? gameMode.playerRole : gameState.currentPlayer;
                const visibleHexes = gameMode?.isMultiplayer ? getVisibleHexes(newState, currentPlayerId) : null;

                resourceGains.forEach(gain => {
                  const hexKey = `${gain.position.q},${gain.position.r}`;
                  // Show animation if: owned by current player OR visible to current player
                  const shouldShow = gain.owner === currentPlayerId ||
                                    (visibleHexes && visibleHexes.has(hexKey)) ||
                                    !gameMode?.isMultiplayer; // Always show in local games

                  if (shouldShow) {
                    showResourceGain(gain.amount, gain.type, gain.position);
                  }
                });
              }

              updateGame(newState);
              setSelectedAnt(null);
              setSelectedAction(null);
              setSelectedEgg(null);
              setSelectedEggHex(null);
              setShowAntTypeSelector(false);
            }}
            disabled={!isMyTurn()}
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '16px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            End Turn
          </button>

          {/* Game Over */}
          {gameState.gameOver && (
            <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#ffcc00', borderRadius: '5px' }}>
              <h3>Game Over!</h3>
              <p>{gameState.players[gameState.winner].name} wins!</p>
            </div>
          )}
        </div>
      </div>

      {/* Camera Controls - Bottom Right */}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        zIndex: 1000
      }}>
        {/* Cycle to Next Active Ant */}
        <button
          onClick={cycleToNextActiveAnt}
          disabled={!isMyTurn()}
          style={{
            padding: '0',
            borderRadius: '10px',
            backgroundColor: isMyTurn() ? '#9C27B0' : '#ccc',
            color: 'white',
            border: 'none',
            fontSize: '28px',
            fontWeight: 'bold',
            cursor: isMyTurn() ? 'pointer' : 'not-allowed',
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
            width: '70px',
            height: '70px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isMyTurn() ? 1 : 0.5
          }}
          title="Cycle to Next Active Ant (Tab)"
        >
          🐜⟳
        </button>
        {/* Zoom In */}
        <button
          onClick={() => setZoomLevel(prev => Math.min(MAX_ZOOM, prev + 0.2))}
          style={{
            padding: '0',
            borderRadius: '10px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            fontSize: '36px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
            width: '70px',
            height: '70px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Zoom In (+)"
        >
          +
        </button>
        {/* Zoom Out */}
        <button
          onClick={() => setZoomLevel(prev => Math.max(MIN_ZOOM, prev - 0.2))}
          style={{
            padding: '0',
            borderRadius: '10px',
            backgroundColor: '#f44336',
            color: 'white',
            border: 'none',
            fontSize: '36px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
            width: '70px',
            height: '70px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Zoom Out (-)"
        >
          -
        </button>
        {/* Center on Queen */}
        <button
          onClick={centerOnQueen}
          style={{
            padding: '0',
            borderRadius: '10px',
            backgroundColor: '#FF9800',
            color: 'white',
            border: 'none',
            fontSize: '32px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
            width: '70px',
            height: '70px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Center on Queen (C)"
        >
          👑
        </button>
        {/* Zoom Level Display */}
        <div style={{
          padding: '12px',
          borderRadius: '10px',
          backgroundColor: 'rgba(0,0,0,0.7)',
          color: 'white',
          fontSize: '16px',
          textAlign: 'center',
          fontWeight: 'bold',
          width: '70px',
          boxSizing: 'border-box'
        }}>
          {Math.round(zoomLevel * 100)}%
        </div>
      </div>

      {/* Help Button - Bottom Left */}
      <button
        onClick={() => setShowHelpGuide(true)}
        style={{
          position: 'fixed',
          bottom: '20px',
          left: '20px',
          padding: '12px 20px',
          borderRadius: '25px',
          backgroundColor: '#2196F3',
          color: 'white',
          border: 'none',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: 'pointer',
          boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          whiteSpace: 'nowrap'
        }}
        title="Game Guide"
      >
        how to play
      </button>

      {/* Camera Controls Info - Bottom Left (under help button) */}
      <div style={{
        position: 'fixed',
        bottom: '70px',
        left: '20px',
        padding: '10px 15px',
        borderRadius: '8px',
        backgroundColor: 'rgba(0,0,0,0.7)',
        color: 'white',
        fontSize: '12px',
        zIndex: 1000,
        maxWidth: '200px'
      }}>
        <strong>Controls:</strong><br/>
        Tab: Next Active Ant<br/>
        Mouse Wheel: Zoom<br/>
        Middle Click: Pan<br/>
        WASD/Arrows: Pan<br/>
        C: Center on Queen
      </div>

      {/* Upgrades Modal */}
      {showUpgradesModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '20px'
        }}
        onClick={() => setShowUpgradesModal(false)}
        >
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '10px',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflow: 'auto',
            padding: '30px',
            position: 'relative'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setShowUpgradesModal(false)}
              style={{
                position: 'absolute',
                top: '15px',
                right: '15px',
                width: '35px',
                height: '35px',
                borderRadius: '50%',
                backgroundColor: '#e74c3c',
                color: 'white',
                border: 'none',
                fontSize: '20px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              ×
            </button>

            <h2 style={{ marginTop: 0, color: '#9C27B0', borderBottom: '3px solid #9C27B0', paddingBottom: '10px' }}>
              ⚡ Upgrades
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
              {Object.values(Upgrades).map(upgrade => {
                const currentPlayer = gameState.players[gameState.currentPlayer];
                const queen = Object.values(gameState.ants).find(a => a.type === 'queen' && a.owner === gameState.currentPlayer);
                const currentTier = currentPlayer.upgrades[upgrade.id] || 0;
                const isMaxed = currentTier >= upgrade.maxTier;
                const affordable = !isMaxed && canAffordUpgrade(currentPlayer, upgrade.id, queen);
                const cost = isMaxed ? null : upgrade.costs[currentTier];
                const isBinaryUpgrade = upgrade.maxTier === 1;

                return (
                  <button
                    key={upgrade.id}
                    onClick={() => {
                      if (!affordable) {
                        alert(isMaxed ? 'Already purchased!' : 'Not enough resources!');
                        return;
                      }
                      const currentState = getGameStateForLogic();
                      updateGame(purchaseUpgrade(currentState, upgrade.id));
                    }}
                    disabled={!affordable}
                    style={{
                      padding: '15px',
                      fontSize: '15px',
                      backgroundColor: isMaxed ? '#888' : (affordable ? '#9C27B0' : '#ccc'),
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: affordable ? 'pointer' : 'not-allowed',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ fontWeight: 'bold', fontSize: '17px', marginBottom: '8px' }}>
                      {upgrade.icon} {upgrade.name}
                      {!isBinaryUpgrade && ` (Tier ${currentTier}/${upgrade.maxTier})`}
                      {isMaxed && <span style={{ marginLeft: '10px', fontSize: '14px', opacity: 0.8 }}>✓ Owned</span>}
                    </div>
                    {!isMaxed && cost && (
                      <div style={{ fontSize: '14px', marginBottom: '6px' }}>
                        Cost: {cost.food}🍃 {cost.minerals}💎
                      </div>
                    )}
                    <div style={{ fontSize: '13px', opacity: 0.9, lineHeight: '1.4' }}>
                      {upgrade.description}
                    </div>
                    {upgrade.requiresQueenTier && !queen?.queenTier !== 'swarmQueen' && (
                      <div style={{ fontSize: '12px', marginTop: '6px', fontStyle: 'italic', color: '#FFD700' }}>
                        Requires: Swarm Queen upgrade
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Help Guide Popup Modal */}
      {showHelpGuide && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '10px',
            maxWidth: '900px',
            maxHeight: '90vh',
            overflow: 'auto',
            padding: '30px',
            position: 'relative'
          }}>
            {/* Close Button */}
            <button
              onClick={() => setShowHelpGuide(false)}
              style={{
                position: 'absolute',
                top: '15px',
                right: '15px',
                width: '35px',
                height: '35px',
                borderRadius: '50%',
                backgroundColor: '#e74c3c',
                color: 'white',
                border: 'none',
                fontSize: '20px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              ×
            </button>

            <h1 style={{ marginTop: 0, color: '#333', borderBottom: '3px solid #2196F3', paddingBottom: '10px' }}>
              Ant Colony Battler - Game Guide
            </h1>

            {/* Objective */}
            <section style={{ marginBottom: '25px' }}>
              <h2 style={{ color: '#2196F3', marginBottom: '10px' }}>Objective</h2>
              <p style={{ fontSize: '15px', lineHeight: '1.6' }}>
                Destroy the enemy Queen to win! Manage your colony, gather resources, build anthills, and command your ant army to victory.
              </p>
            </section>

            {/* Game Basics */}
            <section style={{ marginBottom: '25px' }}>
              <h2 style={{ color: '#2196F3', marginBottom: '10px' }}>Game Basics</h2>
              <ul style={{ fontSize: '14px', lineHeight: '1.8' }}>
                <li><strong>Resources:</strong> Food (🍃) and Minerals (💎) are needed to spawn units and purchase upgrades</li>
                <li><strong>Turn-Based:</strong> Each player takes turns. End your turn when all actions are complete</li>
                <li><strong>Queen Energy:</strong> Queens have energy for laying eggs and healing. Energy regenerates each round</li>
                <li><strong>Fog of War:</strong> In multiplayer, you can only see areas within your units' vision range</li>
                <li><strong>Camera:</strong> The view centers on your Queen each turn. Use mouse wheel to zoom, middle-click or WASD/arrows to pan</li>
              </ul>
            </section>

            {/* Units */}
            <section style={{ marginBottom: '25px' }}>
              <h2 style={{ color: '#2196F3', marginBottom: '10px' }}>Unit Types & Stats</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px' }}>
                {Object.values(AntTypes).map(ant => (
                  <div key={ant.id} style={{
                    border: '2px solid #ddd',
                    borderRadius: '8px',
                    padding: '12px',
                    backgroundColor: '#f9f9f9'
                  }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#333' }}>
                      {ant.icon} {ant.name}
                    </h3>
                    <p style={{ fontSize: '12px', margin: '0 0 8px 0', color: '#666' }}>{ant.description}</p>
                    <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
                      <strong>Cost:</strong> {ant.cost.food}🍃 {ant.cost.minerals}💎<br/>
                      <strong>HP:</strong> {ant.maxHealth} | <strong>Attack:</strong> {ant.attack} | <strong>Defense:</strong> {ant.defense}<br/>
                      <strong>Move Range:</strong> {ant.moveRange} | <strong>Attack Range:</strong> {ant.attackRange}
                      {ant.minAttackRange && <><br/><strong>Min Range:</strong> {ant.minAttackRange}</>}
                      {ant.cannotMoveAndAttack && <><br/><em>Cannot move and attack in same turn</em></>}
                      {ant.splashDamage && <><br/><em>Deals splash damage (50%) in radius {ant.splashRadius}</em></>}
                      {ant.canBuildAnthill && <><br/><em>Can build anthills on resource nodes</em></>}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Combat System */}
            <section style={{ marginBottom: '25px' }}>
              <h2 style={{ color: '#2196F3', marginBottom: '10px' }}>Combat System</h2>
              <ul style={{ fontSize: '14px', lineHeight: '1.8' }}>
                <li><strong>Damage Formula:</strong> Attack - (Defense / 2), minimum 1 damage</li>
                <li><strong>Health-Based Scaling:</strong> Damaged units deal less damage (health% + 5%)</li>
                <li><strong>Melee Counter-Attack:</strong> When attacked in melee range, defender strikes back if they survive</li>
                <li><strong>Anthill Defense Bonus:</strong> Units on anthills get +2 defense</li>
                <li><strong>Bomber Detonation:</strong> When bombers die, they explode dealing damage to adjacent units</li>
              </ul>
            </section>

            {/* Queen Mechanics */}
            <section style={{ marginBottom: '25px' }}>
              <h2 style={{ color: '#2196F3', marginBottom: '10px' }}>Queen Mechanics</h2>
              <ul style={{ fontSize: '14px', lineHeight: '1.8' }}>
                <li><strong>Energy System:</strong> Queens start with {GameConstants.QUEEN_BASE_ENERGY} energy, regenerate {GameConstants.QUEEN_BASE_ENERGY_REGEN} per round</li>
                <li><strong>Laying Eggs:</strong> Costs {GameConstants.EGG_LAY_ENERGY_COST} energy (reduced with upgrades). Eggs hatch after their incubation time</li>
                <li><strong>Spawning Pool:</strong> Queens can only lay eggs in adjacent hexes (2 spots initially, increases with upgrades)</li>
                <li><strong>Healing:</strong> Costs {GameConstants.HEAL_ENERGY_COST} energy to heal a friendly unit for {GameConstants.HEAL_AMOUNT} HP within range 2</li>
                <li><strong>Passive Income:</strong> Queens generate {GameConstants.QUEEN_BASE_FOOD_INCOME} food per turn (increases with upgrades)</li>
                <li><strong>Queen Upgrades:</strong> Upgrade to Brood Queen (+2 spots, -5 egg cost, +3 food/turn) then Swarm Queen (+2 more spots, -5 more egg cost, +3 food/turn)</li>
              </ul>
            </section>

            {/* Anthills */}
            <section style={{ marginBottom: '25px' }}>
              <h2 style={{ color: '#2196F3', marginBottom: '10px' }}>Anthills & Economy</h2>
              <ul style={{ fontSize: '14px', lineHeight: '1.8' }}>
                <li><strong>Building:</strong> Drones can build anthills on resource nodes (requires 2 build actions)</li>
                <li><strong>Passive Income:</strong> Completed anthills generate {GameConstants.ANTHILL_PASSIVE_INCOME.food} food or {GameConstants.ANTHILL_PASSIVE_INCOME.minerals} minerals per turn</li>
                <li><strong>Anthills as Structures:</strong> Have 20 HP and provide +2 defense to units standing on them</li>
                <li><strong>Strategy:</strong> Secure resource nodes early for economic advantage!</li>
              </ul>
            </section>

            {/* Upgrades */}
            <section style={{ marginBottom: '25px' }}>
              <h2 style={{ color: '#2196F3', marginBottom: '10px' }}>Upgrades</h2>
              <div style={{ fontSize: '14px', lineHeight: '1.8' }}>
                {Object.values(Upgrades).map(upgrade => (
                  <div key={upgrade.id} style={{ marginBottom: '10px' }}>
                    <strong>{upgrade.icon} {upgrade.name}:</strong> {upgrade.description}
                    {upgrade.id === 'cannibalism' && <> - Grants {GameConstants.CANNIBALISM_FOOD_GAIN} food and {GameConstants.CANNIBALISM_MINERAL_GAIN} minerals when melee units kill enemies</>}
                    <br/>
                    <em style={{ fontSize: '12px', color: '#666' }}>
                      Max Tier: {upgrade.maxTier} | Costs: {upgrade.costs.map((c, i) => `T${i+1}: ${c.food}🍃 ${c.minerals}💎`).join(', ')}
                    </em>
                  </div>
                ))}
              </div>
            </section>

            {/* Tips & Strategy */}
            <section style={{ marginBottom: '25px' }}>
              <h2 style={{ color: '#2196F3', marginBottom: '10px' }}>Tips & Strategy</h2>
              <ul style={{ fontSize: '14px', lineHeight: '1.8' }}>
                <li>Send scouts early to explore and claim resource nodes</li>
                <li>Build anthills for passive income - economy wins games!</li>
                <li>Protect your Queen at all costs - losing her means defeat</li>
                <li>Use tanks to hold the frontline while ranged units deal damage</li>
                <li>Bombardiers are powerful but vulnerable - keep them protected</li>
                <li>Upgrade your units to gain combat advantages</li>
                <li>Cannibalism upgrade turns aggressive play into resource generation</li>
                <li>Position units on anthills for the +2 defense bonus in key fights</li>
              </ul>
            </section>

            {/* Controls */}
            <section>
              <h2 style={{ color: '#2196F3', marginBottom: '10px' }}>Controls</h2>
              <ul style={{ fontSize: '14px', lineHeight: '1.8' }}>
                <li><strong>Left Click:</strong> Select units, select actions, move, attack</li>
                <li><strong>Right Click:</strong> Deselect/Cancel</li>
                <li><strong>Tab Key / 🐜⟳ Button:</strong> Cycle to next ant with available actions</li>
                <li><strong>Mouse Wheel:</strong> Zoom in/out</li>
                <li><strong>Middle Click / Ctrl+Drag:</strong> Pan camera</li>
                <li><strong>WASD / Arrow Keys:</strong> Pan camera</li>
                <li><strong>+/- Keys:</strong> Zoom in/out</li>
                <li><strong>C Key / 👑 Button:</strong> Center camera on your Queen</li>
                <li><strong>Build Ants (Left Panel):</strong> Click an ant type to queue egg laying</li>
                <li><strong>Upgrades (Right Panel):</strong> Purchase upgrades to boost your army</li>
                <li><strong>End Turn:</strong> Complete your turn and switch to opponent</li>
              </ul>
            </section>

            <div style={{ marginTop: '30px', textAlign: 'center', paddingTop: '20px', borderTop: '2px solid #ddd' }}>
              <button
                onClick={() => setShowHelpGuide(false)}
                style={{
                  padding: '12px 30px',
                  fontSize: '16px',
                  backgroundColor: '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Got It!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
