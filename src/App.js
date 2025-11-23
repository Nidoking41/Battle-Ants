import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { createInitialGameState, endTurn, markAntMoved, canAfford, deductCost, createEgg, canAffordUpgrade, purchaseUpgrade, buildAnthill, hasEnoughEnergy, getEggLayCost, deductEnergy, healAnt, upgradeQueen, canAffordQueenUpgrade, getSpawningPoolHexes, burrowAnt, unburrowAnt, canBurrow, canUnburrow, teleportAnt, getValidTeleportDestinations, healAlly, ensnareEnemy, getValidHealTargets, getValidEnsnareTargets, cordycepsPurge, getValidCordycepsTargets, plagueEnemy, getValidPlagueTargets, revealArea } from './gameState';
import { moveAnt, resolveCombat, canAttack, detonateBomber, attackAnthill, attackEgg, calculateDamage, bombardierSplashAttack } from './combatSystem';
import { AntTypes, Upgrades, GameConstants, QueenTiers } from './antTypes';
import { hexToPixel, getMovementRange, getMovementRangeWithPaths, HexCoord, getNeighbors, hexesInRange, hexDistance } from './hexUtils';
import MultiplayerMenu from './MultiplayerMenu';
import GameLobby from './GameLobby';
import LocalGameSetup from './LocalGameSetup';
import AIGameSetup from './AIGameSetup';
import { subscribeToGameState, updateGameState, applyFogOfWar, getVisibleHexes } from './multiplayerUtils';
import { executeAITurn } from './aiController';
import forestFloorImage from './forestfloor.png';
import { useSprites } from './useSprites';
import { getSpriteInfo } from './spriteConfig';

