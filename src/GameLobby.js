import React, { useState, useEffect } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { database } from './firebaseConfig';
import { HeroQueens } from './heroQueens';

function GameLobby({ roomCode, playerId, playerRole, isHost, onStartGame, onBack }) {
  const [lobbyState, setLobbyState] = useState({
    playerCount: 2,
    mapShape: 'rectangle',
    player1: {
      id: null,
      color: '#FF0000',
      hero: 'gorlak',
      team: null,
      ready: false
    },
    player2: {
      id: null,
      color: '#0000FF',
      hero: 'sorlorg',
      team: null,
      ready: false
    },
    player3: null,
    player4: null,
    mapSize: 'large',
    fogOfWar: true,
    gameStarted: false
  });

  // Hero to color mapping
  const heroColors = {
    'gorlak': '#FF0000',    // Red
    'sorlorg': '#00FF00',   // Green
    'skrazzit': '#0000FF',  // Blue
    'thorgrim': '#FFFF00',  // Yellow
    'vexxara': '#000000'    // Black
  };

  // Available sprite colors (must match actual sprite files in /sprites/ants/)
  const availableColors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#000000'];

  // Get actual color for player 2, handling duplicate hero selection
  const getPlayer2Color = () => {
    if (lobbyState.player1.hero === lobbyState.player2.hero) {
      // Same hero selected, use an alternative sprite color
      const player1Color = heroColors[lobbyState.player1.hero];
      // Find first available color that's different from player 1
      const alternativeColor = availableColors.find(color => color !== player1Color);
      return alternativeColor || availableColors[0];
    }
    return heroColors[lobbyState.player2.hero];
  };

  // Hero options
  const heroOptions = Object.values(HeroQueens);

  const opponentJoined = playerRole === 'player1' ? lobbyState.player2.id : lobbyState.player1.id;

  // Map size options
  const mapSizeOptions = [
    { name: 'Small (7x7)', value: 'small' },
    { name: 'Medium (9x9)', value: 'medium' },
    { name: 'Large (11x11)', value: 'large' }
  ];

  // Subscribe to lobby state
  useEffect(() => {
    const lobbyRef = ref(database, `lobbies/${roomCode}`);

    // Initialize lobby if host (only once)
    const initializeLobby = async () => {
      if (isHost) {
        const { get } = await import('firebase/database');
        const snapshot = await get(lobbyRef);

        // Only initialize if lobby doesn't exist yet
        if (!snapshot.exists()) {
          update(lobbyRef, {
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
            mapSize: 'large',
            fogOfWar: true,
            gameStarted: false
          });
        } else {
          // Lobby exists, just update player1 id if needed
          const data = snapshot.val();
          if (!data.player1 || data.player1.id !== playerId) {
            update(lobbyRef, {
              [`player1/id`]: playerId
            });
          }
        }
      } else {
        // Join as player 2, 3, or 4 based on playerRole
        const { get } = await import('firebase/database');
        const snapshot = await get(lobbyRef);

        if (snapshot.exists()) {
          const data = snapshot.val();
          const currentPlayerData = data[playerRole];

          // Only update if we're not already this player
          if (!currentPlayerData || currentPlayerData.id !== playerId) {
            update(lobbyRef, {
              [`${playerRole}/id`]: playerId,
              [`${playerRole}/color`]: currentPlayerData?.color || '#0000FF',
              [`${playerRole}/ready`]: currentPlayerData?.ready || false
            });
          }
        }
      }
    };

    initializeLobby();

    const unsubscribe = onValue(lobbyRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setLobbyState(data);

        // If game started, transition to game
        if (data.gameStarted) {
          console.log('GameLobby: Game starting with Firebase data:', {
            playerCount: data.playerCount,
            mapShape: data.mapShape,
            hasPlayer3: !!data.player3,
            hasPlayer4: !!data.player4
          });
          // Calculate colors for all players with deconfliction
          const usedColors = [];
          const getPlayerColor = (player, index) => {
            if (!player?.hero) return availableColors[index % availableColors.length];
            let color = heroColors[player.hero];
            // If color already used, find an alternative
            if (usedColors.includes(color)) {
              color = availableColors.find(c => !usedColors.includes(c)) || availableColors[index % availableColors.length];
            }
            usedColors.push(color);
            return color;
          };

          const player1Color = getPlayerColor(data.player1, 0);
          const player2Color = getPlayerColor(data.player2, 1);
          const player3Color = data.player3 ? getPlayerColor(data.player3, 2) : null;
          const player4Color = data.player4 ? getPlayerColor(data.player4, 3) : null;

          onStartGame({
            gameId: roomCode,
            playerId,
            playerRole,
            isHost,
            isMultiplayer: true,
            playerCount: data.playerCount || 2,
            mapShape: data.mapShape || 'rectangle',
            mapSize: data.mapSize,
            fogOfWar: data.fogOfWar !== undefined ? data.fogOfWar : true,
            player1Color: player1Color,
            player2Color: player2Color,
            player3Color: player3Color,
            player4Color: player4Color,
            player1Hero: data.player1?.hero,
            player2Hero: data.player2?.hero,
            player3Hero: data.player3?.hero,
            player4Hero: data.player4?.hero,
            player1Team: data.player1?.team,
            player2Team: data.player2?.team,
            player3Team: data.player3?.team,
            player4Team: data.player4?.team
          });
        }
      }
    });

    return () => unsubscribe();
  }, [roomCode, playerId, playerRole, isHost, onStartGame]);

  const handleHeroChange = (newHero) => {
    const lobbyRef = ref(database, `lobbies/${roomCode}`);

    // Determine the new player 2 color based on hero selection
    let newPlayer2Color;
    if (playerRole === 'player1') {
      // Player 1 is changing, check if they'll match player 2
      if (newHero === lobbyState.player2.hero) {
        // Find alternative sprite color
        const player1Color = heroColors[newHero];
        newPlayer2Color = availableColors.find(color => color !== player1Color) || availableColors[0];
      } else {
        newPlayer2Color = heroColors[lobbyState.player2.hero];
      }
    } else {
      // Player 2 is changing, check if they'll match player 1
      if (newHero === lobbyState.player1.hero) {
        // Find alternative sprite color
        const player1Color = heroColors[lobbyState.player1.hero];
        newPlayer2Color = availableColors.find(color => color !== player1Color) || availableColors[0];
      } else {
        newPlayer2Color = heroColors[newHero];
      }
    }

    update(lobbyRef, {
      [`${playerRole}/hero`]: newHero,
      [`${playerRole}/color`]: playerRole === 'player1' ? heroColors[newHero] : newPlayer2Color,
      // Also update player 2's color if player 1 changes hero
      ...(playerRole === 'player1' && { 'player2/color': newPlayer2Color })
    });
  };

  const handleMapSizeChange = (newSize) => {
    if (!isHost) return; // Only host can change map size
    const lobbyRef = ref(database, `lobbies/${roomCode}`);
    update(lobbyRef, {
      mapSize: newSize
    });
  };

  const handleFogOfWarToggle = () => {
    if (!isHost) return; // Only host can change fog of war
    const lobbyRef = ref(database, `lobbies/${roomCode}`);
    update(lobbyRef, {
      fogOfWar: !lobbyState.fogOfWar
    });
  };

  // Handle team selection (only for 3+ player games)
  const handleTeamChange = (team) => {
    const lobbyRef = ref(database, `lobbies/${roomCode}`);
    update(lobbyRef, {
      [`${playerRole}/team`]: team
    });
  };

  // Check if teams are valid (not all on same team when teams are used)
  const areTeamsValid = () => {
    const playerCount = lobbyState.playerCount || 2;
    if (playerCount === 2) return true; // 2-player doesn't need team validation

    // Collect all teams
    const teams = [];
    if (lobbyState.player1?.id && lobbyState.player1?.team) teams.push(lobbyState.player1.team);
    if (lobbyState.player2?.id && lobbyState.player2?.team) teams.push(lobbyState.player2.team);
    if (lobbyState.player3?.id && lobbyState.player3?.team) teams.push(lobbyState.player3.team);
    if (lobbyState.player4?.id && lobbyState.player4?.team) teams.push(lobbyState.player4.team);

    // If no one has selected a team, it's FFA (valid)
    if (teams.length === 0) return true;

    // If some have teams, check there's at least 2 different teams
    const uniqueTeams = new Set(teams);
    return uniqueTeams.size >= 2 || teams.length === 0;
  };

  // Get all players who have joined
  const getJoinedPlayers = () => {
    const players = [];
    if (lobbyState.player1?.id) players.push({ role: 'player1', ...lobbyState.player1 });
    if (lobbyState.player2?.id) players.push({ role: 'player2', ...lobbyState.player2 });
    if (lobbyState.player3?.id) players.push({ role: 'player3', ...lobbyState.player3 });
    if (lobbyState.player4?.id) players.push({ role: 'player4', ...lobbyState.player4 });
    return players;
  };

  // Check if all required players have joined
  const allPlayersJoined = () => {
    const playerCount = lobbyState.playerCount || 2;
    const joined = getJoinedPlayers().length;
    return joined >= playerCount;
  };

  // Check if all non-host players are ready
  const allPlayersReady = () => {
    const playerCount = lobbyState.playerCount || 2;
    for (let i = 1; i <= playerCount; i++) {
      const playerKey = `player${i}`;
      const player = lobbyState[playerKey];
      if (player?.id && playerKey !== 'player1' && !player.ready) {
        return false;
      }
    }
    return true;
  };

  const handleReady = () => {
    const lobbyRef = ref(database, `lobbies/${roomCode}`);
    update(lobbyRef, {
      [`${playerRole}/ready`]: !lobbyState[playerRole].ready
    });
  };

  const handleStartGame = () => {
    if (!isHost) return;

    if (!allPlayersJoined()) {
      alert('Waiting for all players to join!');
      return;
    }

    if (!allPlayersReady()) {
      alert('Waiting for all players to be ready!');
      return;
    }

    // Validate teams for 3+ player games
    if (!areTeamsValid()) {
      alert('Invalid team configuration! Not all players can be on the same team.');
      return;
    }

    const lobbyRef = ref(database, `lobbies/${roomCode}`);
    update(lobbyRef, {
      gameStarted: true
    });
  };

  const myHero = lobbyState[playerRole]?.hero || 'gorlak';
  const myColor = heroColors[myHero];
  const opponentHero = playerRole === 'player1' ? lobbyState.player2?.hero : lobbyState.player1?.hero;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundImage: `url(${process.env.PUBLIC_URL}/sprites/antwars_background.png)`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      padding: '15px',
      boxSizing: 'border-box'
    }}>
      <div style={{
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        padding: '20px',
        borderRadius: '10px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
        maxWidth: '1400px',
        width: '100%',
        maxHeight: '95vh',
        display: 'flex',
        flexDirection: 'column',
        border: '2px solid rgba(192, 192, 192, 0.3)',
        boxSizing: 'border-box'
      }}>
        <h1 style={{ textAlign: 'center', marginBottom: '4px', fontSize: '22px', color: '#e0e0e0' }}>Multiplayer Lobby</h1>
        <h3 style={{ textAlign: 'center', marginBottom: '10px', color: '#b0b0b0', fontSize: '13px' }}>
          Room Code: <span style={{ color: '#e0e0e0', fontFamily: 'monospace', fontSize: '18px', letterSpacing: '3px' }}>{roomCode}</span>
        </h3>

        <div style={{ flex: 1, marginBottom: '10px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ display: 'flex', gap: '12px', flex: 1, minHeight: 0 }}>
          {/* Your Hero Selection */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
            <div style={{
              padding: '8px',
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '8px',
              border: '3px solid #3498db',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0
            }}>
              <h3 style={{ marginBottom: '6px', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px', color: '#e0e0e0' }}>
                You {playerRole === 'player1' ? '(South)' : '(North)'} {isHost && '👑'}
                <div style={{
                  width: '20px',
                  height: '20px',
                  backgroundColor: myColor,
                  border: '2px solid #2c3e50',
                  borderRadius: '50%'
                }} title={`Color: ${myColor}`} />
              </h3>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '15px', color: '#e0e0e0' }}>Choose Your Hero:</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px', flex: 1, alignContent: 'start' }}>
                  {heroOptions.map(hero => (
                    <div
                      key={hero.id}
                      onClick={() => handleHeroChange(hero.id)}
                      style={{
                        padding: '8px',
                        border: myHero === hero.id ? '3px solid #3498db' : '2px solid #95a5a6',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        backgroundColor: myHero === hero.id ? 'rgba(52, 152, 219, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                        textAlign: 'center',
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column'
                      }}
                    >
                      <img
                        src={`${process.env.PUBLIC_URL}/sprites/${hero.portraitImage}`}
                        alt={hero.name}
                        style={{ width: '100%', height: 'auto', aspectRatio: '1', marginBottom: '6px', imageRendering: 'pixelated' }}
                      />
                      <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '3px', color: '#e0e0e0' }}>{hero.name}</div>
                      <div style={{ fontSize: '11px', color: '#b0b0b0', lineHeight: '1.3' }}>{hero.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Middle Column - Game Settings */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Map Size Selection - Only show for 2-player games */}
            {(lobbyState.playerCount || 2) === 2 ? (
              <div style={{
                padding: '12px',
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                borderRadius: '8px'
              }}>
                <h3 style={{ marginBottom: '10px', fontSize: '17px', color: '#e0e0e0' }}>
                  Map Size {!isHost && '(Host chooses)'}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {mapSizeOptions.map(size => (
                    <button
                      key={size.value}
                      onClick={() => handleMapSizeChange(size.value)}
                      disabled={!isHost}
                      style={{
                        padding: '12px',
                        fontSize: '15px',
                        fontWeight: 'bold',
                        background: lobbyState.mapSize === size.value ? 'linear-gradient(145deg, #8a8a8a, #6a6a6a)' : 'linear-gradient(145deg, #4a4a4a, #2a2a2a)',
                        color: '#e0e0e0',
                        border: lobbyState.mapSize === size.value ? '2px solid #aaa' : '2px solid #666',
                        borderRadius: '5px',
                        cursor: isHost ? 'pointer' : 'not-allowed',
                        opacity: !isHost ? 0.6 : 1,
                        boxShadow: '0 4px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
                        transition: 'all 0.2s'
                      }}
                    >
                      {size.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{
                padding: '12px',
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                borderRadius: '8px'
              }}>
                <h3 style={{ marginBottom: '10px', fontSize: '17px', color: '#e0e0e0' }}>
                  Map Shape
                </h3>
                <div style={{
                  padding: '12px',
                  fontSize: '15px',
                  color: '#b0b0b0',
                  textAlign: 'center'
                }}>
                  {lobbyState.playerCount === 3 && '▲ Triangle Map (3 Players)'}
                  {lobbyState.playerCount === 4 && '◆ Square Map (4 Players)'}
                </div>
              </div>
            )}

            {/* Fog of War Toggle */}
            <div style={{
              padding: '12px',
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ marginBottom: '4px', fontSize: '17px', color: '#e0e0e0' }}>
                    Fog of War {!isHost && '(Host)'}
                  </h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#b0b0b0' }}>
                    {lobbyState.fogOfWar
                      ? 'Limited visibility'
                      : 'Full map visibility'}
                  </p>
                </div>
                <button
                  onClick={handleFogOfWarToggle}
                  disabled={!isHost}
                  style={{
                    padding: '12px 20px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    background: lobbyState.fogOfWar ? 'linear-gradient(145deg, #8a8a8a, #6a6a6a)' : 'linear-gradient(145deg, #4a4a4a, #2a2a2a)',
                    color: '#e0e0e0',
                    border: lobbyState.fogOfWar ? '2px solid #aaa' : '2px solid #666',
                    borderRadius: '5px',
                    cursor: isHost ? 'pointer' : 'not-allowed',
                    opacity: !isHost ? 0.6 : 1,
                    minWidth: '80px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
                    transition: 'all 0.2s'
                  }}
                >
                  {lobbyState.fogOfWar ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>

            {/* Team Selection (only for 3+ player games) */}
            {(lobbyState.playerCount || 2) >= 3 && (
              <div style={{
                padding: '12px',
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                borderRadius: '8px'
              }}>
                <h3 style={{ marginBottom: '8px', fontSize: '17px', color: '#e0e0e0' }}>
                  Your Team
                </h3>
                <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#b0b0b0' }}>
                  Select no team for FFA (free-for-all)
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleTeamChange(null)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      background: !lobbyState[playerRole]?.team ? 'linear-gradient(145deg, #8a8a8a, #6a6a6a)' : 'linear-gradient(145deg, #4a4a4a, #2a2a2a)',
                      color: '#e0e0e0',
                      border: !lobbyState[playerRole]?.team ? '2px solid #aaa' : '2px solid #666',
                      borderRadius: '5px',
                      cursor: 'pointer'
                    }}
                  >
                    FFA
                  </button>
                  <button
                    onClick={() => handleTeamChange('A')}
                    style={{
                      flex: 1,
                      padding: '10px',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      background: lobbyState[playerRole]?.team === 'A' ? 'linear-gradient(145deg, #ff69b4, #ff1493)' : 'linear-gradient(145deg, #4a4a4a, #2a2a2a)',
                      color: lobbyState[playerRole]?.team === 'A' ? '#000' : '#e0e0e0',
                      border: lobbyState[playerRole]?.team === 'A' ? '2px solid #ff69b4' : '2px solid #666',
                      borderRadius: '5px',
                      cursor: 'pointer'
                    }}
                  >
                    Team A
                  </button>
                  <button
                    onClick={() => handleTeamChange('B')}
                    style={{
                      flex: 1,
                      padding: '10px',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      background: lobbyState[playerRole]?.team === 'B' ? 'linear-gradient(145deg, #333, #111)' : 'linear-gradient(145deg, #4a4a4a, #2a2a2a)',
                      color: '#fff',
                      border: lobbyState[playerRole]?.team === 'B' ? '2px solid #333' : '2px solid #666',
                      borderRadius: '5px',
                      cursor: 'pointer'
                    }}
                  >
                    Team B
                  </button>
                </div>
              </div>
            )}

            {/* Player Status */}
            <div style={{
              padding: '12px',
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '8px'
            }}>
              <h3 style={{ marginBottom: '8px', fontSize: '17px', color: '#e0e0e0' }}>
                Players ({getJoinedPlayers().length}/{lobbyState.playerCount || 2})
              </h3>
              <div style={{ fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {/* Player 1 (Host) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: lobbyState.player1?.id ? '#27ae60' : '#e67e22' }}>
                    {lobbyState.player1?.id ? '✓' : '○'}
                  </span>
                  <span style={{ color: '#e0e0e0' }}>P1 (Host)</span>
                  {lobbyState.player1?.team && (
                    <span style={{
                      padding: '2px 6px',
                      borderRadius: '3px',
                      fontSize: '11px',
                      backgroundColor: lobbyState.player1.team === 'A' ? '#ff69b4' : '#333',
                      color: lobbyState.player1.team === 'A' ? '#000' : '#fff'
                    }}>
                      {lobbyState.player1.team}
                    </span>
                  )}
                </div>
                {/* Player 2 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: lobbyState.player2?.id ? '#27ae60' : '#e67e22' }}>
                    {lobbyState.player2?.id ? (lobbyState.player2?.ready ? '✓' : '○') : '○'}
                  </span>
                  <span style={{ color: lobbyState.player2?.id ? '#e0e0e0' : '#888' }}>
                    P2 {lobbyState.player2?.id ? (lobbyState.player2?.ready ? '(Ready)' : '') : '(Waiting...)'}
                  </span>
                  {lobbyState.player2?.team && (
                    <span style={{
                      padding: '2px 6px',
                      borderRadius: '3px',
                      fontSize: '11px',
                      backgroundColor: lobbyState.player2.team === 'A' ? '#ff69b4' : '#333',
                      color: lobbyState.player2.team === 'A' ? '#000' : '#fff'
                    }}>
                      {lobbyState.player2.team}
                    </span>
                  )}
                </div>
                {/* Player 3 (if applicable) */}
                {(lobbyState.playerCount || 2) >= 3 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: lobbyState.player3?.id ? '#27ae60' : '#e67e22' }}>
                      {lobbyState.player3?.id ? (lobbyState.player3?.ready ? '✓' : '○') : '○'}
                    </span>
                    <span style={{ color: lobbyState.player3?.id ? '#e0e0e0' : '#888' }}>
                      P3 {lobbyState.player3?.id ? (lobbyState.player3?.ready ? '(Ready)' : '') : '(Waiting...)'}
                    </span>
                    {lobbyState.player3?.team && (
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: '3px',
                        fontSize: '11px',
                        backgroundColor: lobbyState.player3.team === 'A' ? '#ff69b4' : '#333',
                        color: lobbyState.player3.team === 'A' ? '#000' : '#fff'
                      }}>
                        {lobbyState.player3.team}
                      </span>
                    )}
                  </div>
                )}
                {/* Player 4 (if applicable) */}
                {(lobbyState.playerCount || 2) >= 4 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: lobbyState.player4?.id ? '#27ae60' : '#e67e22' }}>
                      {lobbyState.player4?.id ? (lobbyState.player4?.ready ? '✓' : '○') : '○'}
                    </span>
                    <span style={{ color: lobbyState.player4?.id ? '#e0e0e0' : '#888' }}>
                      P4 {lobbyState.player4?.id ? (lobbyState.player4?.ready ? '(Ready)' : '') : '(Waiting...)'}
                    </span>
                    {lobbyState.player4?.team && (
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: '3px',
                        fontSize: '11px',
                        backgroundColor: lobbyState.player4.team === 'A' ? '#ff69b4' : '#333',
                        color: lobbyState.player4.team === 'A' ? '#000' : '#fff'
                      }}>
                        {lobbyState.player4.team}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Info */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{
              padding: '12px',
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '8px',
              border: '3px solid #e74c3c'
            }}>
              <h3 style={{ marginBottom: '10px', fontSize: '17px', color: '#e0e0e0' }}>
                How to Play
              </h3>
              <div style={{ fontSize: '13px', color: '#b0b0b0', lineHeight: '1.5' }}>
                <p style={{ margin: '0 0 8px 0' }}>1. Choose your hero</p>
                <p style={{ margin: '0 0 8px 0' }}>2. Wait for opponent to join</p>
                <p style={{ margin: '0 0 8px 0' }}>3. {isHost ? 'Start the game!' : 'Wait for host to start'}</p>
                <p style={{ margin: '0', marginTop: '12px', padding: '10px', backgroundColor: 'rgba(0, 0, 0, 0.3)', borderRadius: '4px', fontSize: '12px' }}>
                  Share room code <strong style={{ color: '#e0e0e0' }}>{roomCode}</strong> with your friend!
                </p>
              </div>
            </div>
          </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onBack}
            style={{
              flex: 1,
              padding: '12px',
              fontSize: '16px',
              fontWeight: 'bold',
              background: 'linear-gradient(145deg, #4a4a4a, #2a2a2a)',
              color: '#e0e0e0',
              border: '2px solid #666',
              borderRadius: '5px',
              cursor: 'pointer',
              boxShadow: '0 4px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
              transition: 'all 0.2s'
            }}
          >
            Back
          </button>

          <button
            onClick={isHost ? handleStartGame : handleReady}
            disabled={isHost && (!allPlayersJoined() || !allPlayersReady())}
            style={{
              flex: 2,
              padding: '12px',
              fontSize: '16px',
              fontWeight: 'bold',
              background: (isHost && (!allPlayersJoined() || !allPlayersReady())) ? 'linear-gradient(145deg, #3a3a3a, #2a2a2a)' : 'linear-gradient(145deg, #4a4a4a, #2a2a2a)',
              color: '#e0e0e0',
              border: '2px solid #666',
              borderRadius: '5px',
              cursor: (isHost && (!allPlayersJoined() || !allPlayersReady())) ? 'not-allowed' : 'pointer',
              opacity: (isHost && (!allPlayersJoined() || !allPlayersReady())) ? 0.6 : 1,
              boxShadow: '0 4px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
              transition: 'all 0.2s'
            }}
          >
            {isHost
              ? (!allPlayersJoined() ? `Waiting for players (${getJoinedPlayers().length}/${lobbyState.playerCount || 2})...` : (!allPlayersReady() ? 'Waiting for players to ready...' : 'Start Game'))
              : (lobbyState[playerRole]?.ready ? 'Unready' : 'Ready')
            }
          </button>
        </div>

        <div style={{
          marginTop: '6px',
          padding: '6px',
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          borderRadius: '5px',
          fontSize: '10px',
          color: '#ccc',
          border: '1px solid rgba(192, 192, 192, 0.2)',
          textAlign: 'center'
        }}>
          <strong>Multiplayer Mode:</strong> Share your room code with a friend to play together!
        </div>
      </div>
    </div>
  );
}

export default GameLobby;
