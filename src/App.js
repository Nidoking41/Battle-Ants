import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import { createInitialGameState, endTurn, markAntMoved, canAfford, deductCost, createEgg, canAffordUpgrade, purchaseUpgrade, buildAnthill, hasEnoughEnergy, getEggLayCost, deductEnergy, healAnt, upgradeQueen, canAffordQueenUpgrade, getSpawningPoolHexes, revealArea } from './gameState';
import { moveAnt, resolveCombat, canAttack, detonateBomber, attackAnthill, attackEgg } from './combatSystem';
import { AntTypes, Upgrades, GameConstants, QueenTiers } from './antTypes';
import { hexToPixel, getMovementRange, HexCoord, getNeighbors } from './hexUtils';
import MultiplayerMenu from './MultiplayerMenu';
import { subscribeToGameState, updateGameState, applyFogOfWar, getVisibleHexes } from './multiplayerUtils';

function App() {
  const [gameMode, setGameMode] = useState(null);
  const [gameState, setGameState] = useState(createInitialGameState());
  const [fullGameState, setFullGameState] = useState(null);
  const [selectedAnt, setSelectedAnt] = useState(null);
  const [selectedAction, setSelectedAction] = useState(null);
  const [selectedEggHex, setSelectedEggHex] = useState(null);
  const [showAntTypeSelector, setShowAntTypeSelector] = useState(false);
  const [selectedEgg, setSelectedEgg] = useState(null);
  const [damageNumbers, setDamageNumbers] = useState([]);
  const [attackAnimations, setAttackAnimations] = useState([]);
  const [projectiles, setProjectiles] = useState([]);
  const [resourceGainNumbers, setResourceGainNumbers] = useState([]);
  const [showHelpGuide, setShowHelpGuide] = useState(false);

  // Camera/view state
  const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Track last processed action timestamps to prevent duplicate animations
  const [lastProcessedCombat, setLastProcessedCombat] = useState(null);
  const [lastProcessedMovement, setLastProcessedMovement] = useState(null);

  // Double-click tracking for drone anthill completion
  const [lastClickTime, setLastClickTime] = useState(0);
  const [lastClickedHex, setLastClickedHex] = useState(null);
  const DOUBLE_CLICK_DELAY = 300; // ms

  const hexSize = 50;
  const gridRadius = 6;
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 2.0;

  // Helper function to compare hex positions
  const hexEquals = (pos1, pos2) => {
    if (!pos1 || !pos2) return false;
    return pos1.q === pos2.q && pos1.r === pos2.r;
  };

  // Get current player ID
  const getCurrentPlayerId = useCallback(() => {
    return gameMode?.isMultiplayer ? gameMode.playerRole : gameState.currentPlayer;
  }, [gameMode, gameState.currentPlayer]);

  // Center camera on queen
  const centerOnQueen = useCallback(() => {
    const currentPlayerId = getCurrentPlayerId();
    const queen = Object.values(gameState.ants).find(
      ant => ant.type === 'queen' && ant.owner === currentPlayerId
    );

    if (queen) {
      const queenPixel = hexToPixel(queen.position, hexSize);
      setCameraOffset({
        x: -queenPixel.x,
        y: -queenPixel.y
      });
    }
  }, [getCurrentPlayerId, gameState.ants]);

  // Handle mouse down for panning
  const handleMouseDown = (e) => {
    if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
      e.preventDefault();
      setIsDragging(true);
      setDragStart({ x: e.clientX - cameraOffset.x, y: e.clientY - cameraOffset.y });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setCameraOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel + delta));
    setZoomLevel(newZoom);
  };

  // Check if it's current player's turn
  const isMyTurn = useCallback(() => {
    if (!gameMode) return false;
    if (!gameMode.isMultiplayer) return true;
    return gameState.currentPlayer === gameMode.playerRole;
  }, [gameMode, gameState.currentPlayer]);

  // Keyboard controls
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
  }, [isMyTurn, centerOnQueen]);

  // Function to show damage number
  const showDamageNumber = useCallback((damage, position) => {
    const id = `damage_${Date.now()}_${Math.random()}`;
    const newDamage = {
      id,
      damage,
      position,
      timestamp: Date.now()
    };
    setDamageNumbers(prev => [...prev, newDamage]);

    setTimeout(() => {
      setDamageNumbers(prev => prev.filter(d => d.id !== id));
    }, 1000);
  }, []);

  // Function to trigger attack animation
  const showAttackAnimation = useCallback((attackerId, targetPosition, isRanged) => {
    const id = `attack_${Date.now()}_${Math.random()}`;
    const newAnimation = {
      id,
      attackerId,
      targetPos: targetPosition,
      timestamp: Date.now(),
      isRanged
    };
    setAttackAnimations(prev => [...prev, newAnimation]);

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
          setTimeout(() => {
            setProjectiles(prev => prev.filter(p => p.id !== projectileId));
          }, 300);
        }
      }, 200);
    }

    setTimeout(() => {
      setAttackAnimations(prev => prev.filter(a => a.id !== id));
    }, isRanged ? 200 : 400);
  }, [gameState.ants]);

  // Function to show resource gain number
  const showResourceGain = useCallback((amount, type, position) => {
    const id = `resource_${Date.now()}_${Math.random()}`;
    const newGain = {
      id,
      amount,
      type,
      position,
      timestamp: Date.now()
    };
    setResourceGainNumbers(prev => [...prev, newGain]);

    setTimeout(() => {
      setResourceGainNumbers(prev => prev.filter(r => r.id !== id));
    }, 1000);
  }, []);

  // Animation loops
  useEffect(() => {
    if (damageNumbers.length === 0) return;
    const interval = setInterval(() => {
      setDamageNumbers(prev => [...prev]);
    }, 16);
    return () => clearInterval(interval);
  }, [damageNumbers.length]);

  useEffect(() => {
    if (attackAnimations.length === 0) return;
    const interval = setInterval(() => {
      setAttackAnimations(prev => [...prev]);
    }, 16);
    return () => clearInterval(interval);
  }, [attackAnimations.length]);

  useEffect(() => {
    if (projectiles.length === 0) return;
    const interval = setInterval(() => {
      setProjectiles(prev => [...prev]);
    }, 16);
    return () => clearInterval(interval);
  }, [projectiles.length]);

  useEffect(() => {
    if (resourceGainNumbers.length === 0) return;
    const interval = setInterval(() => {
      setResourceGainNumbers(prev => [...prev]);
    }, 16);
    return () => clearInterval(interval);
  }, [resourceGainNumbers.length]);

  // Subscribe to multiplayer game state
  useEffect(() => {
    if (gameMode?.isMultiplayer && gameMode.gameId) {
      const unsubscribe = subscribeToGameState(gameMode.gameId, (newState) => {
        setFullGameState(newState);

        // Handle combat animations
        if (newState.lastCombatAction && newState.lastCombatAction.timestamp) {
          const { attackerId, targetPosition, isRanged, damageDealt, timestamp } = newState.lastCombatAction;
          
          // Only process if this is a new action we haven't seen
          if (timestamp !== lastProcessedCombat) {
            const isRecent = Date.now() - timestamp < 2000;
            
            if (isRecent) {
              setLastProcessedCombat(timestamp);
              
              // Get visible hexes as a Set
              const visibleHexSet = getVisibleHexes(newState, gameMode.playerRole);
              
              const attacker = newState.ants[attackerId];
              const attackerHexKey = attacker ? `${attacker.position.q},${attacker.position.r}` : null;
              const targetHexKey = `${targetPosition.q},${targetPosition.r}`;
              
              const attackerVisible = attackerHexKey && visibleHexSet.has(attackerHexKey);
              const targetVisible = visibleHexSet.has(targetHexKey);

              if (targetVisible) {
                if (isRanged && !attackerVisible) {
                  if (damageDealt && damageDealt.length > 0) {
                    damageDealt.forEach(({ damage, position }) => {
                      showDamageNumber(damage, position);
                    });
                  }
                } else if (attackerVisible) {
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
          }
        }

        // Handle movement animations
        if (newState.lastMovementAction && newState.lastMovementAction.timestamp) {
          const { antId, fromPosition, toPosition, timestamp } = newState.lastMovementAction;
          
          if (timestamp !== lastProcessedMovement) {
            const isRecent = Date.now() - timestamp < 2000;
            
            if (isRecent) {
              setLastProcessedMovement(timestamp);
              
              const visibleHexSet = getVisibleHexes(newState, gameMode.playerRole);
              const fromKey = `${fromPosition.q},${fromPosition.r}`;
              const toKey = `${toPosition.q},${toPosition.r}`;
              
              // Log movement if visible (you could add movement animation here)
              if (visibleHexSet.has(fromKey) || visibleHexSet.has(toKey)) {
                console.log(`Opponent ant moved from ${fromKey} to ${toKey}`);
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
  }, [gameMode, lastProcessedCombat, lastProcessedMovement, showDamageNumber, showAttackAnimation]);

  // Get the game state for logic
  const getGameStateForLogic = useCallback(() => {
    if (gameMode?.isMultiplayer) {
      return fullGameState || gameState;
    }
    return gameState;
  }, [gameMode, fullGameState, gameState]);

  // Update game state
  const updateGame = useCallback((newState) => {
    if (gameMode?.isMultiplayer) {
      if (gameMode.gameId) {
        updateGameState(gameMode.gameId, newState);
      }
    } else {
      setGameState(newState);
    }
  }, [gameMode]);

  // Handle start game from menu
  const handleStartGame = (mode) => {
    setGameMode(mode);
    if (!mode.isMultiplayer) {
      setGameState(createInitialGameState());
    }
  };

  // Handle entering lobby (for online multiplayer room setup)
  const handleEnterLobby = (lobbyData) => {
    // For now, this is handled by handleStartGame
    // Future: Add dedicated lobby screen
    handleStartGame(lobbyData);
  };

  // Handle entering local game setup
  const handleEnterLocalSetup = () => {
    // For now, just start a local game with default settings
    alert('Local game setup - Coming soon! Starting a quick local game...');
    handleStartGame({
      isMultiplayer: false,
      isLocal: true
    });
  };

  // Handle entering AI game setup
  const handleEnterAISetup = () => {
    // For now, just start an AI game with default settings
    alert('AI game setup - Coming soon! Starting a quick AI game...');
    handleStartGame({
      isMultiplayer: false,
      isAI: true
    });
  };

  // Handle entering online multiplayer lobby
  const handleEnterOnlineMultiplayer = () => {
    // This should show the room code entry/creation screen
    // For now, just show an alert
    alert('Online multiplayer lobby - Use Quick Play or Join with Code buttons instead!');
  };

  // Show menu if game hasn't started
  if (!gameMode) {
    return <MultiplayerMenu
      onStartGame={handleStartGame}
      onEnterLobby={handleEnterLobby}
      onEnterLocalSetup={handleEnterLocalSetup}
      onEnterAISetup={handleEnterAISetup}
      onEnterOnlineMultiplayer={handleEnterOnlineMultiplayer}
    />;
  }

  // Handle detonating a bomber
  const handleDetonate = () => {
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

    const newState = detonateBomber(currentState, selectedAnt);
    updateGame(newState);
    setSelectedAction(null);
    setSelectedAnt(null);
  };

  // Get enemies in attack range
  const getEnemiesInRange = () => {
    if (!selectedAnt) return [];
    const currentState = getGameStateForLogic();
    const ant = currentState.ants[selectedAnt];
    if (!ant) return [];

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

  // Check if ant can still act
  const canAntStillAct = (antId, state) => {
    const ant = state.ants[antId];
    if (!ant || ant.hasAttacked) return false;

    const antType = AntTypes[ant.type.toUpperCase()];

    const hasEnemiesInRange = Object.values(state.ants).some(enemyAnt => {
      if (enemyAnt.owner !== ant.owner) {
        const distance = Math.max(
          Math.abs(ant.position.q - enemyAnt.position.q),
          Math.abs(ant.position.r - enemyAnt.position.r),
          Math.abs((-ant.position.q - ant.position.r) - (-enemyAnt.position.q - enemyAnt.position.r))
        );
        return distance <= antType.attackRange;
      }
      return false;
    });

    if (hasEnemiesInRange) return true;

    const hasEggsInRange = Object.values(state.eggs || {}).some(egg => {
      if (egg.owner !== ant.owner) {
        const distance = Math.max(
          Math.abs(ant.position.q - egg.position.q),
          Math.abs(ant.position.r - egg.position.r),
          Math.abs((-ant.position.q - ant.position.r) - (-egg.position.q - egg.position.r))
        );
        return distance <= antType.attackRange;
      }
      return false;
    });

    if (hasEggsInRange) return true;

    const hasAnthillsInRange = Object.values(state.anthills || {}).some(anthill => {
      if (anthill.owner !== ant.owner) {
        const distance = Math.max(
          Math.abs(ant.position.q - anthill.position.q),
          Math.abs(ant.position.r - anthill.position.r),
          Math.abs((-ant.position.q - ant.position.r) - (-anthill.position.q - anthill.position.r))
        );
        return distance <= antType.attackRange;
      }
      return false;
    });

    if (hasAnthillsInRange) return true;

    if (ant.type === 'drone') {
      const isOnResourceNode = Object.values(state.resources || {}).some(
        node => node.position.q === ant.position.q && node.position.r === ant.position.r
      );
      if (isOnResourceNode) return true;
    }

    return false;
  };

  // Check if drone can complete an anthill at its position
  const canDroneCompleteAnthill = (currentState, drone) => {
    if (!drone || drone.type !== 'drone') return null;
    if (drone.hasMoved || drone.hasAttacked || drone.hasBuilt) return null;

    // Find incomplete anthill at drone's position that belongs to the same player
    const incompleteAnthill = Object.values(currentState.anthills || {}).find(
      anthill => 
        hexEquals(anthill.position, drone.position) && 
        anthill.owner === drone.owner && 
        !anthill.isComplete &&
        anthill.buildProgress < GameConstants.ANTHILL_BUILD_PROGRESS_REQUIRED
    );

    return incompleteAnthill;
  };

  // Handle double-click to complete anthill
  const handleDoubleClickAnthill = (currentState, drone) => {
    const incompleteAnthill = canDroneCompleteAnthill(currentState, drone);
    
    if (!incompleteAnthill) return false;

    // Find the resource at this position
    const resource = Object.values(currentState.resources).find(
      r => hexEquals(r.position, drone.position)
    );

    if (!resource) return false;

    // Build the anthill (this will add progress)
    const newState = buildAnthill(currentState, drone.id, resource.id);
    updateGame(newState);
    setSelectedAction(null);
    setSelectedAnt(null);
    return true;
  };

  // Handle hex click
  const handleHexClick = (hex) => {
    if (!isMyTurn()) {
      alert("It's not your turn!");
      return;
    }

    const currentState = getGameStateForLogic();
    const currentPlayerId = getCurrentPlayerId();
    const now = Date.now();

    // Check for double-click
    const isDoubleClick = (now - lastClickTime < DOUBLE_CLICK_DELAY) && 
                          lastClickedHex && 
                          hexEquals(lastClickedHex, hex);
    
    setLastClickTime(now);
    setLastClickedHex(hex);

    // Handle double-click on a drone to complete anthill
    if (isDoubleClick) {
      const clickedAnt = Object.values(currentState.ants).find(
        a => hexEquals(a.position, hex) && a.owner === currentPlayerId
      );
      
      if (clickedAnt && clickedAnt.type === 'drone') {
        const handled = handleDoubleClickAnthill(currentState, clickedAnt);
        if (handled) return;
      }
    }

    // If detonating a bomber
    if (selectedAction === 'detonate' && selectedAnt) {
      handleDetonate();
      return;
    }

    // If revealing (Queen only)
    if (selectedAction === 'reveal' && selectedAnt) {
      const queen = currentState.ants[selectedAnt];

      if (!queen || queen.type !== 'queen') {
        alert('Only queens can reveal!');
        setSelectedAction(null);
        return;
      }

      if (queen.hasAttacked) {
        alert('This queen has already used a terminal action this turn!');
        return;
      }

      const playerUpgrades = currentState.players[queen.owner]?.upgrades || {};
      if (!playerUpgrades.reveal || playerUpgrades.reveal < 1) {
        alert('You need to purchase the Reveal upgrade first!');
        return;
      }

      const revealCost = AntTypes.QUEEN.revealEnergyCost || 20;
      if (!hasEnoughEnergy(queen, revealCost)) {
        alert(`Not enough energy! Need ${revealCost} energy to reveal.`);
        return;
      }

      const newState = revealArea(currentState, selectedAnt, hex);
      
      // Show visual feedback
      const revealedHexes = [hex, ...getNeighbors(hex)];
      console.log('Revealed hexes:', revealedHexes.map(h => `(${h.q},${h.r})`));

      updateGame(newState);
      setSelectedAction(null);
      setSelectedAnt(null);
      return;
    }

    // If attacking
    if (selectedAction === 'attack' && selectedAnt) {
      const ant = currentState.ants[selectedAnt];

      if (ant.hasAttacked) {
        alert('This unit has already attacked this turn!');
        return;
      }

      const enemyAtHex = Object.values(currentState.ants).find(
        a => hexEquals(a.position, hex) && a.owner !== ant.owner
      );

      const eggAtHex = Object.values(currentState.eggs || {}).find(
        e => hexEquals(e.position, hex) && e.owner !== ant.owner
      );

      const anthillAtHex = Object.values(currentState.anthills || {}).find(
        a => hexEquals(a.position, hex) && a.owner !== ant.owner
      );

      if (enemyAtHex) {
        if (canAttack(ant, enemyAtHex, currentState)) {
          const antType = AntTypes[ant.type.toUpperCase()];
          const isRanged = antType.attackRange > 1;

          showAttackAnimation(selectedAnt, enemyAtHex.position, isRanged);

          setTimeout(() => {
            const combatResult = resolveCombat(currentState, selectedAnt, enemyAtHex.id);
            const newState = combatResult.gameState;

            combatResult.damageDealt.forEach(({ damage, position }) => {
              showDamageNumber(damage, position);
            });

            const markedState = {
              ...newState,
              ants: {
                ...newState.ants,
                [selectedAnt]: newState.ants[selectedAnt] ? {
                  ...newState.ants[selectedAnt],
                  hasAttacked: true
                } : undefined
              },
              lastCombatAction: {
                attackerId: selectedAnt,
                targetPosition: enemyAtHex.position,
                isRanged,
                damageDealt: combatResult.damageDealt,
                timestamp: Date.now()
              }
            };
            if (markedState.ants[selectedAnt] === undefined) {
              delete markedState.ants[selectedAnt];
            }
            updateGame(markedState);
            setSelectedAction(null);
            setSelectedAnt(null);
          }, isRanged ? 500 : 400);
          return;
        } else {
          alert('Enemy is out of attack range!');
          return;
        }
      } else if (eggAtHex) {
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

        if (antType.minAttackRange && distance < antType.minAttackRange) {
          alert('Too close! This unit cannot attack at this range.');
          return;
        }

        const isRanged = antType.attackRange > 1;
        showAttackAnimation(selectedAnt, eggAtHex.position, isRanged);

        setTimeout(() => {
          const combatResult = attackEgg(currentState, selectedAnt, eggAtHex.id);
          const newState = combatResult.gameState;

          combatResult.damageDealt.forEach(({ damage, position }) => {
            showDamageNumber(damage, position);
          });

          const markedState = {
            ...newState,
            ants: {
              ...newState.ants,
              [selectedAnt]: {
                ...newState.ants[selectedAnt],
                hasAttacked: true
              }
            },
            lastCombatAction: {
              attackerId: selectedAnt,
              targetPosition: eggAtHex.position,
              isRanged,
              damageDealt: combatResult.damageDealt,
              timestamp: Date.now()
            }
          };
          updateGame(markedState);
          setSelectedAction(null);
          setSelectedAnt(null);
        }, isRanged ? 500 : 400);
        return;
      } else if (anthillAtHex) {
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

        if (antType.minAttackRange && distance < antType.minAttackRange) {
          alert('Too close! This unit cannot attack at this range.');
          return;
        }

        const isRanged = antType.attackRange > 1;
        showAttackAnimation(selectedAnt, anthillAtHex.position, isRanged);

        setTimeout(() => {
          const combatResult = attackAnthill(currentState, selectedAnt, anthillAtHex.id);
          const newState = combatResult.gameState;

          combatResult.damageDealt.forEach(({ damage, position }) => {
            showDamageNumber(damage, position);
          });

          const markedState = {
            ...newState,
            ants: {
              ...newState.ants,
              [selectedAnt]: {
                ...newState.ants[selectedAnt],
                hasAttacked: true
              }
            },
            lastCombatAction: {
              attackerId: selectedAnt,
              targetPosition: anthillAtHex.position,
              isRanged,
              damageDealt: combatResult.damageDealt,
              timestamp: Date.now()
            }
          };
          updateGame(markedState);
          setSelectedAction(null);
          setSelectedAnt(null);
        }, isRanged ? 500 : 400);
        return;
      } else {
        alert('No enemy at that location!');
        return;
      }
    }

    // If healing (Queen only)
    if (selectedAction === 'heal' && selectedAnt) {
      const queen = currentState.ants[selectedAnt];

      if (!queen || queen.type !== 'queen') {
        alert('Only queens can heal!');
        setSelectedAction(null);
        return;
      }

      if (queen.hasAttacked) {
        alert('This queen has already used a terminal action this turn!');
        return;
      }

      if (!hasEnoughEnergy(queen, GameConstants.HEAL_ENERGY_COST)) {
        alert(`Not enough energy! Need ${GameConstants.HEAL_ENERGY_COST} energy to heal.`);
        return;
      }

      // Find friendly unit - use currentPlayerId for correct ownership check
      const friendlyAtHex = Object.values(currentState.ants).find(
        a => hexEquals(a.position, hex) && a.owner === currentPlayerId
      );

      if (!friendlyAtHex) {
        alert('No friendly unit at that location!');
        return;
      }

      if (friendlyAtHex.health >= friendlyAtHex.maxHealth) {
        alert('That unit is already at full health!');
        return;
      }

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

      const newState = healAnt(currentState, selectedAnt, friendlyAtHex.id);
      const healAmount = Math.min(GameConstants.HEAL_AMOUNT, friendlyAtHex.maxHealth - friendlyAtHex.health);
      showResourceGain(healAmount, 'heal', friendlyAtHex.position);

      updateGame(newState);
      setSelectedAction(null);
      setSelectedAnt(null);
      return;
    }

    // If laying egg
    if (selectedAction === 'layEgg' && selectedAnt) {
      const ant = currentState.ants[selectedAnt];

      if (ant.type !== 'queen') {
        alert('Only queens can lay eggs!');
        setSelectedAction(null);
        return;
      }

      const spawningPool = getSpawningPoolHexes(ant, getNeighbors);
      const isInSpawningPool = spawningPool.some(n => hexEquals(n, hex));

      if (!isInSpawningPool) {
        const queenTier = QueenTiers[ant.queenTier || 'queen'];
        alert(`Can only lay eggs in the ${queenTier.spawningSpots} spawning pool hexes adjacent to your queen!`);
        return;
      }

      const occupied = Object.values(currentState.ants).some(a => hexEquals(a.position, hex)) ||
                       Object.values(currentState.eggs).some(e => hexEquals(e.position, hex));

      if (occupied) {
        alert('Space is occupied!');
        return;
      }

      if (selectedEggHex && selectedEggHex.antType) {
        handleLayEgg(selectedEggHex.antType, hex);
        return;
      }

      setSelectedEggHex(hex);
      setShowAntTypeSelector(true);
      return;
    }

    // If building anthill
    if (selectedAction === 'buildAnthill' && selectedAnt) {
      const drone = currentState.ants[selectedAnt];

      if (drone.type !== 'drone') {
        alert('Only drones can build anthills!');
        setSelectedAction(null);
        return;
      }

      const resourceAtHex = Object.values(currentState.resources).find(
        r => hexEquals(r.position, hex)
      );

      if (!resourceAtHex) {
        alert('Click on a resource node to build an anthill!');
        return;
      }

      const distance = Math.max(
        Math.abs(drone.position.q - resourceAtHex.position.q),
        Math.abs(drone.position.r - resourceAtHex.position.r),
        Math.abs((-drone.position.q - drone.position.r) - (-resourceAtHex.position.q - resourceAtHex.position.r))
      );

      if (distance > 1) {
        alert('Must be adjacent to or on the resource node to build an anthill!');
        return;
      }

      const existingAnthill = Object.values(currentState.anthills || {}).find(
        a => hexEquals(a.position, resourceAtHex.position)
      );

      const resourceLabel = String.fromCharCode(65 + resourceAtHex.position.q + 6) + (resourceAtHex.position.r + 7);

      if (existingAnthill && existingAnthill.isComplete && existingAnthill.owner === drone.owner) {
        alert(`There is already a completed ${existingAnthill.resourceType} anthill at ${resourceLabel}!`);
        return;
      }

      if (existingAnthill && existingAnthill.owner !== drone.owner) {
        alert(`Cannot build on enemy anthill at ${resourceLabel}! Destroy it first.`);
        return;
      }

      if (!existingAnthill) {
        const player = currentState.players[drone.owner];
        if (player.resources.food < GameConstants.ANTHILL_BUILD_COST) {
          alert(`Not enough food to start building an anthill! Cost: ${GameConstants.ANTHILL_BUILD_COST} food`);
          return;
        }
      }

      const newState = buildAnthill(currentState, selectedAnt, resourceAtHex.id);
      updateGame(newState);
      setSelectedAction(null);
      setSelectedAnt(null);
      return;
    }

    // If moving ant
    if (selectedAction === 'move' && selectedAnt) {
      const ant = currentState.ants[selectedAnt];

      const enemyAtHex = Object.values(currentState.ants).find(
        a => hexEquals(a.position, hex) && a.owner !== ant.owner
      );

      const eggAtHex = Object.values(currentState.eggs || {}).find(
        e => hexEquals(e.position, hex) && e.owner !== ant.owner
      );

      const anthillAtHex = Object.values(currentState.anthills || {}).find(
        a => hexEquals(a.position, hex) && a.owner !== ant.owner
      );

      if (enemyAtHex) {
        if (ant.hasAttacked) {
          alert('This unit has already attacked this turn!');
          return;
        }

        if (canAttack(ant, enemyAtHex, currentState)) {
          const antType = AntTypes[ant.type.toUpperCase()];
          const isRanged = antType.attackRange > 1;

          showAttackAnimation(selectedAnt, enemyAtHex.position, isRanged);

          setTimeout(() => {
            const combatResult = resolveCombat(currentState, selectedAnt, enemyAtHex.id);
            const newState = combatResult.gameState;

            combatResult.damageDealt.forEach(({ damage, position }) => {
              showDamageNumber(damage, position);
            });

            const markedState = {
              ...newState,
              ants: {
                ...newState.ants,
                [selectedAnt]: newState.ants[selectedAnt] ? {
                  ...newState.ants[selectedAnt],
                  hasMoved: true,
                  hasAttacked: true
                } : undefined
              },
              lastCombatAction: {
                attackerId: selectedAnt,
                targetPosition: enemyAtHex.position,
                isRanged,
                damageDealt: combatResult.damageDealt,
                timestamp: Date.now()
              }
            };
            if (markedState.ants[selectedAnt] === undefined) {
              delete markedState.ants[selectedAnt];
            }
            updateGame(markedState);
            setSelectedAction(null);
            setSelectedAnt(null);
          }, isRanged ? 500 : 400);
          return;
        } else {
          alert('Enemy is out of attack range!');
          return;
        }
      } else if (eggAtHex) {
        if (ant.hasAttacked) {
          alert('This unit has already attacked this turn!');
          return;
        }

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

        if (antType.minAttackRange && distance < antType.minAttackRange) {
          alert('Too close! This unit cannot attack at this range.');
          return;
        }

        const isRanged = antType.attackRange > 1;
        showAttackAnimation(selectedAnt, eggAtHex.position, isRanged);

        setTimeout(() => {
          const combatResult = attackEgg(currentState, selectedAnt, eggAtHex.id);
          const newState = combatResult.gameState;

          combatResult.damageDealt.forEach(({ damage, position }) => {
            showDamageNumber(damage, position);
          });

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
            lastCombatAction: {
              attackerId: selectedAnt,
              targetPosition: eggAtHex.position,
              isRanged,
              damageDealt: combatResult.damageDealt,
              timestamp: Date.now()
            }
          };
          updateGame(markedState);
          setSelectedAction(null);
          setSelectedAnt(null);
        }, isRanged ? 500 : 400);
        return;
      } else if (anthillAtHex) {
        if (ant.hasAttacked) {
          alert('This unit has already attacked this turn!');
          return;
        }

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

        if (antType.minAttackRange && distance < antType.minAttackRange) {
          alert('Too close! This unit cannot attack at this range.');
          return;
        }

        const isRanged = antType.attackRange > 1;
        showAttackAnimation(selectedAnt, anthillAtHex.position, isRanged);

        setTimeout(() => {
          const combatResult = attackAnthill(currentState, selectedAnt, anthillAtHex.id);
          const newState = combatResult.gameState;

          combatResult.damageDealt.forEach(({ damage, position }) => {
            showDamageNumber(damage, position);
          });

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
            lastCombatAction: {
              attackerId: selectedAnt,
              targetPosition: anthillAtHex.position,
              isRanged,
              damageDealt: combatResult.damageDealt,
              timestamp: Date.now()
            }
          };
          updateGame(markedState);
          setSelectedAction(null);
          setSelectedAnt(null);
        }, isRanged ? 500 : 400);
        return;
      }

      if (ant.hasAttacked) {
        alert('This unit has already attacked and cannot move!');
        return;
      }

      if (ant.hasMoved) {
        alert('This unit has already moved this turn!');
        return;
      }

      if (ant.type === 'queen') {
        alert('Queens cannot move! They stay on their throne.');
        return;
      }

      const antType = AntTypes[ant.type.toUpperCase()];
      const validMoves = getMovementRange(ant.position, antType.moveRange, gridRadius);

      if (validMoves.some(h => hexEquals(h, hex))) {
        const antAtHex = Object.values(currentState.ants).find(
          a => hexEquals(a.position, hex)
        );

        if (antAtHex) {
          alert('Cannot move to a space occupied by another ant!');
          return;
        }

        const eggAtPosition = Object.values(currentState.eggs).find(e => hexEquals(e.position, hex));
        if (eggAtPosition) {
          alert('Cannot move to a space occupied by an egg!');
          return;
        }

        const fromPosition = { ...ant.position };
        const newState = moveAnt(currentState, selectedAnt, hex);
        const finalState = {
          ...markAntMoved(newState, selectedAnt),
          lastMovementAction: {
            antId: selectedAnt,
            fromPosition,
            toPosition: { ...hex },
            timestamp: Date.now()
          }
        };
        updateGame(finalState);

        if (canAntStillAct(selectedAnt, finalState)) {
          setSelectedAction(null);
        } else {
          setSelectedAction(null);
          setSelectedAnt(null);
        }
      } else {
        alert('Invalid move!');
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

    // Select ant
    const clickedAnt = Object.values(currentState.ants).find(
      a => hexEquals(a.position, hex) && a.owner === currentPlayerId
    );

    if (clickedAnt) {
      if (selectedAnt === clickedAnt.id) {
        setSelectedAnt(null);
        setSelectedAction(null);
        setSelectedEgg(null);
        return;
      }

      if (clickedAnt.hasMoved && clickedAnt.hasAttacked) {
        alert('This unit has already completed all actions this turn!');
        setSelectedAnt(null);
        setSelectedAction(null);
        setSelectedEgg(null);
        return;
      }

      if (clickedAnt.hasAttacked && clickedAnt.type !== 'queen') {
        alert('This unit has already attacked and cannot move!');
        setSelectedAnt(null);
        setSelectedAction(null);
        setSelectedEgg(null);
        return;
      }

      setSelectedAnt(clickedAnt.id);
      if (clickedAnt.type === 'queen') {
        setSelectedAction('layEgg');
      } else if (clickedAnt.type === 'bomber') {
        setSelectedAction(null);
      } else {
        setSelectedAction('move');
      }
      setSelectedEgg(null);
    }
  };

  // Handle laying egg
  const handleLayEgg = (antType, hexPosition) => {
    const currentState = getGameStateForLogic();
    const currentPlayer = currentState.players[currentState.currentPlayer];
    const type = antType.toUpperCase();

    const queen = Object.values(currentState.ants).find(
      ant => ant.type === 'queen' && ant.owner === currentState.currentPlayer
    );

    if (!queen) {
      alert('No queen found!');
      return;
    }

    const energyCost = getEggLayCost(queen);
    if (!hasEnoughEnergy(queen, energyCost)) {
      alert(`Not enough energy! Need ${energyCost} energy to lay an egg.`);
      return;
    }

    if (!canAfford(currentPlayer, type)) {
      alert('Not enough resources!');
      return;
    }

    const eggPosition = hexPosition || (selectedEggHex && !selectedEggHex.antType ? selectedEggHex : null);

    if (!eggPosition) {
      alert('Select a tile next to your queen to lay the egg!');
      return;
    }

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
    const currentPlayerId = getCurrentPlayerId();

    const antsWithActions = Object.values(currentState.ants).filter(ant =>
      ant.owner === currentPlayerId && hasRemainingActions(ant)
    );

    if (antsWithActions.length === 0) {
      alert('No ants with available actions!');
      return;
    }

    let currentIndex = -1;
    if (selectedAnt) {
      currentIndex = antsWithActions.findIndex(ant => ant.id === selectedAnt);
    }

    const nextIndex = (currentIndex + 1) % antsWithActions.length;
    const nextAnt = antsWithActions[nextIndex];

    setSelectedAnt(nextAnt.id);
    setSelectedEgg(null);

    if (nextAnt.type === 'queen') {
      setSelectedAction('layEgg');
    } else if (nextAnt.type === 'bomber') {
      setSelectedAction(null);
    } else {
      setSelectedAction('move');
    }

    const antPixel = hexToPixel(nextAnt.position, hexSize);
    setCameraOffset({
      x: -antPixel.x,
      y: -antPixel.y
    });
  };

  // Check if an ant has remaining actions
  const hasRemainingActions = (ant) => {
    if (!ant) return false;

    const currentState = getGameStateForLogic();
    if (ant.owner !== currentState.currentPlayer) return false;

    const antType = AntTypes[ant.type.toUpperCase()];

    if (ant.hasAttacked) return false;

    if (ant.hasMoved) {
      if (antType.canBuildAnthill) {
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

    return true;
  };

  // Calculate valid moves for selected ant
  const getValidMovesForSelectedAnt = () => {
    if (!selectedAnt || !gameState.ants[selectedAnt]) return [];
    const ant = gameState.ants[selectedAnt];
    const antType = AntTypes[ant.type.toUpperCase()];

    if (selectedAction === 'move') {
      if (ant.type === 'queen') {
        return [];
      }
      return getMovementRange(ant.position, antType.moveRange, gridRadius);
    } else if (selectedAction === 'layEgg' && ant.type === 'queen') {
      return getNeighbors(ant.position);
    }
    return [];
  };

  // Render hexagons
  const renderHexGrid = () => {
    const hexagons = [];
    const validMoves = getValidMovesForSelectedAnt();
    const enemiesInRange = selectedAction === 'attack' ? getEnemiesInRange() : [];

    let visibleHexes = null;
    if (gameMode?.isMultiplayer && gameMode.playerRole && fullGameState) {
      visibleHexes = getVisibleHexes(fullGameState, gameMode.playerRole);
    }

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

    for (let q = -gridRadius; q <= gridRadius; q++) {
      for (let r = -gridRadius; r <= gridRadius; r++) {
        const s = -q - r;
        if (Math.abs(q) > gridRadius || Math.abs(r) > gridRadius || Math.abs(s) > gridRadius) continue;

        const hex = new HexCoord(q, r);
        const { x, y } = hexToPixel(hex, hexSize);

        const ant = Object.values(gameState.ants).find(a => hexEquals(a.position, hex));
        const egg = Object.values(gameState.eggs).find(e => hexEquals(e.position, hex));
        const resource = Object.values(gameState.resources).find(r => hexEquals(r.position, hex));
        const anthill = Object.values(gameState.anthills || {}).find(a => hexEquals(a.position, hex));
        const isValidMove = validMoves.some(v => hexEquals(v, hex));
        const isSelected = selectedAnt && hexEquals(gameState.ants[selectedAnt]?.position, hex);
        const isAttackable = enemiesInRange.some(e => hexEquals(e.position, hex));

        const hexKey = `${q},${r}`;
        const isVisible = !visibleHexes || visibleHexes.has(hexKey);

        let isBirthingPool = false;

        Object.values(gameState.ants).forEach(a => {
          if (a.type !== 'queen') return;

          if (hexEquals(a.position, hex)) {
            isBirthingPool = true;
            return;
          }

          const spawningPool = getSpawningPoolHexes(a, getNeighbors);
          if (spawningPool.some(n => hexEquals(n, hex))) {
            isBirthingPool = true;
          }
        });

        let fillColor = '#ddd';
        let useBirthingPoolPattern = false;

        if (isBirthingPool) {
          fillColor = 'url(#birthingPoolGradient)';
          useBirthingPoolPattern = true;
        }
        if (resource) {
          fillColor = resource.type === 'food' ? '#90EE90' : '#FFD700';
          useBirthingPoolPattern = false;
        }
        if (isValidMove) {
          fillColor = '#AED6F1';
          useBirthingPoolPattern = false;
        }
        if (isAttackable) {
          fillColor = '#FF6B6B';
          useBirthingPoolPattern = false;
        }
        if (isSelected) {
          fillColor = '#F9E79F';
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
                e.preventDefault();
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
              const attackAnim = attackAnimations.find(a => a.attackerId === ant.id);
              let transformOffset = '';
              const hasActions = hasRemainingActions(ant);

              if (attackAnim) {
                const elapsed = Date.now() - attackAnim.timestamp;
                const antType = AntTypes[ant.type.toUpperCase()];
                const isRanged = antType.attackRange > 1;

                if (isRanged) {
                  const shakeProgress = Math.min(elapsed / 200, 1);
                  const shakeX = Math.sin(shakeProgress * Math.PI * 4) * 3 * (1 - shakeProgress);
                  const shakeY = Math.cos(shakeProgress * Math.PI * 4) * 3 * (1 - shakeProgress);
                  transformOffset = `translate(${shakeX}, ${shakeY})`;
                } else {
                  const lungeProgress = Math.min(elapsed / 400, 1);
                  const eased = lungeProgress < 0.5
                    ? 2 * lungeProgress * lungeProgress
                    : 1 - Math.pow(-2 * lungeProgress + 2, 2) / 2;

                  const dx = attackAnim.targetPos.q - ant.position.q;
                  const dy = attackAnim.targetPos.r - ant.position.r;
                  const distance = Math.sqrt(dx * dx + dy * dy);
                  const lungeDistance = 20;

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
                    {AntTypes[ant.type.toUpperCase()].icon}
                  </text>
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
                  <g transform="translate(0, 20)">
                    <rect x="-20" y="0" width="40" height="4" fill="#333" style={{ pointerEvents: 'none' }} />
                    <rect
                      x="-20"
                      y="0"
                      width={40 * (ant.health / ant.maxHealth)}
                      height="4"
                      fill={ant.health > ant.maxHealth * 0.5 ? '#2ecc71' : ant.health > ant.maxHealth * 0.25 ? '#f39c12' : '#e74c3c'}
                      style={{ pointerEvents: 'none' }}
                    />
                  </g>
                  {ant.type === 'queen' && ant.energy !== undefined && (
                    <g transform="translate(0, 26)">
                      <rect x="-20" y="0" width="40" height="3" fill="#333" style={{ pointerEvents: 'none' }} />
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
              <text textAnchor="middle" dy="0.3em" fontSize="20" style={{ pointerEvents: 'none' }}>
                🥚
              </text>
            )}
            {resource && !anthill && (
              <text textAnchor="middle" dy="0.3em" fontSize="16" fontWeight="bold" style={{ pointerEvents: 'none' }}>
                {resource.type === 'food' ? '🍃' : '💎'}
              </text>
            )}
            {anthill && (
              <g>
                <text
                  textAnchor="middle"
                  dy="0.3em"
                  fontSize="24"
                  fontWeight="bold"
                  style={{ pointerEvents: 'none', opacity: anthill.isComplete ? 1 : 0.6 }}
                >
                  {anthill.isComplete ? '⛰️' : '🚧'}
                </text>
                <circle
                  cx="15"
                  cy="-15"
                  r="8"
                  fill={gameState.players[anthill.owner].color}
                  stroke="#333"
                  strokeWidth="1.5"
                  style={{ pointerEvents: 'none' }}
                />
                <g transform="translate(0, 20)">
                  <rect x="-20" y="0" width="40" height="4" fill="#333" style={{ pointerEvents: 'none' }} />
                  {anthill.isComplete ? (
                    <rect
                      x="-20"
                      y="0"
                      width={40 * (anthill.health / 20)}
                      height="4"
                      fill={anthill.health > 10 ? '#2ecc71' : anthill.health > 5 ? '#f39c12' : '#e74c3c'}
                      style={{ pointerEvents: 'none' }}
                    />
                  ) : (
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

  const currentPlayerId = getCurrentPlayerId();

  return (
    <div className="App" style={{ padding: '10px', backgroundColor: '#f0f0f0', height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <h1 style={{ margin: '0 0 10px 0', fontSize: '24px' }}>Ant Colony Battler</h1>

      <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', alignItems: 'flex-start', width: '100%' }}>
        {/* Ant Types Panel - Left Side */}
        <div style={{ width: '250px', backgroundColor: '#fff', padding: '15px', borderRadius: '8px', maxHeight: 'calc(100vh - 80px)', overflowY: 'auto' }}>
          {isMyTurn() ? (
            <>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '18px' }}>Build Ants</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.values(AntTypes).filter(t => t.id !== 'queen').map(ant => {
                  const currentPlayer = gameState.players[currentPlayerId];
                  const affordable = canAfford(currentPlayer, ant.id.toUpperCase());

                  return (
                    <button
                      key={ant.id}
                      onClick={() => {
                        const queen = Object.values(gameState.ants).find(
                          a => a.type === 'queen' && a.owner === currentPlayerId
                        );
                        if (!queen) {
                          alert('You need a queen to lay eggs!');
                          return;
                        }
                        if (!affordable) {
                          alert('Not enough resources!');
                          return;
                        }
                        setSelectedAnt(queen.id);
                        setSelectedAction('layEgg');
                        setShowAntTypeSelector(false);
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
                const progress = Math.min(elapsed / 300, 1);

                const x = start.x + (end.x - start.x) * progress;
                const y = start.y + (end.y - start.y) * progress;

                return (
                  <g key={id} transform={`translate(${x}, ${y})`}>
                    <circle r="4" fill="#FF6B00" stroke="#FF0000" strokeWidth="2" />
                  </g>
                );
              })}

              {/* Damage Numbers */}
              {damageNumbers.map(({ id, damage, position, timestamp }) => {
                const { x, y } = hexToPixel(position, hexSize);
                const elapsed = Date.now() - timestamp;
                const progress = elapsed / 1000;

                const offsetY = -progress * 50;
                const opacity = 1 - progress;
                const scale = 1 + progress * 0.5;

                return (
                  <g key={id} transform={`translate(${x}, ${y + offsetY})`} style={{ pointerEvents: 'none' }}>
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

              {/* Resource Gain Numbers */}
              {resourceGainNumbers.map(({ id, amount, type, position, timestamp }) => {
                const { x, y } = hexToPixel(position, hexSize);
                const elapsed = Date.now() - timestamp;
                const progress = elapsed / 1000;

                const offsetY = -progress * 50;
                const opacity = 1 - progress;
                const scale = 1 + progress * 0.5;

                const color = type === 'heal' ? '#00FF00' : (type === 'food' ? '#00BFFF' : '#4169E1');

                return (
                  <g key={id} transform={`translate(${x}, ${y + offsetY})`} style={{ pointerEvents: 'none' }}>
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
              const player = gameState.players[currentPlayerId];

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

          {/* Upgrades Section */}
          {isMyTurn() && (
            <div style={{ marginBottom: '20px', paddingBottom: '15px', borderBottom: '2px solid #ddd' }}>
              <h4>Upgrades</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.values(Upgrades).map(upgrade => {
                  const currentPlayer = gameState.players[currentPlayerId];
                  const currentTier = currentPlayer.upgrades[upgrade.id] || 0;
                  const isMaxed = currentTier >= upgrade.maxTier;
                  const affordable = !isMaxed && canAffordUpgrade(currentPlayer, upgrade.id);
                  const cost = isMaxed ? null : upgrade.costs[currentTier];

                  return (
                    <button
                      key={upgrade.id}
                      onClick={() => {
                        if (!affordable) {
                          alert(isMaxed ? 'Already at max tier!' : 'Not enough resources!');
                          return;
                        }
                        const currentState = getGameStateForLogic();
                        updateGame(purchaseUpgrade(currentState, upgrade.id));
                      }}
                      disabled={!affordable || !isMyTurn()}
                      style={{
                        padding: '12px',
                        fontSize: '15px',
                        backgroundColor: isMaxed ? '#888' : (affordable ? '#9C27B0' : '#ccc'),
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: (affordable && isMyTurn()) ? 'pointer' : 'not-allowed',
                        textAlign: 'left',
                        opacity: isMyTurn() ? 1 : 0.6
                      }}
                    >
                      <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{upgrade.icon} {upgrade.name} (Tier {currentTier}/{upgrade.maxTier})</div>
                      {!isMaxed && cost && (
                        <div style={{ fontSize: '13px', marginTop: '5px' }}>
                          Cost: {cost.food}🍃 {cost.minerals}💎
                        </div>
                      )}
                      <div style={{ fontSize: '12px', marginTop: '3px', opacity: 0.9 }}>
                        {upgrade.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Queen Upgrade Section */}
          {isMyTurn() && (() => {
            const currentState = getGameStateForLogic();
            const queen = Object.values(currentState.ants).find(
              ant => ant.type === 'queen' && ant.owner === currentPlayerId
            );

            if (!queen) return null;

            const currentTier = queen.queenTier || 'queen';
            if (currentTier === 'swarmQueen') return null;

            const nextTier = currentTier === 'queen' ? 'broodQueen' : 'swarmQueen';
            const nextTierData = QueenTiers[nextTier];
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
                      ant => ant.type === 'queen' && ant.owner === currentPlayerId
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
              {gameState.ants[selectedAnt].type === 'queen' && (
                <p>Energy: {gameState.ants[selectedAnt].energy}/{gameState.ants[selectedAnt].maxEnergy}</p>
              )}

              {gameState.ants[selectedAnt].type === 'bomber' ? (
                <button
                  onClick={handleDetonate}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#e74c3c',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '14px'
                  }}
                >
                  💥 DETONATE 💥
                </button>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  <button
                    onClick={() => setSelectedAction('move')}
                    style={{
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
                  <button
                    onClick={() => setSelectedAction('attack')}
                    style={{
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
                  {gameState.ants[selectedAnt].type === 'queen' && (
                    <>
                      <button
                        onClick={() => setSelectedAction('layEgg')}
                        style={{
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
                      {/* Reveal Button - only show if upgrade purchased */}
                      {gameState.players[currentPlayerId]?.upgrades?.reveal >= 1 && (
                        <button
                          onClick={() => setSelectedAction('reveal')}
                          style={{
                            padding: '8px 12px',
                            backgroundColor: selectedAction === 'reveal' ? '#9C27B0' : '#ecf0f1',
                            color: selectedAction === 'reveal' ? 'white' : 'black',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: selectedAction === 'reveal' ? 'bold' : 'normal'
                          }}
                        >
                          Reveal ({AntTypes.QUEEN.revealEnergyCost || 20}⚡)
                        </button>
                      )}
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
                </div>
              )}
              
              {/* Show double-click hint for drones on incomplete anthills */}
              {gameState.ants[selectedAnt].type === 'drone' && (() => {
                const currentState = getGameStateForLogic();
                const drone = currentState.ants[selectedAnt];
                const incompleteAnthill = canDroneCompleteAnthill(currentState, drone);
                if (incompleteAnthill) {
                  return (
                    <p style={{ marginTop: '10px', fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
                      💡 Tip: Double-click this drone to complete the anthill ({incompleteAnthill.buildProgress}/{GameConstants.ANTHILL_BUILD_PROGRESS_REQUIRED})
                    </p>
                  );
                }
                return null;
              })()}
            </div>
          )}

          {/* Ant Type Selector */}
          {showAntTypeSelector && (
            <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#fff3cd', borderRadius: '5px', border: '2px solid #ffc107' }}>
              <h4>Select Ant Type to Lay</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.values(AntTypes).filter(t => t.id !== 'queen').map(ant => {
                  const currentPlayer = gameState.players[currentPlayerId];
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

              if (resourceGains && resourceGains.length > 0) {
                const visibleHexes = gameMode?.isMultiplayer ? getVisibleHexes(newState, currentPlayerId) : null;

                resourceGains.forEach(gain => {
                  const hexKey = `${gain.position.q},${gain.position.r}`;
                  const shouldShow = gain.owner === currentPlayerId ||
                                    (visibleHexes && visibleHexes.has(hexKey)) ||
                                    !gameMode?.isMultiplayer;

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
              cursor: isMyTurn() ? 'pointer' : 'not-allowed',
              opacity: isMyTurn() ? 1 : 0.6
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

      {/* Camera Controls Info */}
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
        C: Center on Queen<br/>
        <strong>Double-click drone</strong> on incomplete anthill to finish building
      </div>

      {/* Help Guide Modal - keeping original for brevity */}
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

            <p>Click the X button to close this help guide.</p>
            
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