function App() {
  const [gameMode, setGameMode] = useState(null); // null = menu, 'lobby' = in lobby, object = game started
  const [lobbySettings, setLobbySettings] = useState(null); // Settings from lobby before game starts
  const [gameState, setGameState] = useState(() => createInitialGameState());
  const [fullGameState, setFullGameState] = useState(null); // Store unfiltered state for multiplayer
  const [isAIThinking, setIsAIThinking] = useState(false); // Track if AI is currently taking its turn
  const [pendingCombat, setPendingCombat] = useState(false); // Track if combat animation is in progress
  const [selectedAnt, setSelectedAnt] = useState(null);
  const [selectedAction, setSelectedAction] = useState(null); // 'move', 'layEgg', or 'detonate'
  const [hoveredHex, setHoveredHex] = useState(null); // Track which hex is being hovered
  const [movementPaths, setMovementPaths] = useState(new Map()); // Map of hex -> path
  const [pathWaypoint, setPathWaypoint] = useState(null); // Intermediate waypoint for pathfinding
  const [selectedEggHex, setSelectedEggHex] = useState(null); // Store hex for egg laying
  const [showAntTypeSelector, setShowAntTypeSelector] = useState(false); // Show ant type buttons
  const [pendingEggType, setPendingEggType] = useState(null); // Store egg type when using Q+key hotkeys
  const [selectedEgg, setSelectedEgg] = useState(null); // Store selected egg for viewing info
  const [selectedAnthill, setSelectedAnthill] = useState(null); // Store selected anthill for viewing info
  const [damageNumbers, setDamageNumbers] = useState([]); // Array of {id, damage, position, timestamp}
  const [attackAnimations, setAttackAnimations] = useState([]); // Array of {id, attackerId, targetPos, timestamp, isRanged}
  const [projectiles, setProjectiles] = useState([]); // Array of {id, startPos, endPos, timestamp}
  const [resourceGainNumbers, setResourceGainNumbers] = useState([]); // Array of {id, amount, type, position, timestamp}
  const [explosions, setExplosions] = useState([]); // Array of {id, position, timestamp} for bomber explosions
  const [showHelpGuide, setShowHelpGuide] = useState(false); // Show help/guide popup
  const [showUpgradesModal, setShowUpgradesModal] = useState(false); // Show upgrades modal
  const [attackTarget, setAttackTarget] = useState(null); // Store target enemy when selecting attack position
  const [attackPositions, setAttackPositions] = useState([]); // Valid positions to attack from
  const [movingAnt, setMovingAnt] = useState(null); // {antId, path, currentStep} for animating movement
  const [bombardierRotation, setBombardierRotation] = useState(0); // 0-5 for the 6 hex directions
  const [bombardierTargetHex, setBombardierTargetHex] = useState(null); // Store the center hex for bombardier splash
  const [showHeroInfo, setShowHeroInfo] = useState(false); // Show hero info modal
  const [effectAnimationFrame, setEffectAnimationFrame] = useState(0); // Current frame for status effect animations (0-7)

  // Store random hex colors for earthy terrain
  const [hexColors] = useState(() => {
    // Earthy tone colors: light browns and greens
    const earthyTones = [
      '#8B7355', // Light brown
      '#A0826D', // Tan
      '#9C8B6B', // Khaki brown
      '#6B8E23', // Olive green
      '#8FBC8F', // Dark sea green
      '#90A955', // Moss green
      '#7D8471', // Sage green
      '#8E8268', // Warm gray-brown
      '#9B9B7A', // Light olive
      '#87986A', // Green-brown
    ];

    // Simple pseudo-random number generator with seed
    const seededRandom = (seed) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };

    // Generate random color for each hex using a seeded random based on position
    const colors = new Map();
    const gridRadius = 6; // Match the default grid size
    for (let q = -gridRadius; q <= gridRadius; q++) {
      for (let r = -gridRadius; r <= gridRadius; r++) {
        const s = -q - r;
        if (Math.abs(s) <= gridRadius) {
          // Use position as seed for consistent but varied colors
          const seed = q * 7919 + r * 7907 + s * 7901; // Large primes for better distribution
          const randomValue = seededRandom(seed);
          const colorIndex = Math.floor(randomValue * earthyTones.length);
          colors.set(`${q},${r}`, earthyTones[colorIndex]);
        }
      }
    }
    return colors;
  });

  // Sprite animation system
  const { setAntAnimation, removeAntAnimation, getAntFrame } = useSprites();

  // Track the last combat action timestamp to prevent replaying the same animation
  const lastCombatActionTimestamp = useRef(null);

  // Initialize all ants with idle animation when game state or player colors change
  useEffect(() => {
    Object.values(gameState.ants).forEach(ant => {
      const playerColor = gameState.players[ant.owner]?.color;
      setAntAnimation(ant.id, ant.type, 'idle', playerColor);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.players?.player1?.color, gameState.players?.player2?.color]); // Re-run when player colors change

  // Keyboard event listener for Shift key to rotate bombardier splash
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Shift' && selectedAction === 'bombardier_splash' && bombardierTargetHex) {
        event.preventDefault();
        setBombardierRotation(prev => (prev + 1) % 6);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedAction, bombardierTargetHex]);

  // Cycle effect animation frames (ensnare, plague)
  useEffect(() => {
    const interval = setInterval(() => {
      setEffectAnimationFrame(prev => (prev + 1) % 8); // Cycle through 8 frames
    }, 100); // 100ms per frame = ~10 FPS

    return () => clearInterval(interval);
  }, []);

  // Camera/view state for pan and zoom
  const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0 }); // Camera position offset
  const [zoomLevel, setZoomLevel] = useState(1.0); // Zoom level (0.5 to 2.0)
  const [isDragging, setIsDragging] = useState(false); // Is user dragging the view
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 }); // Drag start position

  const hexSize = 50;
  // Get gridRadius from gameState (defaults to 6 if not set)
  const gridRadius = gameState.gridRadius || 6;
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 2.0;

  // Helper function to compare hex positions (works with HexCoord objects or plain objects)
  const hexEquals = (pos1, pos2) => {
    if (!pos1 || !pos2) return false;
    return pos1.q === pos2.q && pos1.r === pos2.r;
  };

  // Get 3 hexes in a triangle for bombardier splash attack based on rotation (0-5)
  // Triangle has center hex + one hex pointing in rotation direction + one adjacent to the point
  const getBombardierSplashHexes = (centerHex, rotation) => {
    // Hex direction vectors (same as in hexUtils getNeighbors)
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

    // Return center + point in rotation direction + left adjacent to the point
    return [
      centerHex, // Center
      new HexCoord(centerHex.q + dir.q, centerHex.r + dir.r), // Point
      new HexCoord(centerHex.q + leftDir.q, centerHex.r + leftDir.r) // Left adjacent
    ];
  };

  // Center camera on queen
  const centerOnQueen = () => {
    const currentPlayerId = gameMode?.isMultiplayer ? gameMode.playerRole : gameState.currentPlayer;
    const queen = Object.values(gameState.ants).find(
      ant => ant.type === 'queen' && ant.owner === currentPlayerId
    );

    if (queen) {
      const queenPixel = hexToPixel(queen.position, hexSize);
      // Position queen in bottom third of viewport (offset by 150 pixels upward)
      // This way the queen is visible at the bottom third instead of dead center
      setCameraOffset({
        x: -queenPixel.x,
        y: -queenPixel.y + 150
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

      // Check if it's my turn
      const myTurn = !gameMode || !gameMode.isMultiplayer || gameState.currentPlayer === gameMode.playerRole;

      console.log('Key pressed:', e.key, 'selectedAnt:', selectedAnt, 'myTurn:', myTurn);

      // Ignore repeated keydown events from holding keys (except for camera panning)
      if (e.repeat && !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'].includes(e.key)) {
        return;
      }

      // Action hotkeys when an ant is selected
      if (selectedAnt && myTurn) {
        const ant = gameState.ants[selectedAnt];
        console.log('Ant selected, checking action hotkey. Key:', e.key.toLowerCase(), 'Ant type:', ant?.type);

        switch(e.key.toLowerCase()) {
          case 'a':
            console.log('Attack hotkey triggered');
            e.preventDefault();
            // Attack action (only for units with attack > 0)
            if (ant) {
              const antType = AntTypes[ant.type.toUpperCase()];
              if (antType.attack > 0) {
                const currentPlayerId = gameMode?.isMultiplayer ? gameMode.playerRole : gameState.currentPlayer;
                const enemiesInRange = Object.values(gameState.ants).filter(enemy => {
                  if (enemy.owner === currentPlayerId) return false;
                  return canAttack(ant, enemy, gameState);
                });

                if (enemiesInRange.length > 0) {
                  setSelectedAction('attack');
                  return;
                }
              }
            }
            return;
          case 'b':
            console.log('Build hotkey triggered');
            e.preventDefault();
            // Build action (for drones)
            if (ant && ant.type === 'drone') {
              const antType = AntTypes[ant.type.toUpperCase()];
              if (antType.canBuildAnthill) {
                handleBuildAnthillAction();
                return;
              }
            }
            return;
          case 'm':
            console.log('Move hotkey triggered');
            e.preventDefault();
            // Move action
            if (ant && !ant.hasMoved) {
              setSelectedAction('move');
              return;
            }
            return;
          case 'h':
            console.log('Heal hotkey triggered');
            e.preventDefault();
            // Heal action (for queens and healers)
            if (ant && (ant.type === 'queen' || ant.type === 'healer')) {
              setSelectedAction('heal');
              return;
            }
            return;
          case 'e':
            console.log('Ensnare hotkey triggered');
            e.preventDefault();
            // Ensnare action (for healers only)
            if (ant && ant.type === 'healer') {
              setSelectedAction('ensnare');
              return;
            }
            return;
          case 'p':
            console.log('Plague hotkey triggered');
            e.preventDefault();
            // Plague action (for cordyphage only)
            if (ant && ant.type === 'cordyphage') {
              setSelectedAction('plague');
              return;
            }
            return;
          case 'q':
            console.log('Lay egg hotkey triggered');
            e.preventDefault();
            // Lay egg action - auto-select queen if not selected
            if (ant && ant.type === 'queen') {
              setSelectedAction('layEgg');
              return;
            }
            // If no ant selected or wrong ant type, find and select the queen
            if (!ant || ant.type !== 'queen') {
              const currentState = getGameStateForLogic();
              const queen = Object.values(currentState.ants).find(
                a => a.type === 'queen' && a.owner === currentState.currentPlayer && !a.isDead
              );
              if (queen) {
                setSelectedAnt(queen.id);
                setSelectedAction('layEgg');
                centerOnQueen();
                return;
              }
            }
            return;
          case 'd':
            // If ant type selector is showing, directly hatch drone
            if (showAntTypeSelector && selectedEggHex) {
              console.log('Drone hotkey - hatching drone');
              e.preventDefault();
              handleLayEgg('drone');
              return;
            }
            // If in layEgg mode, select drone as pending egg type
            if (selectedAction === 'layEgg') {
              console.log('Drone egg type selected');
              e.preventDefault();
              setPendingEggType('drone');
              return;
            }
            // Otherwise, detonate action (for bombers only)
            if (ant && ant.type === 'bomber') {
              console.log('Detonate hotkey triggered');
              e.preventDefault();
              setSelectedAction('detonate');
              return;
            }
            return;
          case 's':
            // Don't allow camera panning when ant type selector is showing
            if (showAntTypeSelector && selectedEggHex) {
              console.log('Scout hotkey - hatching scout');
              e.preventDefault();
              handleLayEgg('scout');
              return;
            }
            // If in layEgg mode, select scout as pending egg type
            if (selectedAction === 'layEgg') {
              console.log('Scout egg type selected');
              e.preventDefault();
              setPendingEggType('scout');
              return;
            }
            return;
          case 'o':
            // Soldier (marauder) - changed from 'm' to avoid conflict with move
            if (showAntTypeSelector && selectedEggHex) {
              console.log('Soldier hotkey - hatching soldier');
              e.preventDefault();
              handleLayEgg('soldier');
              return;
            }
            if (selectedAction === 'layEgg') {
              console.log('Soldier egg type selected');
              e.preventDefault();
              setPendingEggType('soldier');
              return;
            }
            return;
          case 't':
            // Tank (bullet ant) - changed from 'b' to avoid conflict with build
            if (showAntTypeSelector && selectedEggHex) {
              console.log('Tank hotkey - hatching tank');
              e.preventDefault();
              handleLayEgg('tank');
              return;
            }
            if (selectedAction === 'layEgg') {
              console.log('Tank egg type selected');
              e.preventDefault();
              setPendingEggType('tank');
              return;
            }
            return;
          case 'i':
            // Spitter (acid ant) - changed from 'a' to avoid conflict with attack
            if (showAntTypeSelector && selectedEggHex) {
              console.log('Spitter hotkey - hatching spitter');
              e.preventDefault();
              handleLayEgg('spitter');
              return;
            }
            if (selectedAction === 'layEgg') {
              console.log('Spitter egg type selected');
              e.preventDefault();
              setPendingEggType('spitter');
              return;
            }
            return;
          case 'x':
            // Bomber (exploding ant)
            if (showAntTypeSelector && selectedEggHex) {
              console.log('Bomber hotkey - hatching bomber');
              e.preventDefault();
              handleLayEgg('bomber');
              return;
            }
            if (selectedAction === 'layEgg') {
              console.log('Bomber egg type selected');
              e.preventDefault();
              setPendingEggType('bomber');
              return;
            }
            return;
          case 'r':
            // Bombardier
            if (showAntTypeSelector && selectedEggHex) {
              console.log('Bombardier hotkey - hatching bombardier');
              e.preventDefault();
              handleLayEgg('bombardier');
              return;
            }
            if (selectedAction === 'layEgg') {
              console.log('Bombardier egg type selected');
              e.preventDefault();
              setPendingEggType('bombardier');
              return;
            }
            return;
          case 'w':
            // Healer (weaver ant) - conflicts with camera up, but ant selector takes priority
            if (showAntTypeSelector && selectedEggHex) {
              console.log('Healer hotkey - hatching healer');
              e.preventDefault();
              handleLayEgg('healer');
              return;
            }
            if (selectedAction === 'layEgg') {
              console.log('Healer egg type selected');
              e.preventDefault();
              setPendingEggType('healer');
              return;
            }
            return;
          case 'c':
            // Cordyphage
            if (showAntTypeSelector && selectedEggHex) {
              console.log('Cordyphage hotkey - hatching cordyphage');
              e.preventDefault();
              handleLayEgg('cordyphage');
              return;
            }
            if (selectedAction === 'layEgg') {
              console.log('Cordyphage egg type selected');
              e.preventDefault();
              setPendingEggType('cordyphage');
              return;
            }
            return;
          case 'escape':
            console.log('Escape hotkey triggered');
            e.preventDefault();
            // Deselect ant and clear egg laying mode
            setSelectedAnt(null);
            setSelectedAction(null);
            setPendingEggType(null);
            return;
          default:
            break;
        }
      }

      // Global hotkeys
      switch(e.key) {
        case 'Tab':
          if (myTurn) {
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
          setCameraOffset(prev => ({ x: prev.x + panSpeed, y: prev.y }));
          e.preventDefault();
          break;
        case 'ArrowRight':
          setCameraOffset(prev => ({ x: prev.x - panSpeed, y: prev.y }));
          e.preventDefault();
          break;
        case 'a':
        case 'A':
          // Only pan with 'a' if no ant is selected
          if (!selectedAnt) {
            setCameraOffset(prev => ({ x: prev.x + panSpeed, y: prev.y }));
            e.preventDefault();
          }
          break;
        case 'd':
        case 'D':
          // Only pan with 'd' if no ant is selected
          if (!selectedAnt) {
            setCameraOffset(prev => ({ x: prev.x - panSpeed, y: prev.y }));
            e.preventDefault();
          }
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
  }, [gameState, gameMode, selectedAnt, selectedAction, attackTarget, attackPositions]);

  // Center camera on queen when game starts
  useEffect(() => {
    // Only center if we have a valid game mode (not null, 'lobby', 'localSetup', or 'aiSetup')
    if (gameMode && typeof gameMode === 'object' && gameState.ants) {
      // Small delay to ensure game state is fully loaded
      const timer = setTimeout(() => {
        centerOnQueen();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [gameMode?.isMultiplayer, gameMode?.isAI]); // Only run when gameMode changes to a game object

  // Calculate movement paths when selectedAnt or selectedAction changes
  useEffect(() => {
    if (!selectedAnt || !gameState.ants[selectedAnt] || selectedAction !== 'move') {
      setMovementPaths(new Map());
      return;
    }

    const ant = gameState.ants[selectedAnt];
    const antType = AntTypes[ant.type.toUpperCase()];

    // Don't show paths if ant has already moved
    if (ant.hasMoved) {
      setMovementPaths(new Map());
      return;
    }

    // Queens cannot move
    if (ant.type === 'queen') {
      setMovementPaths(new Map());
      return;
    }

    // Get blocked hexes (enemy ants block pathfinding, friendly ants and eggs can be pathed through but not ended on)
    const enemyAntHexes = Object.values(gameState.ants)
      .filter(a => a.id !== ant.id && a.owner !== ant.owner) // Enemy ants only
      .map(a => new HexCoord(a.position.q, a.position.r));

    const friendlyAntHexes = Object.values(gameState.ants)
      .filter(a => a.id !== ant.id && a.owner === ant.owner) // Friendly ants (not self)
      .map(a => new HexCoord(a.position.q, a.position.r));

    const eggHexes = Object.values(gameState.eggs || {})
      .map(e => new HexCoord(e.position.q, e.position.r));

    const blockedHexes = enemyAntHexes; // Cannot path through enemies
    const cannotEndHexes = [...friendlyAntHexes, ...eggHexes]; // Can path through but cannot end on

    let range = antType.moveRange;

    // Apply Gorlak's hero ability: +1 move for melee units
    const currentPlayer = gameState.players[ant.owner];
    if (currentPlayer?.heroAbilityActive && currentPlayer?.heroId === 'gorlak' && antType.attackRange <= 1) {
      range += 1;
    }

    // Burrowed units have limited movement
    if (ant.isBurrowed) {
      // Only soldiers can move while burrowed (1 hex)
      if (ant.type === 'soldier') {
        range = 1;
      } else {
        // Other burrowed units cannot move
        setMovementPaths(new Map());
        return;
      }
    }

    // Ensnared units cannot move at all
    if (ant.ensnared && ant.ensnared > 0) {
      range = 0;
    }

    // Get movement range with paths
    const movesWithPaths = getMovementRangeWithPaths(ant.position, range, gridRadius, blockedHexes, cannotEndHexes);

    // Store paths in map
    const pathsMap = new Map();
    movesWithPaths.forEach(({hex, path}) => {
      pathsMap.set(hex.toString(), path);
    });
    setMovementPaths(pathsMap);
  }, [selectedAnt, selectedAction, gameState, gridRadius]);

  // Clear waypoint when ant or action changes
  useEffect(() => {
    setPathWaypoint(null);
  }, [selectedAnt, selectedAction]);

  // Handle movement animation
  useEffect(() => {
    if (!movingAnt) return;

    const { antId, path, currentStep } = movingAnt;

    // If we've reached the end of the path, stop
    if (currentStep >= path.length - 1) {
      setMovingAnt(null);
      return;
    }

    // Move to next step after a delay
    const timer = setTimeout(() => {
      const nextStep = currentStep + 1;
      const nextPosition = path[nextStep];

      // Track if ant exists in either state
      let foundInGameState = false;
      let foundInFullState = false;

      // Update game state with new position
      setGameState(prev => {
        if (!prev.ants?.[antId]) return prev;
        foundInGameState = true;
        return {
          ...prev,
          ants: {
            ...prev.ants,
            [antId]: {
              ...prev.ants[antId],
              position: nextPosition
            }
          }
        };
      });

      // Also update fullGameState for AI/multiplayer games
      setFullGameState(prev => {
        if (!prev?.ants?.[antId]) return prev;
        foundInFullState = true;
        return {
          ...prev,
          ants: {
            ...prev.ants,
            [antId]: {
              ...prev.ants[antId],
              position: nextPosition
            }
          }
        };
      });

      // Continue animation - the setState callbacks set foundIn* synchronously during the updater call
      // Even if async, we should continue as the next iteration will check again
      setMovingAnt(prev => {
        // Double-check we're still animating the same ant
        if (!prev || prev.antId !== antId) return null;
        return {
          antId,
          path,
          currentStep: nextStep
        };
      });
    }, 150); // 150ms between each step (faster, smoother animation)

    return () => clearTimeout(timer);
  }, [movingAnt]);

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
  // attackerInfo can be passed for multiplayer where gameState may be stale
  const showAttackAnimation = (attackerId, targetPosition, isRanged, attackerInfo = null) => {
    const id = `attack_${Date.now()}_${Math.random()}`;
    const newAnimation = {
      id,
      attackerId,
      targetPos: targetPosition,
      timestamp: Date.now(),
      isRanged
    };
    setAttackAnimations(prev => [...prev, newAnimation]);

    // Trigger attack sprite animation
    // Use passed attackerInfo for multiplayer, or look up from current state
    const attacker = attackerInfo || gameState.ants[attackerId] || fullGameState?.ants?.[attackerId];
    if (attacker) {
      const playerColor = gameState.players?.[attacker.owner]?.color || fullGameState?.players?.[attacker.owner]?.color;
      setAntAnimation(attackerId, attacker.type, 'attack', playerColor);
      // Return to idle after attack animation
      setTimeout(() => {
        setAntAnimation(attackerId, attacker.type, 'idle', playerColor);
      }, isRanged ? 200 : 300);
    }

    // If ranged, spawn projectile after shake animation (0.2s)
    if (isRanged && attacker) {
      const projectileId = `projectile_${Date.now()}_${Math.random()}`;
      setTimeout(() => {
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
          const { attackerId, targetPosition, isRanged, damageDealt, timestamp } = newState.lastCombatAction;

          // Only show animation if this is a new combat action (timestamp changed)
          if (timestamp && timestamp !== lastCombatActionTimestamp.current) {
            lastCombatActionTimestamp.current = timestamp;

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
                // Pass attacker info from new state since our local state may be stale
                showAttackAnimation(attackerId, targetPosition, isRanged, attacker);
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

        // Apply fog of war for multiplayer games or AI games with fog of war enabled
        const shouldApplyFog = gameMode.isMultiplayer || (gameMode.isAI && gameMode.fogOfWar !== false);
        const filteredState = shouldApplyFog ? applyFogOfWar(newState, gameMode.playerRole || 'player1') : newState;
        setGameState(filteredState);
      });

      return () => unsubscribe();
    }
  }, [gameMode]);

  // Automatically execute AI turn when it's the AI's turn
  useEffect(() => {
    const executeAITurnAutomatically = async () => {
      if (!gameMode?.isAI || isAIThinking || pendingCombat) return;

      const currentState = getGameStateForLogic();
      if (!currentState || currentState.currentPlayer !== 'player2') return;

      console.log('AI turn detected - automatically executing AI turn');
      setIsAIThinking(true);

      try {
        // Small delay so player can see turn changed
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Execute AI turn
        const aiState = await executeAITurn(currentState, 'player2', gameMode.aiDifficulty);

        // Detect movements by comparing states
        const movements = [];
        Object.keys(aiState.ants || {}).forEach(antId => {
          const oldAnt = currentState.ants?.[antId];
          const newAnt = aiState.ants[antId];

          if (oldAnt && newAnt && !hexEquals(oldAnt.position, newAnt.position)) {
            // Ant moved - calculate path
            const enemyHexes = Object.values(aiState.ants)
              .filter(a => a && a.position && a.id !== newAnt.id && a.owner !== newAnt.owner)
              .map(a => new HexCoord(a.position.q, a.position.r));

            const friendlyHexes = Object.values(aiState.ants)
              .filter(a => a && a.position && a.id !== newAnt.id && a.owner === newAnt.owner)
              .map(a => new HexCoord(a.position.q, a.position.r));

            const eggHexes = Object.values(aiState.eggs || {})
              .filter(e => e && e.position)
              .map(e => new HexCoord(e.position.q, e.position.r));

            const antType = AntTypes[newAnt.type.toUpperCase()];
            const pathsWithRange = getMovementRangeWithPaths(
              oldAnt.position,
              antType.moveRange,
              gridRadius,
              enemyHexes,
              [...friendlyHexes, ...eggHexes]
            );

            const pathData = pathsWithRange.find(({hex}) => hexEquals(hex, newAnt.position));
            if (pathData) {
              movements.push({
                antId,
                path: pathData.path
              });
            }
          }
        });

        // Animate movements sequentially
        for (const movement of movements) {
          // Add starting position to path if not already there
          const oldAnt = currentState.ants?.[movement.antId];
          const fullPath = oldAnt ? [oldAnt.position, ...movement.path] : movement.path;

          await new Promise(resolve => {
            setMovingAnt({
              antId: movement.antId,
              path: fullPath,
              currentStep: 0
            });

            // Wait for animation to complete (150ms per step)
            const animationDuration = (fullPath.length - 1) * 150;
            setTimeout(resolve, animationDuration + 100);
          });
        }

        // End AI turn to switch back to player
        const { gameState: finalState } = endTurn(aiState);
        updateGame(finalState);
      } finally {
        setIsAIThinking(false);
      }
    };

    executeAITurnAutomatically();
  }, [gameState.currentPlayer, gameState.turn, gameMode?.isAI, isAIThinking, pendingCombat]);

  // Clean up dead ants after 2 seconds
  useEffect(() => {
    const now = Date.now();
    const deadAntsToRemove = [];

    // Use fullGameState for AI games with fog of war to ensure we clean up all dead ants
    const stateToCheck = (gameMode?.isAI && gameMode.fogOfWar !== false) ? fullGameState : gameState;

    Object.values(stateToCheck.deadAnts || {}).forEach(deadAnt => {
      if (now - deadAnt.createdAt >= 2000) {
        deadAntsToRemove.push(deadAnt.id);
      }
    });

    if (deadAntsToRemove.length > 0) {
      const timer = setTimeout(() => {
        const currentState = getGameStateForLogic();
        const updatedDeadAnts = { ...currentState.deadAnts };
        deadAntsToRemove.forEach(id => {
          delete updatedDeadAnts[id];
        });
        updateGame({
          ...currentState,
          deadAnts: updatedDeadAnts
        });
      }, 100); // Small delay to ensure we don't update too frequently

      return () => clearTimeout(timer);
    }
  }, [gameMode?.isAI, gameMode?.fogOfWar, fullGameState?.deadAnts, gameState.deadAnts]);

  // Get the game state to use for game logic (full state for multiplayer/AI with fog, filtered for display)
  const getGameStateForLogic = () => {
    if (gameMode?.isMultiplayer || (gameMode?.isAI && gameMode.fogOfWar !== false)) {
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
      // For local games and AI games
      if (gameMode?.isAI) {
        // Always update fullGameState for AI games
        setFullGameState(newState);

        if (gameMode.fogOfWar !== false) {
          // Apply fog of war filtering for display
          const filteredState = applyFogOfWar(newState, 'player1');
          setGameState(filteredState);
        } else {
          // No fog of war, display full state
          setGameState(newState);
        }
      } else {
        // For local games without AI, just update the state directly
        setGameState(newState);
      }
    }
  };

  // Check if it's current player's turn
  const isMyTurn = () => {
    if (!gameMode) return false;
    // In AI mode, only allow input on player1's turn and not while AI is thinking
    if (gameMode.isAI) {
      return gameState.currentPlayer === 'player1' && !isAIThinking;
    }
    if (!gameMode.isMultiplayer) return true; // Local game = always your turn
    return gameState.currentPlayer === gameMode.playerRole;
  };

  // Handle start game from menu
  const handleEnterLobby = (settings) => {
    // Settings include: gameId, playerId, playerRole, isMultiplayer
    setLobbySettings(settings);
    setGameMode('lobby');
  };

  const handleEnterLocalSetup = () => {
    setGameMode('localSetup');
  };

  const handleEnterAISetup = () => {
    setGameMode('aiSetup');
  };

  const handleStartGame = (mode) => {
    // Mode includes lobby settings: mapSize, player1Color, player2Color, etc.
    const gameOptions = {};
    if (mode.mapSize) {
      gameOptions.mapSize = mode.mapSize;
    }
    if (mode.player1Color) {
      gameOptions.player1Color = mode.player1Color;
    }
    if (mode.player2Color) {
      gameOptions.player2Color = mode.player2Color;
    }
    if (mode.player1Hero) {
      gameOptions.player1Hero = mode.player1Hero;
    }
    if (mode.player2Hero) {
      gameOptions.player2Hero = mode.player2Hero;
    }

    const newGameState = createInitialGameState(gameOptions);

    // For AI games, always set fullGameState for AI logic
    console.log('Starting AI game - fogOfWar setting:', mode.fogOfWar, 'Will apply fog?', mode.isAI && mode.fogOfWar !== false);
    if (mode.isAI) {
      setFullGameState(newGameState);

      if (mode.fogOfWar !== false) {
        console.log('Applying fog of war - filtering state for player1');
        const filteredState = applyFogOfWar(newGameState, 'player1');
        setGameState(filteredState);
      } else {
        console.log('NOT applying fog of war - using full state for display');
        setGameState(newGameState);
      }
    } else {
      setGameState(newGameState);
    }

    // Set game mode with full settings
    setGameMode({
      ...mode,
      gameId: mode.gameId || lobbySettings?.gameId,
      playerId: mode.playerId || lobbySettings?.playerId,
      playerRole: mode.playerRole || lobbySettings?.playerRole,
      isMultiplayer: mode.isMultiplayer !== undefined ? mode.isMultiplayer : lobbySettings?.isMultiplayer
    });
  };

  const handleBackToMenu = () => {
    setGameMode(null);
    setLobbySettings(null);
    setGameState(createInitialGameState());
  };

  // Handle end turn with AI support
  const handleEndTurn = async () => {
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

    // AI turn will be handled automatically by useEffect
  };

  // Show menu if game hasn't started
  if (!gameMode) {
    return <MultiplayerMenu onStartGame={handleStartGame} onEnterLobby={handleEnterLobby} onEnterLocalSetup={handleEnterLocalSetup} onEnterAISetup={handleEnterAISetup} />;
  }

  // Show lobby if in lobby mode
  if (gameMode === 'lobby' && lobbySettings) {
    return (
      <GameLobby
        roomCode={lobbySettings.gameId}
        playerId={lobbySettings.playerId}
        playerRole={lobbySettings.playerRole}
        onStartGame={handleStartGame}
        onBack={handleBackToMenu}
      />
    );
  }

  // Show local game setup if in local setup mode
  if (gameMode === 'localSetup') {
    return (
      <LocalGameSetup
        onStartGame={handleStartGame}
        onBack={handleBackToMenu}
      />
    );
  }

  // Show AI game setup if in AI setup mode
  if (gameMode === 'aiSetup') {
    return (
      <AIGameSetup
        onStartGame={handleStartGame}
        onBack={handleBackToMenu}
      />
    );
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

    const detonationResult = detonateBomber(currentState, selectedAnt);

    // Show damage numbers for all affected targets
    if (detonationResult.damageDealt) {
      detonationResult.damageDealt.forEach(({ damage, position }) => {
        showDamageNumber(damage, position);
      });
    }

    updateGame(detonationResult.gameState);
    setSelectedAction(null);
    setSelectedAnt(null);
  };

  // Get enemies in attack range for selected ant
  const getEnemiesInRange = () => {
    if (!selectedAnt) return [];
    const currentState = getGameStateForLogic();
    const ant = currentState.ants[selectedAnt];
    if (!ant) return [];

    // Burrowed units cannot attack except soldiers/marauders
    if (ant.isBurrowed && ant.type !== 'soldier') return [];

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

  // Handle build anthill for selected drone
  const handleBuildAnthillAction = () => {
    if (!selectedAnt) return;

    const currentState = getGameStateForLogic();
    const drone = currentState.ants[selectedAnt];

    if (!drone) return;

    // Only drones can build anthills
    if (drone.type !== 'drone') {
      alert('Only drones can build anthills!');
      return;
    }

    // Find the resource at the drone's current position
    const resourceAtDrone = Object.values(currentState.resources).find(
      r => hexEquals(r.position, drone.position)
    );

    if (!resourceAtDrone) {
      alert('You must move your drone onto a resource node to build an anthill!');
      return;
    }

    // Check if there's already a completed anthill at the resource location
    const existingAnthill = Object.values(currentState.anthills || {}).find(
      a => hexEquals(a.position, resourceAtDrone.position)
    );

    // Get resource hex label for better user feedback
    const resourceLabel = String.fromCharCode(65 + resourceAtDrone.position.q + 6) + (resourceAtDrone.position.r + 7);

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
    const newState = buildAnthill(currentState, selectedAnt, resourceAtDrone.id);
    updateGame(newState);
    setSelectedAction(null);
  };

  // Handle hex click
  const handleHexClick = (hex) => {
    const currentState = getGameStateForLogic();

    // Allow viewing ant info even when not your turn
    // But check turn for actual actions
    const performingAction = selectedAction && selectedAction !== null;

    if (performingAction && !isMyTurn()) {
      alert("It's not your turn!");
      return;
    }

    // If detonating a bomber (click anywhere to confirm)
    if (selectedAction === 'detonate' && selectedAnt) {
      handleDetonate();
      return;
    }

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

          // Mark combat as pending to prevent turn ending during animation
          setPendingCombat(true);

          // Delay damage and state update to match animation timing
          setTimeout(() => {
            const combatResult = resolveCombat(currentState, selectedAnt, enemyAtHex.id);
            const newState = combatResult.gameState;

            // Show damage numbers
            combatResult.damageDealt.forEach(({ damage, position }) => {
              showDamageNumber(damage, position);
            });

            // Mark ant as having attacked and store combat action for multiplayer
            // Only update the attacker if it still exists after combat
            const updatedAnts = { ...newState.ants };
            if (updatedAnts[selectedAnt]) {
              updatedAnts[selectedAnt] = {
                ...updatedAnts[selectedAnt],
                hasAttacked: true
              };
            }

            const markedState = {
              ...newState,
              ants: updatedAnts,
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

            // Clear pending combat flag
            setPendingCombat(false);
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
      const healer = currentState.ants[selectedAnt];

      // Check if it's a queen or healer
      if (healer.type !== 'queen' && healer.type !== 'healer') {
        alert('Only queens and healers can heal!');
        setSelectedAction(null);
        return;
      }

      // Check if unit has already attacked (healing is a terminal action)
      if (healer.hasAttacked) {
        alert('This unit has already used a terminal action this turn!');
        return;
      }

      // Get the appropriate heal energy cost
      const healEnergyCost = healer.type === 'healer'
        ? AntTypes.HEALER.healEnergyCost
        : GameConstants.HEAL_ENERGY_COST;

      // Check energy
      if (!hasEnoughEnergy(healer, healEnergyCost)) {
        alert(`Not enough energy! Need ${healEnergyCost} energy to heal.`);
        return;
      }

      // Find if there's a friendly unit at the clicked hex
      const friendlyAtHex = Object.values(currentState.ants).find(
        a => hexEquals(a.position, hex) && a.owner === healer.owner
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

      // Check if within heal range
      const antType = AntTypes[healer.type.toUpperCase()];
      const healRange = healer.type === 'healer' ? antType.healRange : antType.attackRange;
      const distance = Math.max(
        Math.abs(healer.position.q - friendlyAtHex.position.q),
        Math.abs(healer.position.r - friendlyAtHex.position.r),
        Math.abs((-healer.position.q - healer.position.r) - (-friendlyAtHex.position.q - friendlyAtHex.position.r))
      );

      if (distance > healRange) {
        alert('Target is out of heal range!');
        return;
      }

      // Perform heal
      const newState = healAnt(currentState, selectedAnt, friendlyAtHex.id);

      // Show heal animation (green +HP number)
      const healAmount = healer.type === 'healer'
        ? Math.min(AntTypes.HEALER.healAmount, friendlyAtHex.maxHealth - friendlyAtHex.health)
        : Math.min(GameConstants.HEAL_AMOUNT, friendlyAtHex.maxHealth - friendlyAtHex.health);
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

      // If we have a pending egg type from Q+key hotkey, lay the egg
      if (pendingEggType) {
        handleLayEgg(pendingEggType, hex);
        setPendingEggType(null); // Clear pending egg type
        return;
      }

      // Otherwise, show ant type selector
      setSelectedEggHex(hex);
      setShowAntTypeSelector(true);
      return;
    }

    // If moving ant
    if (selectedAction === 'move' && selectedAnt) {
      const ant = currentState.ants[selectedAnt];

      // Check if clicked on a friendly ant - if so, select that ant instead of moving
      const friendlyAtHex = Object.values(currentState.ants).find(
        a => hexEquals(a.position, hex) && a.owner === ant.owner && a.id !== ant.id
      );
      if (friendlyAtHex) {
        // Clicking on friendly ant - select it instead
        setSelectedAnt(friendlyAtHex.id);
        setSelectedAction(null);
        setSelectedEgg(null);
        setSelectedAnthill(null);
        return;
      }

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
        // Validate the path is clear (no ants blocking the way)
        const hexKey = hex.toString();
        let path = movementPaths.get(hexKey);

        // If there's a waypoint, use the combined path through the waypoint
        if (pathWaypoint && !hexEquals(pathWaypoint, hex)) {
          const waypointKey = pathWaypoint.toString();
          const pathToWaypoint = movementPaths.get(waypointKey);

          if (pathToWaypoint) {
            const costToWaypoint = pathToWaypoint.length - 1;
            const remainingRange = antType.movement - costToWaypoint;

            if (remainingRange > 0) {
              // Get blocked hexes (enemies)
              const enemyHexes = Object.values(currentState.ants)
                .filter(a => a.id !== ant.id && a.owner !== ant.owner)
                .map(a => new HexCoord(a.position.q, a.position.r));

              // Get friendly hexes and eggs (can path through but not end on)
              const friendlyHexes = Object.values(currentState.ants)
                .filter(a => a.id !== ant.id && a.owner === ant.owner)
                .map(a => new HexCoord(a.position.q, a.position.r));

              const eggHexes = Object.values(currentState.eggs || {})
                .map(e => new HexCoord(e.position.q, e.position.r));

              // Calculate path from waypoint to destination
              const pathsFromWaypoint = getMovementRangeWithPaths(
                pathWaypoint,
                remainingRange,
                gridRadius,
                enemyHexes,
                [...friendlyHexes, ...eggHexes]
              );

              const pathFromWaypointToHex = pathsFromWaypoint.find(
                ({hex: destHex}) => hexEquals(destHex, hex)
              );

              if (pathFromWaypointToHex) {
                // Combine paths: remove duplicate waypoint hex
                path = [...pathToWaypoint, ...pathFromWaypointToHex.path.slice(1)];
              }
            }
          }
        }

        if (!path || path.length === 0) {
          alert('No valid path to that destination!');
          return;
        }

        // Check each hex in the path to ensure it's not occupied by enemies
        for (let i = 0; i < path.length; i++) {
          const pathHex = path[i];

          // Check if there's an ENEMY ant at this position in the path
          const enemyAtPathHex = Object.values(currentState.ants).find(
            a => hexEquals(a.position, pathHex) && a.owner !== ant.owner
          );

          if (enemyAtPathHex) {
            alert('Path is blocked by an enemy ant!');
            return;
          }

          // Check if there's an enemy egg at this position in the path
          const enemyEggAtPathHex = Object.values(currentState.eggs).find(
            e => hexEquals(e.position, pathHex) && e.owner !== ant.owner
          );
          if (enemyEggAtPathHex) {
            alert('Path is blocked by an enemy egg!');
            return;
          }
        }

        // All checks passed, start the movement animation
        // Start animation from step 0 (current position)
        setMovingAnt({
          antId: selectedAnt,
          path: path,
          currentStep: 0
        });

        // Trigger walk sprite animation
        const playerColor = gameState.players[ant.owner]?.color;
        setAntAnimation(selectedAnt, ant.type, 'walk', playerColor);

        // After animation completes, mark ant as moved and update final state
        // Calculate total animation time (150ms per step)
        const animationDuration = (path.length - 1) * 150;
        setTimeout(() => {
          const newState = moveAnt(currentState, selectedAnt, hex);
          const finalState = markAntMoved(newState, selectedAnt);
          updateGame(finalState);

          // Return to idle animation
          setAntAnimation(selectedAnt, ant.type, 'idle', playerColor);

          // Keep ant selected if it can still perform actions
          if (canAntStillAct(selectedAnt, finalState)) {
            setSelectedAction(null); // Clear the move action
            // selectedAnt stays selected
          } else {
            setSelectedAction(null);
            setSelectedAnt(null);
          }
        }, animationDuration);
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

    // Cordyceps Purge (Mind Control) - Cordyphage ability
    if (selectedAction === 'cordyceps' && selectedAnt) {
      const cordyphage = currentState.ants[selectedAnt];
      if (!cordyphage || cordyphage.type !== 'cordyphage') return;

      // Find if there's an enemy at the clicked hex
      const enemyAtHex = Object.values(currentState.ants).find(
        a => hexEquals(a.position, hex) && a.owner !== cordyphage.owner
      );

      if (enemyAtHex) {
        if (enemyAtHex.type === 'queen') {
          alert('Cannot mind control queens!');
          return;
        }
        const newState = cordycepsPurge(currentState, selectedAnt, enemyAtHex.id);
        updateGame(newState);
        setSelectedAction(null);
        setSelectedAnt(null);
      } else {
        alert('Invalid Cordyceps target! Must click on an enemy unit (not queen).');
      }
      return;
    }

    // Plague - Cordyphage ability
    if (selectedAction === 'plague' && selectedAnt) {
      const cordyphage = currentState.ants[selectedAnt];
      if (!cordyphage || cordyphage.type !== 'cordyphage') return;

      // Find if there's an enemy at the clicked hex
      const enemyAtHex = Object.values(currentState.ants).find(
        a => hexEquals(a.position, hex) && a.owner !== cordyphage.owner
      );

      if (enemyAtHex) {
        const newState = plagueEnemy(currentState, selectedAnt, enemyAtHex.id);
        if (newState === currentState) {
          alert('Cannot plague this target! Already plagued or out of energy.');
          return;
        }
        updateGame(newState);
        setSelectedAction(null);
        setSelectedAnt(null);
      } else {
        alert('Invalid plague target! Must click on an enemy unit.');
      }
      return;
    }

    // Reveal ability (Queen only)
    if (selectedAction === 'reveal' && selectedAnt) {
      const queen = currentState.ants[selectedAnt];
      if (!queen || queen.type !== 'queen') return;

      // Reveal the area
      const newState = revealArea(currentState, selectedAnt, hex);
      if (newState === currentState) {
        alert('Cannot use Reveal! Check energy and upgrade requirements.');
        return;
      }
      updateGame(newState);
      setSelectedAction(null);
      setSelectedAnt(null);
      return;
    }

    // Bombardier Splash Attack - Two-step process
    if (selectedAction === 'bombardier_splash' && selectedAnt) {
      const bombardier = currentState.ants[selectedAnt];
      if (!bombardier || bombardier.type !== 'bombardier') return;

      const bombardierType = AntTypes.BOMBARDIER;
      const distance = Math.max(
        Math.abs(bombardier.position.q - hex.q),
        Math.abs(bombardier.position.r - hex.r),
        Math.abs((-bombardier.position.q - bombardier.position.r) - (-hex.q - hex.r))
      );

      // Check range
      if (distance < bombardierType.minAttackRange || distance > bombardierType.attackRange) {
        alert('Target is out of range! Must be 2-3 hexes away.');
        return;
      }

      // First click: select target hex and show rotation preview
      if (!bombardierTargetHex || !hexEquals(bombardierTargetHex, hex)) {
        setBombardierTargetHex(hex);
        setBombardierRotation(0); // Reset rotation
        return;
      }

      // Second click on same hex: confirm and execute attack
      if (hexEquals(bombardierTargetHex, hex)) {
        // Get the 3 hexes to hit based on rotation
        const splashHexes = getBombardierSplashHexes(hex, bombardierRotation);

        // Execute splash attack with rotation parameter
        const result = bombardierSplashAttack(currentState, selectedAnt, hex, bombardierRotation);

        // Mark combat as pending to prevent turn ending during animation
        setPendingCombat(true);

        // Delay damage and state update to match animation timing
        setTimeout(() => {
          updateGame({
            ...result.gameState,
            ants: {
              ...result.gameState.ants,
              [selectedAnt]: {
                ...result.gameState.ants[selectedAnt],
                hasAttacked: true
              }
            }
          });

          if (result.damageDealt && result.damageDealt.length > 0) {
            setDamageNumbers(result.damageDealt);
            setTimeout(() => setDamageNumbers([]), 1000);
          }

          // Clear pending combat flag
          setPendingCombat(false);

          setSelectedAction(null);
          setSelectedAnt(null);
          setBombardierTargetHex(null);
          setBombardierRotation(0);
        }, 500);

        return;
      }
    }

    // Check if clicking on an egg
    const clickedEgg = Object.values(currentState.eggs).find(e => hexEquals(e.position, hex));
    if (clickedEgg) {
      setSelectedEgg(clickedEgg);
      setSelectedAnt(null);
      setSelectedAction(null);
      setSelectedAnthill(null);
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

    // Check if a drone is selected and clicked on an adjacent resource node
    if (selectedAnt && !selectedAction) {
      const selectedDrone = currentState.ants[selectedAnt];
      if (selectedDrone && selectedDrone.type === 'drone' && !selectedDrone.hasBuilt) {
        // Check if clicked hex has a resource
        const resourceAtHex = Object.values(currentState.resources).find(r => hexEquals(r.position, hex));

        if (resourceAtHex) {
          // Check if drone is adjacent to the resource
          const distance = Math.max(
            Math.abs(selectedDrone.position.q - hex.q),
            Math.abs(selectedDrone.position.r - hex.r),
            Math.abs((-selectedDrone.position.q - selectedDrone.position.r) - (-hex.q - hex.r))
          );

          if (distance === 1) {
            // Drone is adjacent to resource - automatically trigger build anthill
            setSelectedAction('buildAnthill');
            // Trigger the build in the next frame to ensure state is updated
            setTimeout(() => handleHexClick(hex), 0);
            return;
          }
        }
      }
    }

    // Select ant - allow selecting any ant for viewing info
    const clickedAnt = Object.values(currentState.ants).find(
      a => hexEquals(a.position, hex)
    );

    if (clickedAnt) {
      // If clicking on the already-selected ant, deselect it
      if (selectedAnt === clickedAnt.id) {
        setSelectedAnt(null);
        setSelectedAction(null);
        setSelectedEgg(null);
        return;
      }

      // Only allow actions on your own ants and only when it's your turn
      const isOwnAnt = clickedAnt.owner === currentState.currentPlayer;

      if (isOwnAnt && isMyTurn()) {
        setSelectedAnt(clickedAnt.id);

        // Only auto-select action if the unit can still perform actions
        // Auto-select action based on unit type and available actions:
        // - Queens: lay egg (if hasn't attacked)
        // - Others: move (if hasn't moved or attacked)
        if (clickedAnt.type === 'queen' && !clickedAnt.hasAttacked) {
          setSelectedAction('layEgg');
        } else if (!clickedAnt.hasMoved && !clickedAnt.hasAttacked) {
          setSelectedAction('move');
        } else {
          // Unit has used actions - just select for viewing, no action
          setSelectedAction(null);
        }
      } else {
        // Enemy ant or not your turn - just select for viewing info, no actions
        setSelectedAnt(clickedAnt.id);
        setSelectedAction(null);
      }

      setSelectedEgg(null);
      setSelectedAnthill(null);
      return;
    }

    // Check if clicking on an anthill (only if no ant was clicked)
    const clickedAnthill = Object.values(currentState.anthills).find(a => hexEquals(a.position, hex));
    if (clickedAnthill && clickedAnthill.isComplete) {
      setSelectedAnthill(clickedAnthill);
      setSelectedAnt(null);
      setSelectedAction(null);
      return;
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
    if (!selectedAnt || !gameState.ants[selectedAnt]) {
      return [];
    }
    const ant = gameState.ants[selectedAnt];
    const antType = AntTypes[ant.type.toUpperCase()];

    if (selectedAction === 'move') {
      // Don't show movement range if ant has already moved
      if (ant.hasMoved) {
        return [];
      }

      // Queens cannot move
      if (ant.type === 'queen') {
        return [];
      }

      // Get blocked hexes (only enemy units block movement)
      const blockedHexes = Object.values(gameState.ants)
        .filter(a => a.owner !== ant.owner) // Only block enemies, not friendly units
        .map(a => new HexCoord(a.position.q, a.position.r));

      let range = antType.moveRange;

      // Burrowed units have limited movement
      if (ant.isBurrowed) {
        // Only soldiers can move while burrowed (1 hex)
        if (ant.type === 'soldier') {
          range = 1;
        } else {
          // Other burrowed units cannot move
          return [];
        }
      }

      // Ensnared units cannot move at all
      if (ant.ensnared && ant.ensnared > 0) {
        range = 0;
      }

      // Get movement range (paths are calculated in useEffect)
      const movesWithPaths = getMovementRangeWithPaths(ant.position, range, gridRadius, blockedHexes);
      return movesWithPaths.map(item => item.hex);
    } else if (selectedAction === 'layEgg' && ant.type === 'queen') {
      // Get spawning pool hexes based on queen tier
      const spawningPool = getSpawningPoolHexes(ant, getNeighbors);

      // Filter out occupied hexes
      return spawningPool.filter(hex => {
        const occupied = Object.values(gameState.ants).some(a => hexEquals(a.position, hex)) ||
                        Object.values(gameState.eggs).some(e => hexEquals(e.position, hex));
        return !occupied;
      });
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
    const cordycepsTargets = selectedAction === 'cordyceps' && selectedAnt ?
      getValidCordycepsTargets(getGameStateForLogic(), selectedAnt) : [];

    // Get valid reveal target hexes (any hex on the board)
    const revealTargetHexes = (() => {
      if (selectedAction !== 'reveal' || !selectedAnt) return [];
      const queen = getGameStateForLogic().ants[selectedAnt];
      if (!queen || queen.type !== 'queen') return [];

      // Return all valid hexes on the board
      const allHexes = [];
      for (let q = -gridRadius; q <= gridRadius; q++) {
        for (let r = -gridRadius; r <= gridRadius; r++) {
          const s = -q - r;
          if (Math.abs(q) > gridRadius || Math.abs(r) > gridRadius || Math.abs(s) > gridRadius) continue;

          const hex = new HexCoord(q, r);
          allHexes.push(hex);
        }
      }
      return allHexes;
    })();

    // Get valid bombardier splash hexes
    const bombardierSplashHexes = (() => {
      if (selectedAction !== 'bombardier_splash' || !selectedAnt) return [];
      const bombardier = getGameStateForLogic().ants[selectedAnt];
      if (!bombardier || bombardier.type !== 'bombardier') return [];

      // If a target hex is selected, don't highlight valid hexes anymore
      if (bombardierTargetHex) return [];

      const bombardierType = AntTypes.BOMBARDIER;
      const validHexes = [];

      // Generate all hexes within attack range
      for (let q = -gridRadius; q <= gridRadius; q++) {
        for (let r = -gridRadius; r <= gridRadius; r++) {
          const s = -q - r;
          if (Math.abs(q) > gridRadius || Math.abs(r) > gridRadius || Math.abs(s) > gridRadius) continue;

          const hex = new HexCoord(q, r);
          const distance = Math.max(
            Math.abs(bombardier.position.q - hex.q),
            Math.abs(bombardier.position.r - hex.r),
            Math.abs((-bombardier.position.q - bombardier.position.r) - (-hex.q - hex.r))
          );

          // Check if within valid range (2-3 hexes)
          if (distance >= bombardierType.minAttackRange && distance <= bombardierType.attackRange) {
            validHexes.push(hex);
          }
        }
      }

      return validHexes;
    })();

    // Get the 3 rotated hexes for bombardier splash when target is selected
    const bombardierRotatedHexes = (() => {
      if (selectedAction !== 'bombardier_splash' || !bombardierTargetHex) return [];
      return getBombardierSplashHexes(bombardierTargetHex, bombardierRotation);
    })();

    // Calculate visible hexes for fog of war in multiplayer or AI games
    let visibleHexes = null;
    const stateForFog = fullGameState || gameState;
    if (stateForFog && gameMode) {
      // For multiplayer, use player role
      if (gameMode.isMultiplayer && gameMode.playerRole) {
        visibleHexes = getVisibleHexes(stateForFog, gameMode.playerRole);
      }
      // For AI games with fog of war enabled, show player1's vision
      else if (gameMode.isAI && gameMode.fogOfWar !== false) {
        visibleHexes = getVisibleHexes(stateForFog, 'player1');
      }
    }

    // Define SVG patterns for birthing pools and spider web (only once)
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
        {/* Spider web pattern for ensnared units */}
        <g id="spiderWebPattern">
          {/* Radial threads */}
          <line x1="0" y1="0" x2="0" y2="-30" stroke="#00FF00" strokeWidth="1.5" opacity="0.7" />
          <line x1="0" y1="0" x2="21" y2="-21" stroke="#00FF00" strokeWidth="1.5" opacity="0.7" />
          <line x1="0" y1="0" x2="30" y2="0" stroke="#00FF00" strokeWidth="1.5" opacity="0.7" />
          <line x1="0" y1="0" x2="21" y2="21" stroke="#00FF00" strokeWidth="1.5" opacity="0.7" />
          <line x1="0" y1="0" x2="0" y2="30" stroke="#00FF00" strokeWidth="1.5" opacity="0.7" />
          <line x1="0" y1="0" x2="-21" y2="21" stroke="#00FF00" strokeWidth="1.5" opacity="0.7" />
          <line x1="0" y1="0" x2="-30" y2="0" stroke="#00FF00" strokeWidth="1.5" opacity="0.7" />
          <line x1="0" y1="0" x2="-21" y2="-21" stroke="#00FF00" strokeWidth="1.5" opacity="0.7" />
          {/* Circular threads */}
          <circle cx="0" cy="0" r="10" fill="none" stroke="#00FF00" strokeWidth="1.5" opacity="0.6" />
          <circle cx="0" cy="0" r="20" fill="none" stroke="#00FF00" strokeWidth="1.5" opacity="0.5" />
          <circle cx="0" cy="0" r="30" fill="none" stroke="#00FF00" strokeWidth="1.5" opacity="0.4" />
        </g>
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
        const isCordycepsTarget = cordycepsTargets.some(enemy => hexEquals(enemy.position, hex));
        const isRevealTarget = revealTargetHexes.some(validHex => hexEquals(validHex, hex));
        const isBombardierSplashHex = bombardierSplashHexes.some(validHex => hexEquals(validHex, hex));
        const isBombardierRotatedHex = bombardierRotatedHexes.some(validHex => hexEquals(validHex, hex));
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

        // Get random earthy tone color for this hex
        const hexColorKey = `${q},${r}`;
        let fillColor = hexColors.get(hexColorKey) || '#8B7355'; // Default to light brown if not found
        let useBirthingPoolPattern = false;

        if (isBirthingPool) {
          fillColor = 'url(#birthingPoolGradient)'; // Gradient for birthing pools
          useBirthingPoolPattern = true;
        }
        // Don't color the entire hex for resources anymore - we'll add a colored circle instead
        if (isValidMove) {
          // Different color for fog of war moves vs visible moves
          fillColor = isVisible ? '#AED6F1' : '#8B9DC3'; // Light blue for visible moves, darker blue for fog of war
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
        if (isCordycepsTarget) {
          fillColor = '#8e44ad'; // Purple for mind control targets
          useBirthingPoolPattern = false;
        }
        if (isRevealTarget) {
          fillColor = '#5DADE2'; // Light blue for reveal targets
          useBirthingPoolPattern = false;
        }
        if (isBombardierSplashHex) {
          fillColor = '#ff6b35'; // Orange for bombardier splash zones
          useBirthingPoolPattern = false;
        }
        if (isBombardierRotatedHex) {
          fillColor = '#FF1744'; // Bright red for the 3 hexes that will be hit
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
                setSelectedAnthill(null);
              }}
              onMouseEnter={(e) => {
                if (isValidMove) {
                  setHoveredHex(hex);
                }
              }}
              onMouseLeave={() => {
                if (isValidMove) {
                  setHoveredHex(null);
                }
              }}
              onAuxClick={(e) => {
                // Middle click (button 1) to set/clear waypoint
                if (e.button === 1 && isValidMove && selectedAction === 'move') {
                  e.preventDefault();
                  if (pathWaypoint && hexEquals(pathWaypoint, hex)) {
                    setPathWaypoint(null); // Clear waypoint if clicking same hex
                  } else {
                    setPathWaypoint(hex); // Set new waypoint
                  }
                }
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
            {anthill && (
              <g transform={ant ? "translate(15, -15)" : ""}>
                {/* Anthill icon - mountain for complete, construction for building */}
                <text
                  textAnchor="middle"
                  dy="0.3em"
                  fontSize="24"
                  fontWeight="bold"
                  style={{ pointerEvents: 'none', opacity: anthill.isComplete ? 1 : 0.6 }}
                >
                  {anthill.isComplete ? '⛰️' : '🚧'}
                </text>
                {/* Resource type indicator - small icon at lower right */}
                {anthill.isComplete && (
                  <text
                    x="12"
                    y="10"
                    fontSize="14"
                    fontWeight="bold"
                    style={{ pointerEvents: 'none' }}
                  >
                    {anthill.resourceType === 'food' ? '🍃' : '💎'}
                  </text>
                )}
                {/* Owner indicator - colored circle at upper right */}
                <circle
                  cx="15"
                  cy="-15"
                  r="8"
                  fill={gameState.players[anthill.owner]?.color || '#999'}
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
            {resource && !anthill && isVisible && (
              <g transform={ant ? "translate(15, -15)" : ""}>
                {/* Colored circle background for resource */}
                <circle
                  cx="0"
                  cy="0"
                  r="20"
                  fill={resource.type === 'food' ? '#90EE90' : '#FFD700'}
                  opacity="0.8"
                  style={{ pointerEvents: 'none' }}
                />
                <text
                  textAnchor="middle"
                  dy="0.3em"
                  fontSize="16"
                  fontWeight="bold"
                  style={{ pointerEvents: 'none' }}
                >
                  {resource.type === 'food' ? '🍃' : '💎'}
                </text>
              </g>
            )}
            {ant && ant.type && (() => {
              // Check if this ant is attacking
              const attackAnim = attackAnimations.find(a => a.attackerId === ant.id);
              let transformOffset = '';

              // Check if ant has remaining actions
              const hasActions = hasRemainingActions(ant);

              if (attackAnim) {
                const elapsed = Date.now() - attackAnim.timestamp;
                const antType = AntTypes[ant.type.toUpperCase()];
                const isRanged = antType?.attackRange > 1;

                if (isRanged) {
                  // Ranged: shake animation (0.2s)
                  const shakeProgress = Math.min(elapsed / 200, 1);
                  const shakeX = Math.sin(shakeProgress * Math.PI * 4) * 3 * (1 - shakeProgress);
                  const shakeY = Math.cos(shakeProgress * Math.PI * 4) * 3 * (1 - shakeProgress);
                  transformOffset = `translate(${shakeX}, ${shakeY})`;
                } else {
                  // Melee: lunge animation (0.3s)
                  const lungeProgress = Math.min(elapsed / 300, 1);
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

              // Determine current animation state
              let currentAnimation = 'idle';
              if (attackAnim) {
                currentAnimation = 'attack';
              } else if (movingAnt && movingAnt.antId === ant.id) {
                currentAnimation = 'walk';
              }

              // Get sprite frame info
              const playerColor = gameState.players[ant.owner]?.color;
              const spriteFrame = getAntFrame(ant.id, ant.type, currentAnimation, playerColor);

              // Check if ant is on a resource or anthill
              const onResourceOrAnthill = resource || anthill;
              const baseTransform = onResourceOrAnthill ? "translate(-15, 15)" : "";
              const finalTransform = transformOffset ? `${baseTransform} ${transformOffset}` : baseTransform;

              return (
                <g transform={finalTransform}>
                  {/* Render sprite if available, otherwise fall back to emoji */}
                  {spriteFrame && !ant.isBurrowed ? (
                    <g opacity={hasActions ? 1 : 0.5}>
                      <image
                        x={-40 - (spriteFrame.currentFrame * spriteFrame.frameWidth * 2.5)}
                        y={-40}
                        width={spriteFrame.frameWidth * spriteFrame.frames * 2.5}
                        height={spriteFrame.frameHeight * 2.5}
                        href={spriteFrame.fullPath}
                        clipPath={`url(#clip-${ant.id})`}
                        style={{ pointerEvents: 'none' }}
                        onLoad={() => console.log('Sprite loaded:', spriteFrame.fullPath)}
                        onError={(e) => {
                          console.error('Failed to load sprite:', spriteFrame.fullPath);
                        }}
                      />
                    </g>
                  ) : null}
                  {/* Emoji fallback (shown if burrowed or if sprite doesn't exist) */}
                  {(!spriteFrame || ant.isBurrowed) && (
                    <text
                      textAnchor="middle"
                      dy="0.3em"
                      fontSize="24"
                      fill="white"
                      style={{ pointerEvents: 'none', fontWeight: 'bold', opacity: hasActions ? 1 : 0.5 }}
                    >
                      {ant.isBurrowed ? '🕳️' : AntTypes[ant.type.toUpperCase()].icon}
                    </text>
                  )}
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
                  {/* Ensnare indicator - animated sprite */}
                  {ant.ensnared && ant.ensnared > 0 && (
                    <g>
                      <defs>
                        <clipPath id={`ensnare-clip-${ant.id}`}>
                          <rect x="-16" y="-16" width="32" height="32" />
                        </clipPath>
                      </defs>
                      <image
                        href={`${process.env.PUBLIC_URL}/sprites/ants/ensnare_effect.png`}
                        x={-16 - (effectAnimationFrame * 32)}
                        y="-16"
                        width="256"
                        height="32"
                        clipPath={`url(#ensnare-clip-${ant.id})`}
                        style={{ pointerEvents: 'none' }}
                      />
                      {/* Ensnare duration text */}
                      <text
                        textAnchor="middle"
                        x="-8"
                        y="20"
                        fontSize="10"
                        fill="#00FF00"
                        fontWeight="bold"
                        stroke="#000"
                        strokeWidth="0.5"
                        style={{ pointerEvents: 'none' }}
                      >
                        {ant.ensnared}
                      </text>
                    </g>
                  )}
                  {/* Plague indicator - animated sprite */}
                  {ant.plagued && ant.plagued > 0 && (
                    <g>
                      <defs>
                        <clipPath id={`plague-clip-${ant.id}`}>
                          <rect x="-16" y="-16" width="32" height="32" />
                        </clipPath>
                      </defs>
                      <image
                        href={`${process.env.PUBLIC_URL}/sprites/ants/plague_effect.png`}
                        x={-16 - (effectAnimationFrame * 32)}
                        y="-16"
                        width="256"
                        height="32"
                        clipPath={`url(#plague-clip-${ant.id})`}
                        style={{ pointerEvents: 'none' }}
                      />
                      {/* Plague duration text */}
                      <text
                        textAnchor="middle"
                        x="8"
                        y="20"
                        fontSize="10"
                        fill="#8e44ad"
                        fontWeight="bold"
                        stroke="#000"
                        strokeWidth="0.5"
                        style={{ pointerEvents: 'none' }}
                      >
                        {ant.plagued}
                      </text>
                    </g>
                  )}
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
                  {/* Damage preview when in attack mode */}
                  {selectedAction === 'attack' && selectedAnt && isAttackable && (() => {
                    const attacker = gameState.ants[selectedAnt];
                    if (!attacker) return null;

                    const damage = calculateDamage(attacker, ant, getGameStateForLogic());
                    const damagePercent = Math.round((damage / ant.maxHealth) * 100);

                    return (
                      <g>
                        {/* Damage background */}
                        <rect
                          x="-25"
                          y="-40"
                          width="50"
                          height="18"
                          fill="rgba(255, 50, 50, 0.9)"
                          stroke="#fff"
                          strokeWidth="2"
                          rx="4"
                          style={{ pointerEvents: 'none' }}
                        />
                        {/* Damage text */}
                        <text
                          textAnchor="middle"
                          x="0"
                          y="-28"
                          fontSize="14"
                          fill="#fff"
                          fontWeight="bold"
                          style={{ pointerEvents: 'none' }}
                        >
                          -{damagePercent}%
                        </text>
                      </g>
                    );
                  })()}
                </g>
              );
            })()}
            {/* Fog of War overlay - darken non-visible hexes */}
            {!isVisible && (
              <polygon
                points="50,0 25,-43 -25,-43 -50,0 -25,43 25,43"
                fill="rgba(0, 0, 0, 0.7)"
                style={{ pointerEvents: 'none' }}
              />
            )}
            {/* Dead ant rendering */}
            {(() => {
              const deadAnt = Object.values(gameState.deadAnts || {}).find(
                da => da.position.q === q && da.position.r === r
              );
              if (deadAnt) {
                return (
                  <image
                    x={-40}
                    y={-40}
                    width={80}
                    height={80}
                    href={`${process.env.PUBLIC_URL}/sprites/ants/dead_ant.png`}
                    style={{ pointerEvents: 'none', opacity: 0.8 }}
                    onError={(e) => {
                      console.error('Failed to load dead ant sprite');
                    }}
                  />
                );
              }
              return null;
            })()}
          </g>
        );
      }
    }

    // Render path visualization if hovering over a valid move
    const pathVisualization = [];
    if (hoveredHex && movementPaths.size > 0) {
      let path = null;

      // If we have a waypoint, combine paths: ant -> waypoint -> hover
      if (pathWaypoint) {
        const waypointKey = pathWaypoint.toString();
        const hoverKey = hoveredHex.toString();
        const pathToWaypoint = movementPaths.get(waypointKey);
        const pathFromWaypoint = movementPaths.get(hoverKey);

        // Try to find a path from waypoint to hover hex
        if (pathToWaypoint && pathFromWaypoint) {
          // Calculate remaining movement after reaching waypoint
          const remainingMoves = (pathToWaypoint.length - 1);

          // Check if we have a valid path through the waypoint
          // We need to recalculate from the waypoint with remaining movement
          const ant = gameState.ants[selectedAnt];
          if (ant && ant.type && AntTypes[ant.type]) {
            let range = AntTypes[ant.type].movement;
            if (ant.ensnared && ant.ensnared > 0) range = 0;

            const costToWaypoint = pathToWaypoint.length - 1;
            const remainingRange = range - costToWaypoint;

            if (remainingRange > 0 && !hexEquals(pathWaypoint, hoveredHex)) {
              // Get blocked hexes
              const blockedHexes = Object.values(gameState.ants)
                .filter(a => a.id !== ant.id && (!a.burrowed || a.owner !== ant.owner))
                .map(a => a.position.toString());

              // Calculate path from waypoint to destination
              const pathsFromWaypoint = getMovementRangeWithPaths(
                pathWaypoint,
                remainingRange,
                gridRadius,
                blockedHexes
              );

              const pathFromWaypointToHover = pathsFromWaypoint.find(
                ({hex}) => hexEquals(hex, hoveredHex)
              );

              if (pathFromWaypointToHover) {
                // Combine paths: remove duplicate waypoint hex
                path = [...pathToWaypoint, ...pathFromWaypointToHover.path.slice(1)];
              }
            }
          }
        }
      }

      // If no waypoint or waypoint path failed, use direct path
      if (!path) {
        const hexKey = hoveredHex.toString();
        path = movementPaths.get(hexKey);
      }

      if (path && path.length > 0) {
        // Draw arrows along the path
        for (let i = 0; i < path.length; i++) {
          const currentHex = path[i];
          const { x, y } = hexToPixel(currentHex, hexSize);

          if (i < path.length - 1) {
            // Draw arrow from current to next hex
            const nextHex = path[i + 1];
            const { x: nextX, y: nextY } = hexToPixel(nextHex, hexSize);

            // Calculate arrow direction
            const dx = nextX - x;
            const dy = nextY - y;
            const angle = Math.atan2(dy, dx);

            // Highlight waypoint segment differently
            const isWaypointSegment = pathWaypoint && i < path.findIndex(p => hexEquals(p, pathWaypoint));

            pathVisualization.push(
              <g key={`path-${i}`}>
                {/* Arrow line */}
                <line
                  x1={x}
                  y1={y}
                  x2={nextX}
                  y2={nextY}
                  stroke={isWaypointSegment ? "#FFA500" : "#FF0000"}
                  strokeWidth="3"
                  style={{ pointerEvents: 'none' }}
                />
                {/* Arrow head */}
                <polygon
                  points="0,-6 12,0 0,6"
                  fill={isWaypointSegment ? "#FFA500" : "#FF0000"}
                  transform={`translate(${nextX}, ${nextY}) rotate(${angle * 180 / Math.PI})`}
                  style={{ pointerEvents: 'none' }}
                />
              </g>
            );
          } else {
            // Draw a circle at the final destination
            pathVisualization.push(
              <circle
                key={`path-end-${i}`}
                cx={x}
                cy={y}
                r="10"
                fill="none"
                stroke="#FF0000"
                strokeWidth="3"
                style={{ pointerEvents: 'none' }}
              />
            );
          }
        }

        // Draw waypoint marker if set
        if (pathWaypoint) {
          const { x: wpX, y: wpY } = hexToPixel(pathWaypoint, hexSize);
          pathVisualization.push(
            <circle
              key="waypoint-marker"
              cx={wpX}
              cy={wpY}
              r="8"
              fill="#FFA500"
              stroke="#FFFFFF"
              strokeWidth="2"
              style={{ pointerEvents: 'none' }}
            />
          );
        }
      }
    }

    return (
      <>
        {patterns}
        {hexagons}
        {pathVisualization}
      </>
    );
  };

  return (
    <div className="App" style={{ padding: '10px', backgroundColor: '#f0f0f0', height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <h1 style={{ margin: '0 0 10px 0', fontSize: '24px' }}>Ant Wars</h1>

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

              <h3 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>Build Ants</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {['drone', 'scout', 'soldier', 'spitter', 'bomber', 'bombardier', 'tank', 'healer', 'cordyphage']
                  .map(id => AntTypes[id.toUpperCase()])
                  .filter(ant => ant) // Remove any undefined
                  .map(ant => {
                  const currentPlayer = gameState.players[gameState.currentPlayer];
                  const affordable = canAfford(currentPlayer, ant.id.toUpperCase());

                  // Get hero-modified cost for display
                  const { applyHeroCostModifier } = require('./heroQueens');
                  const displayCost = currentPlayer.heroId
                    ? applyHeroCostModifier(ant.cost, currentPlayer.heroId)
                    : ant.cost;

                  // Check if unit requires a specific queen tier
                  const queen = Object.values(gameState.ants).find(
                    a => a.type === 'queen' && a.owner === gameState.currentPlayer
                  );
                  const queenTier = queen?.queenTier || 'queen';

                  // Check if locked: requires a specific tier and player doesn't have it yet
                  let isLocked = false;
                  if (ant.requiresQueenTier) {
                    if (ant.requiresQueenTier === 'broodQueen') {
                      isLocked = queenTier === 'queen'; // Locked if still base queen
                    } else if (ant.requiresQueenTier === 'swarmQueen') {
                      isLocked = queenTier !== 'swarmQueen'; // Locked unless swarm queen
                    }
                  }

                  // Build tooltip message
                  let tooltipMessage = ant.description;
                  if (isLocked && ant.requiresQueenTier) {
                    const requiredTierName = QueenTiers[ant.requiresQueenTier]?.name || ant.requiresQueenTier;
                    tooltipMessage = `Requires ${requiredTierName}. ${ant.description}`;
                  }

                  // Hotkey mapping for each ant type
                  const hotkeyMap = {
                    'drone': 'D',
                    'scout': 'S',
                    'soldier': 'O',
                    'tank': 'T',
                    'spitter': 'I',
                    'bomber': 'X',
                    'bombardier': 'R',
                    'healer': 'W',
                    'cordyphage': 'C'
                  };
                  const hotkey = hotkeyMap[ant.id];

                  return (
                    <button
                      key={ant.id}
                      onClick={() => {
                        // Check if player has a queen to lay eggs
                        if (!queen) {
                          alert('You need a queen to lay eggs!');
                          return;
                        }
                        if (isLocked && ant.requiresQueenTier) {
                          const requiredTierName = QueenTiers[ant.requiresQueenTier]?.name || ant.requiresQueenTier;
                          alert(`This unit requires ${requiredTierName}!`);
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
                      disabled={!affordable || !isMyTurn() || isLocked}
                      title={tooltipMessage}
                      style={{
                        padding: '8px 10px',
                        fontSize: '14px',
                        backgroundColor: isLocked ? '#999' : (affordable ? '#4CAF50' : '#ccc'),
                        color: (isLocked || !affordable) ? '#666' : 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: (affordable && isMyTurn() && !isLocked) ? 'pointer' : 'not-allowed',
                        textAlign: 'left',
                        opacity: isMyTurn() ? 1 : 0.6
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '64px',
                          height: '64px',
                          overflow: 'hidden',
                          flexShrink: 0
                        }}>
                          <img
                            src={`${process.env.PUBLIC_URL}/sprites/ants/${ant.id}_idle.png`}
                            alt={ant.name}
                            style={{
                              height: '32px',
                              imageRendering: 'pixelated',
                              objectFit: 'none',
                              objectPosition: '0 0',
                              transform: 'scale(2)',
                              transformOrigin: 'top left'
                            }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{ant.name} {hotkey && `(${hotkey})`}</div>
                          <div style={{ fontSize: '12px', marginTop: '3px' }}>
                            Cost: {displayCost.food}🍃 {displayCost.minerals}💎
                          </div>
                          <div style={{ fontSize: '11px', marginTop: '2px', opacity: 0.85, lineHeight: '1.2' }}>
                            {ant.description}
                          </div>
                        </div>
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
        <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', minWidth: 0 }}>
          <div style={{
            backgroundImage: `url(${forestFloorImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            border: '2px solid #333',
            display: 'inline-block',
            maxWidth: '100%',
            maxHeight: 'calc(100vh - 80px)',
            overflow: 'hidden'
          }}>
            <svg
              width="1200"
              height="900"
              viewBox="0 0 1200 900"
              style={{ cursor: isDragging ? 'grabbing' : 'default', display: 'block', background: 'transparent' }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
            >
            <defs>
              {/* Clip paths for sprite animations - one per ant */}
              {Object.values(gameState.ants).map(ant => (
                <clipPath key={`clip-${ant.id}`} id={`clip-${ant.id}`}>
                  <rect x={-40} y={-40} width={80} height={80} />
                </clipPath>
              ))}
            </defs>
            <g transform={`translate(600, 450) scale(${zoomLevel}) translate(${cameraOffset.x}, ${cameraOffset.y})`}>
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
        </div>

        {/* Game Info Panel - Right Side */}
        <div style={{ width: '250px', backgroundColor: '#fff', padding: '15px', borderRadius: '8px', maxHeight: 'calc(100vh - 80px)', overflowY: 'auto', overflowX: 'hidden', paddingBottom: '200px' }}>
          {gameMode.isMultiplayer && (
            <div style={{ marginBottom: '10px', padding: '10px', backgroundColor: '#ecf0f1', borderRadius: '5px' }}>
              <p><strong>Game Mode:</strong> Online</p>
              <p><strong>You are:</strong> {gameMode.playerRole === 'player1' ? 'Player 1 (Red)' : 'Player 2 (Cyan)'}</p>
              {!isMyTurn() && <p style={{ color: '#e74c3c' }}><strong>Waiting for opponent...</strong></p>}
            </div>
          )}

          <h2>Turn {gameState.turn}</h2>
          <h3 style={{ color: gameState.players[gameState.currentPlayer]?.color || '#000' }}>
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

          {/* Selected Anthill Info */}
          {selectedAnthill && (
            <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#d4edda', borderRadius: '5px', border: '2px solid #28a745' }}>
              <h4>Anthill Info</h4>
              <p><strong>Type:</strong> {selectedAnthill.resourceType === 'food' ? '🍃 Food' : '💎 Minerals'}</p>
              <p><strong>Owner:</strong> {gameState.players[selectedAnthill.owner].name}</p>
              <p><strong>Income:</strong> {GameConstants.ANTHILL_PASSIVE_INCOME[selectedAnthill.resourceType]} per turn</p>
              <p><strong>Resources Gathered:</strong> {selectedAnthill.resourcesGathered || 0} / 75</p>
              <p><strong>Remaining:</strong> {75 - (selectedAnthill.resourcesGathered || 0)}</p>
              <div style={{
                width: '100%',
                height: '20px',
                backgroundColor: '#e0e0e0',
                borderRadius: '10px',
                overflow: 'hidden',
                marginTop: '10px'
              }}>
                <div style={{
                  width: `${((selectedAnthill.resourcesGathered || 0) / 75) * 100}%`,
                  height: '100%',
                  backgroundColor: selectedAnthill.resourceType === 'food' ? '#4CAF50' : '#2196F3',
                  transition: 'width 0.3s ease'
                }} />
              </div>
              <button
                onClick={() => setSelectedAnthill(null)}
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
              {(gameState.ants[selectedAnt].type === 'queen' || gameState.ants[selectedAnt].type === 'healer' || gameState.ants[selectedAnt].type === 'cordyphage') && gameState.ants[selectedAnt].maxEnergy && (
                <p>Energy: {gameState.ants[selectedAnt].energy || 0}/{gameState.ants[selectedAnt].maxEnergy}</p>
              )}
              {(() => {
                const ant = gameState.ants[selectedAnt];
                const antType = AntTypes[ant.type.toUpperCase()];
                const owner = gameState.players[ant.owner];

                // Use getAntAttack and getAntDefense to get actual stats with all bonuses
                const { getAntAttack, getAntDefense } = require('./gameState');
                const totalAttack = getAntAttack(ant, owner);
                const totalDefense = getAntDefense(ant, owner, gameState);

                const baseAttack = antType.attack || 0;
                const baseDefense = antType.defense || 0;
                const attackBonus = totalAttack - baseAttack;
                const defenseBonus = totalDefense - baseDefense;

                return (
                  <>
                    {baseAttack > 0 && (
                      <p>Attack: {totalAttack} {attackBonus > 0 && <span style={{ color: '#27ae60' }}>(+{attackBonus})</span>}</p>
                    )}
                    <p>Defense: {totalDefense} {defenseBonus > 0 && <span style={{ color: '#27ae60' }}>(+{defenseBonus})</span>}</p>
                  </>
                );
              })()}
              {gameState.ants[selectedAnt].ensnared && gameState.ants[selectedAnt].ensnared > 0 && (
                <p style={{ color: '#f39c12', fontWeight: 'bold' }}>🕸️ Ensnared ({gameState.ants[selectedAnt].ensnared} turns)</p>
              )}
              {gameState.ants[selectedAnt].plagued && gameState.ants[selectedAnt].plagued > 0 && (
                <p style={{ color: '#8e44ad', fontWeight: 'bold' }}>☠️ Plagued ({gameState.ants[selectedAnt].plagued} turns)</p>
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
                    💥 DETONATE (D) (Suicide Attack) 💥
                  </button>
                ) : gameState.ants[selectedAnt].type === 'healer' ? (
                  <>
                    {/* Healer-specific: Heal and Ensnare buttons */}
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
                      ✨ Heal (25⚡) (H)
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
                      🕸️ Ensnare (20⚡) (E)
                    </button>
                  </>
                ) : gameState.ants[selectedAnt].type === 'cordyphage' ? (
                  <>
                    {/* Cordyphage-specific: Plague and Cordyceps Purge buttons */}
                    <button
                      onClick={() => setSelectedAction('plague')}
                      disabled={!isMyTurn() || gameState.ants[selectedAnt].hasAttacked}
                      style={{
                        marginRight: '5px',
                        padding: '8px 12px',
                        backgroundColor: selectedAction === 'plague' ? '#16a085' : '#ecf0f1',
                        color: selectedAction === 'plague' ? 'white' : 'black',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: (isMyTurn() && !gameState.ants[selectedAnt].hasAttacked) ? 'pointer' : 'not-allowed',
                        fontWeight: selectedAction === 'plague' ? 'bold' : 'normal',
                        opacity: isMyTurn() ? 1 : 0.6
                      }}
                    >
                      ☠️ Plague (25⚡) (P)
                    </button>
                    {gameState.players[gameState.currentPlayer].upgrades.cordycepsPurge > 0 && (
                      <button
                        onClick={() => setSelectedAction('cordyceps')}
                        disabled={!isMyTurn() || gameState.ants[selectedAnt].hasAttacked}
                        style={{
                          marginRight: '5px',
                          padding: '8px 12px',
                          backgroundColor: selectedAction === 'cordyceps' ? '#8e44ad' : '#ecf0f1',
                          color: selectedAction === 'cordyceps' ? 'white' : 'black',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: (isMyTurn() && !gameState.ants[selectedAnt].hasAttacked) ? 'pointer' : 'not-allowed',
                          fontWeight: selectedAction === 'cordyceps' ? 'bold' : 'normal',
                          opacity: isMyTurn() ? 1 : 0.6
                        }}
                      >
                        🧠 Cordyceps (35⚡)
                      </button>
                    )}
                  </>
                ) : gameState.ants[selectedAnt].type === 'bombardier' ? (
                  <>
                    {/* Bombardier-specific: Focus Fire and Splash attack modes */}
                    <button
                      onClick={() => setSelectedAction('attack')}
                      disabled={!isMyTurn() || gameState.ants[selectedAnt].hasAttacked}
                      style={{
                        marginRight: '5px',
                        padding: '8px 12px',
                        backgroundColor: selectedAction === 'attack' ? '#e74c3c' : '#ecf0f1',
                        color: selectedAction === 'attack' ? 'white' : 'black',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: (isMyTurn() && !gameState.ants[selectedAnt].hasAttacked) ? 'pointer' : 'not-allowed',
                        fontWeight: selectedAction === 'attack' ? 'bold' : 'normal',
                        opacity: isMyTurn() ? 1 : 0.6
                      }}
                    >
                      🎯 Focus Fire (A, 15)
                    </button>
                    <button
                      onClick={() => setSelectedAction('bombardier_splash')}
                      disabled={!isMyTurn() || gameState.ants[selectedAnt].hasAttacked}
                      style={{
                        marginRight: '5px',
                        padding: '8px 12px',
                        backgroundColor: selectedAction === 'bombardier_splash' ? '#ff6b35' : '#ecf0f1',
                        color: selectedAction === 'bombardier_splash' ? 'white' : 'black',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: (isMyTurn() && !gameState.ants[selectedAnt].hasAttacked) ? 'pointer' : 'not-allowed',
                        fontWeight: selectedAction === 'bombardier_splash' ? 'bold' : 'normal',
                        opacity: isMyTurn() ? 1 : 0.6
                      }}
                    >
                      💥 Splash (8, 3-hex)
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
                    Attack (A)
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
                        Lay Egg (Q)
                      </button>
                      <button
                        onClick={() => setSelectedAction('heal')}
                        style={{
                          marginRight: '5px',
                          padding: '8px 12px',
                          backgroundColor: selectedAction === 'heal' ? '#27ae60' : '#ecf0f1',
                          color: selectedAction === 'heal' ? 'white' : 'black',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: selectedAction === 'heal' ? 'bold' : 'normal'
                        }}
                      >
                        Heal (H, 25⚡)
                      </button>
                      {gameState.players[gameState.currentPlayer].upgrades.reveal > 0 && (
                        <button
                          onClick={() => setSelectedAction('reveal')}
                          disabled={!isMyTurn() || gameState.ants[selectedAnt].hasAttacked}
                          style={{
                            marginRight: '5px',
                            padding: '8px 12px',
                            backgroundColor: selectedAction === 'reveal' ? '#3498db' : '#ecf0f1',
                            color: selectedAction === 'reveal' ? 'white' : 'black',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: (isMyTurn() && !gameState.ants[selectedAnt].hasAttacked) ? 'pointer' : 'not-allowed',
                            fontWeight: selectedAction === 'reveal' ? 'bold' : 'normal',
                            opacity: isMyTurn() ? 1 : 0.6
                          }}
                        >
                          👁️ Reveal (30⚡)
                        </button>
                      )}
                      <button
                        onClick={() => setShowUpgradesModal(true)}
                        style={{
                          padding: '8px 12px',
                          backgroundColor: '#9C27B0',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: 'normal'
                        }}
                      >
                        ⚡ Upgrades
                      </button>
                    </>
                  )}
                  {gameState.ants[selectedAnt].type === 'drone' && !gameState.ants[selectedAnt].hasBuilt && (
                    <button
                      onClick={handleBuildAnthillAction}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: '#f39c12',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'normal'
                      }}
                    >
                      Build Anthill (B)
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

                {/* Bombardier Splash Instructions */}
                {selectedAction === 'bombardier_splash' && bombardierTargetHex && (
                  <div style={{
                    marginTop: '10px',
                    padding: '10px',
                    backgroundColor: '#fff3cd',
                    borderRadius: '5px',
                    border: '2px solid #ffc107',
                    fontSize: '13px',
                    textAlign: 'center'
                  }}>
                    <strong>⌨️ Press SHIFT to rotate</strong><br />
                    <span style={{ fontSize: '11px', color: '#856404' }}>
                      Click the same hex again to confirm attack
                    </span>
                  </div>
                )}
            </div>
          )}

          {/* Ant Type Selector */}
          {showAntTypeSelector && (
            <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#fff3cd', borderRadius: '5px', border: '2px solid #ffc107' }}>
              <h4>Select Ant Type to Lay</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {['drone', 'scout', 'soldier', 'spitter', 'bomber', 'bombardier', 'healer', 'tank', 'cordyphage']
                  .map(id => AntTypes[id.toUpperCase()])
                  .filter(ant => ant) // Remove any undefined
                  .map(ant => {
                  const currentPlayer = gameState.players[gameState.currentPlayer];
                  const affordable = canAfford(currentPlayer, ant.id.toUpperCase());

                  // Check if unit requires a specific queen tier
                  const queen = Object.values(gameState.ants).find(
                    a => a.type === 'queen' && a.owner === gameState.currentPlayer
                  );
                  const queenTier = queen?.queenTier || 'queen';

                  // Check if locked: requires a specific tier and player doesn't have it yet
                  let isLocked = false;
                  if (ant.requiresQueenTier) {
                    if (ant.requiresQueenTier === 'broodQueen') {
                      isLocked = queenTier === 'queen'; // Locked if still base queen
                    } else if (ant.requiresQueenTier === 'swarmQueen') {
                      isLocked = queenTier !== 'swarmQueen'; // Locked unless swarm queen
                    }
                  }

                  // Build tooltip message
                  let tooltipMessage = ant.description;
                  if (isLocked && ant.requiresQueenTier) {
                    const requiredTierName = QueenTiers[ant.requiresQueenTier]?.name || ant.requiresQueenTier;
                    tooltipMessage = `Requires ${requiredTierName}. ${ant.description}`;
                  }

                  // Hotkey mapping for each ant type
                  const hotkeyMap = {
                    'drone': 'D',
                    'scout': 'S',
                    'soldier': 'O',
                    'tank': 'T',
                    'spitter': 'I',
                    'bomber': 'X',
                    'bombardier': 'R',
                    'healer': 'W',
                    'cordyphage': 'C'
                  };
                  const hotkey = hotkeyMap[ant.id];

                  return (
                    <button
                      key={ant.id}
                      onClick={() => {
                        if (isLocked && ant.requiresQueenTier) {
                          const requiredTierName = QueenTiers[ant.requiresQueenTier]?.name || ant.requiresQueenTier;
                          alert(`This unit requires ${requiredTierName}!`);
                          return;
                        }
                        handleLayEgg(ant.id);
                      }}
                      disabled={!affordable || isLocked}
                      title={tooltipMessage}
                      style={{
                        padding: '8px',
                        fontSize: '12px',
                        backgroundColor: isLocked ? '#999' : (affordable ? '#4CAF50' : '#ccc'),
                        color: (isLocked || !affordable) ? '#666' : 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: (affordable && !isLocked) ? 'pointer' : 'not-allowed',
                        textAlign: 'left'
                      }}
                    >
                      <div>{ant.icon} {ant.name} {hotkey && `(${hotkey})`}</div>
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
            onClick={handleEndTurn}
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

      {/* Camera Controls - In gap between map and right panel */}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        right: 'calc(250px + 60px)', // Right panel width (250px) + gap (60px) - moved more left
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 60px)', // Made a bit bigger
        gridTemplateRows: 'repeat(2, 60px) auto',
        gap: '10px',
        zIndex: 1000
      }}>
        {/* Cycle to Next Active Ant */}
        <button
          onClick={cycleToNextActiveAnt}
          disabled={!isMyTurn()}
          style={{
            padding: '0',
            borderRadius: '8px',
            backgroundColor: isMyTurn() ? '#9C27B0' : '#ccc',
            color: 'white',
            border: 'none',
            fontSize: '24px',
            fontWeight: 'bold',
            cursor: isMyTurn() ? 'pointer' : 'not-allowed',
            boxShadow: '0 3px 6px rgba(0,0,0,0.3)',
            width: '60px',
            height: '60px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isMyTurn() ? 1 : 0.5
          }}
          title="Cycle to Next Active Ant (Tab)"
        >
          🐜⟳
        </button>
        {/* Center on Queen */}
        <button
          onClick={centerOnQueen}
          style={{
            padding: '0',
            borderRadius: '8px',
            backgroundColor: '#FF9800',
            color: 'white',
            border: 'none',
            fontSize: '26px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 3px 6px rgba(0,0,0,0.3)',
            width: '60px',
            height: '60px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Center on Queen (C)"
        >
          👑
        </button>
        {/* Zoom In */}
        <button
          onClick={() => setZoomLevel(prev => Math.min(MAX_ZOOM, prev + 0.2))}
          style={{
            padding: '0',
            borderRadius: '8px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            fontSize: '30px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 3px 6px rgba(0,0,0,0.3)',
            width: '60px',
            height: '60px',
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
            borderRadius: '8px',
            backgroundColor: '#f44336',
            color: 'white',
            border: 'none',
            fontSize: '30px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 3px 6px rgba(0,0,0,0.3)',
            width: '60px',
            height: '60px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Zoom Out (-)"
        >
          -
        </button>
        {/* Zoom Level Display */}
        <div style={{
          padding: '8px',
          borderRadius: '8px',
          backgroundColor: 'rgba(0,0,0,0.7)',
          color: 'white',
          fontSize: '12px',
          textAlign: 'center',
          fontWeight: 'bold',
          gridColumn: 'span 2',
          boxSizing: 'border-box'
        }}>
          {Math.round(zoomLevel * 100)}%
        </div>
      </div>

      {/* Hero Portrait and Power Bar - To the right of "How to Play" button */}
      {gameState.players[gameState.currentPlayer]?.heroId && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          left: 'calc(300px + 40px + 130px + 15px)', // Left panel (300px) + gap (40px) + "How to Play" button width (130px) + gap (15px)
          display: 'flex',
          alignItems: 'center',
          gap: '15px',
          padding: '12px 20px',
          backgroundColor: '#2c3e50',
          borderRadius: '8px',
          border: '2px solid #34495e',
          zIndex: 1000,
          boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
        }}>
          {/* Hero Portrait */}
          <div
            onClick={() => setShowHeroInfo(true)}
            style={{
              width: '64px',
              height: '64px',
              border: '3px solid ' + (gameState.players[gameState.currentPlayer]?.color || '#fff'),
              borderRadius: '8px',
              overflow: 'hidden',
              backgroundColor: '#1a252f',
              flexShrink: 0,
              cursor: 'pointer'
            }}>
            <img
              src={`${process.env.PUBLIC_URL}/sprites/hero_${(() => {
                const color = gameState.players[gameState.currentPlayer]?.color || '#FF0000';
                // Map hex colors to sprite names
                const colorMap = {
                  '#FF0000': 'red',
                  '#ff0000': 'red',
                  '#0000FF': 'blue',
                  '#0000ff': 'blue',
                  '#00FFFF': 'blue',
                  '#00ffff': 'blue',
                  '#FFFF00': 'yellow',
                  '#ffff00': 'yellow',
                  '#00FF00': 'green',
                  '#00ff00': 'green'
                };
                return colorMap[color] || 'red';
              })()}.png`}
              alt="Hero"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>

          {/* Hero Power Bar and Button */}
          <div style={{ minWidth: '250px' }}>
            <div style={{ marginBottom: '6px', color: '#ecf0f1', fontSize: '18px', fontWeight: 'bold' }}>
              {(() => {
                const { getHeroById } = require('./heroQueens');
                const hero = getHeroById(gameState.players[gameState.currentPlayer]?.heroId);
                return hero ? hero.name : 'Hero';
              })()}
            </div>
            {/* Power Bar */}
            <div style={{
              width: '100%',
              height: '22px',
              backgroundColor: '#34495e',
              borderRadius: '11px',
              overflow: 'hidden',
              border: '2px solid #1a252f',
              marginBottom: '6px',
              position: 'relative'
            }}>
              <div style={{
                width: `${gameState.players[gameState.currentPlayer]?.heroPower || 0}%`,
                height: '100%',
                backgroundColor: gameState.players[gameState.currentPlayer]?.heroPower >= 100 ? '#f39c12' : '#3498db',
                transition: 'width 0.3s ease'
              }}>
              </div>
            </div>
            {/* Activate Button */}
            <button
              onClick={() => {
                const { activateHeroAbility } = require('./gameState');
                const newState = activateHeroAbility(gameState, gameState.currentPlayer);
                updateGame(newState);
              }}
              disabled={
                !isMyTurn() ||
                (gameState.players[gameState.currentPlayer]?.heroPower || 0) < 100 ||
                gameState.players[gameState.currentPlayer]?.heroAbilityActive
              }
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 'bold',
                backgroundColor: (gameState.players[gameState.currentPlayer]?.heroPower || 0) >= 100 && isMyTurn() && !gameState.players[gameState.currentPlayer]?.heroAbilityActive ? '#f39c12' : '#95a5a6',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: (gameState.players[gameState.currentPlayer]?.heroPower || 0) >= 100 && isMyTurn() && !gameState.players[gameState.currentPlayer]?.heroAbilityActive ? 'pointer' : 'not-allowed',
                width: '100%',
                opacity: isMyTurn() ? 1 : 0.6
              }}
              title={(() => {
                const { getHeroById } = require('./heroQueens');
                const hero = getHeroById(gameState.players[gameState.currentPlayer]?.heroId);
                return hero?.heroAbility?.description || 'Hero Ability';
              })()}
            >
              {gameState.players[gameState.currentPlayer]?.heroAbilityActive ? '✓ ACTIVE' : '⚡ ACTIVATE ABILITY'}
            </button>
          </div>
        </div>
      )}

      {/* Camera Controls Info - Bottom left above "How to Play" button */}
      <div style={{
        position: 'fixed',
        bottom: '65px', // Above the "How to Play" button
        left: 'calc(300px + 40px)', // Left panel width (300px) + gap (40px)
        padding: '8px 12px',
        borderRadius: '8px',
        backgroundColor: 'rgba(0,0,0,0.7)',
        color: 'white',
        fontSize: '11px',
        zIndex: 1000,
        maxWidth: '180px'
      }}>
        <strong>Controls:</strong><br/>
        Tab: Next Active Ant<br/>
        Mouse Wheel: Zoom<br/>
        Middle Click: Pan<br/>
        WASD/Arrows: Pan<br/>
        C: Center on Queen
      </div>

      {/* Help Button - Bottom left under controls */}
      <button
        onClick={() => setShowHelpGuide(true)}
        style={{
          position: 'fixed',
          bottom: '20px',
          left: 'calc(300px + 40px)', // Same position as controls
          padding: '10px 16px',
          borderRadius: '20px',
          backgroundColor: '#2196F3',
          color: 'white',
          border: 'none',
          fontSize: '14px',
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
                    {upgrade.requiresQueenTier && queen?.queenTier !== 'swarmQueen' && (
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
      {/* Hero Info Modal */}
      {showHeroInfo && gameState.players[gameState.currentPlayer]?.heroId && (
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
        onClick={() => setShowHeroInfo(false)}
        >
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '10px',
            maxWidth: '600px',
            width: '100%',
            padding: '30px',
            position: 'relative'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setShowHeroInfo(false)}
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

            {(() => {
              const { getHeroById } = require('./heroQueens');
              const hero = getHeroById(gameState.players[gameState.currentPlayer]?.heroId);
              if (!hero) return null;

              return (
                <>
                  <h1 style={{ marginTop: 0, color: '#333', borderBottom: '3px solid #2196F3', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '36px' }}>{hero.icon}</span>
                    {hero.name}
                  </h1>

                  <div style={{ marginBottom: '25px' }}>
                    <p style={{ fontSize: '16px', color: '#555', fontStyle: 'italic' }}>
                      {hero.description}
                    </p>
                  </div>

                  {/* Passive Bonuses Section */}
                  <section style={{ marginBottom: '25px' }}>
                    <h2 style={{ color: '#2196F3', marginBottom: '10px' }}>Passive Bonuses</h2>
                    <div style={{ backgroundColor: '#f0f0f0', padding: '15px', borderRadius: '8px' }}>
                      {hero.bonuses.meleeAttackBonus && (
                        <p style={{ margin: '5px 0' }}>
                          <strong>Melee Attack:</strong> +{Math.round(hero.bonuses.meleeAttackBonus * 100)}%
                        </p>
                      )}
                      {hero.bonuses.meleeHealthBonus && (
                        <p style={{ margin: '5px 0' }}>
                          <strong>Melee Health:</strong> +{hero.bonuses.meleeHealthBonus}
                        </p>
                      )}
                      {hero.bonuses.rangedAttackBonus && (
                        <p style={{ margin: '5px 0' }}>
                          <strong>Ranged Attack:</strong> +{Math.round(hero.bonuses.rangedAttackBonus * 100)}%
                        </p>
                      )}
                      {hero.bonuses.attackMultiplier && hero.bonuses.attackMultiplier !== 1 && (
                        <p style={{ margin: '5px 0' }}>
                          <strong>All Units Attack:</strong> {hero.bonuses.attackMultiplier > 1 ? '+' : ''}{Math.round((hero.bonuses.attackMultiplier - 1) * 100)}%
                        </p>
                      )}
                      {hero.bonuses.healthMultiplier && hero.bonuses.healthMultiplier !== 1 && (
                        <p style={{ margin: '5px 0' }}>
                          <strong>All Units Health:</strong> {hero.bonuses.healthMultiplier > 1 ? '+' : ''}{Math.round((hero.bonuses.healthMultiplier - 1) * 100)}%
                        </p>
                      )}
                      {hero.bonuses.costMultiplier && hero.bonuses.costMultiplier !== 1 && (
                        <p style={{ margin: '5px 0' }}>
                          <strong>Unit Cost:</strong> {hero.bonuses.costMultiplier < 1 ? '' : '+'}{Math.round((hero.bonuses.costMultiplier - 1) * 100)}% (units are {hero.bonuses.costMultiplier < 1 ? 'cheaper' : 'more expensive'})
                        </p>
                      )}
                      {hero.bonuses.healCostMultiplier && hero.bonuses.healCostMultiplier !== 1 && (
                        <p style={{ margin: '5px 0' }}>
                          <strong>Healing Cost:</strong> {Math.round((1 - hero.bonuses.healCostMultiplier) * 100)}% cheaper
                        </p>
                      )}
                      {hero.bonuses.spawningSpotBonus && (
                        <p style={{ margin: '5px 0' }}>
                          <strong>Spawning Spots:</strong> +{hero.bonuses.spawningSpotBonus} (starts with {2 + hero.bonuses.spawningSpotBonus})
                        </p>
                      )}
                      {hero.bonuses.queenDoubleHeal && (
                        <p style={{ margin: '5px 0' }}>
                          <strong>Queen Healing:</strong> Can heal twice per turn
                        </p>
                      )}
                    </div>
                  </section>

                  {/* Hero Ability Section */}
                  <section style={{ marginBottom: '25px' }}>
                    <h2 style={{ color: '#f39c12', marginBottom: '10px' }}>Hero Ability</h2>
                    <div style={{ backgroundColor: '#fff4e6', padding: '15px', borderRadius: '8px', border: '2px solid #f39c12' }}>
                      <h3 style={{ margin: '0 0 10px 0', color: '#e67e22' }}>{hero.heroAbility.name}</h3>
                      <p style={{ margin: '5px 0', color: '#555' }}>
                        {hero.heroAbility.description}
                      </p>
                      <p style={{ margin: '10px 0 5px 0', fontSize: '14px', color: '#888' }}>
                        <strong>Activation:</strong> Gain 100 hero power by dealing and taking damage, then activate for powerful effects!
                      </p>
                    </div>
                  </section>
                </>
              );
            })()}
          </div>
        </div>
      )}

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
              Ant Wars - Game Guide
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
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{
                        width: '64px',
                        height: '64px',
                        overflow: 'hidden',
                        marginRight: '10px',
                        position: 'relative'
                      }}>
                        <img
                          src={`${process.env.PUBLIC_URL}/sprites/ants/${ant.id}_idle.png`}
                          alt={ant.name}
                          style={{
                            height: '32px',
                            imageRendering: 'pixelated',
                            objectFit: 'none',
                            objectPosition: '0 0',
                            transform: 'scale(2)',
                            transformOrigin: 'top left'
                          }}
                        />
                      </div>
                      <h3 style={{ margin: 0, fontSize: '16px', color: '#333' }}>
                        {ant.name}
                      </h3>
                    </div>
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
