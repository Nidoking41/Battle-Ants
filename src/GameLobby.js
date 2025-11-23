import React, { useState, useEffect } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { database } from './firebaseConfig';
import { HeroQueens } from './heroQueens';

function GameLobby({ roomCode, playerId, playerRole, onStartGame, onBack }) {
  const [lobbyState, setLobbyState] = useState({
    player1: {
      id: null,
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

  const isHost = playerRole === 'player1';
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
        // Join as player 2
        const { get } = await import('firebase/database');
        const snapshot = await get(lobbyRef);

        if (snapshot.exists()) {
          const data = snapshot.val();
          // Only update if we're not already player 2
          if (!data.player2 || data.player2.id !== playerId) {
            update(lobbyRef, {
              [`player2/id`]: playerId,
              [`player2/color`]: data.player2?.color || '#0000FF',
              [`player2/ready`]: data.player2?.ready || false
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
          // Calculate the correct player 2 color using actual sprite colors
          let actualPlayer2Color;
          if (data.player1.hero === data.player2.hero) {
            const player1Color = heroColors[data.player1.hero];
            actualPlayer2Color = availableColors.find(color => color !== player1Color) || availableColors[0];
          } else {
            actualPlayer2Color = heroColors[data.player2.hero];
          }

          onStartGame({
            gameId: roomCode,
            playerId,
            playerRole,
            isMultiplayer: true,
            mapSize: data.mapSize,
            fogOfWar: data.fogOfWar !== undefined ? data.fogOfWar : true,
            player1Color: data.player1.color,
            player2Color: actualPlayer2Color,
            player1Hero: data.player1.hero,
            player2Hero: data.player2.hero
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

  const handleReady = () => {
    const lobbyRef = ref(database, `lobbies/${roomCode}`);
    update(lobbyRef, {
      [`${playerRole}/ready`]: !lobbyState[playerRole].ready
    });
  };

  const handleStartGame = () => {
    if (!isHost) return;
    if (!opponentJoined) {
      alert('Waiting for opponent to join!');
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
        padding: '12px',
        borderRadius: '10px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
        maxWidth: '1200px',
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

        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '10px' }}>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '10px' }}>
          {/* Your Hero Selection */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{
              padding: '8px',
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '8px',
              border: '3px solid #3498db'
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
              <div style={{ marginTop: '6px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px', color: '#e0e0e0' }}>Choose Your Hero:</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
                  {heroOptions.map(hero => (
                    <div
                      key={hero.id}
                      onClick={() => handleHeroChange(hero.id)}
                      style={{
                        width: '120px',
                        padding: '6px',
                        border: myHero === hero.id ? '3px solid #3498db' : '2px solid #95a5a6',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        backgroundColor: myHero === hero.id ? 'rgba(52, 152, 219, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                        textAlign: 'center',
                        transition: 'all 0.2s'
                      }}
                    >
                      <img
                        src={`${process.env.PUBLIC_URL}/sprites/${hero.portraitImage}`}
                        alt={hero.name}
                        style={{ width: '100%', height: 'auto', aspectRatio: '1', marginBottom: '4px', imageRendering: 'pixelated' }}
                      />
                      <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '2px', color: '#e0e0e0' }}>{hero.name}</div>
                      <div style={{ fontSize: '10px', color: '#b0b0b0', lineHeight: '1.2' }}>{hero.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Middle Column - Game Settings */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Map Size Selection */}
            <div style={{
              padding: '8px',
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '8px'
            }}>
              <h3 style={{ marginBottom: '6px', fontSize: '15px', color: '#e0e0e0' }}>
                Map Size {!isHost && '(Host chooses)'}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {mapSizeOptions.map(size => (
                  <button
                    key={size.value}
                    onClick={() => handleMapSizeChange(size.value)}
                    disabled={!isHost}
                    style={{
                      padding: '8px',
                      fontSize: '13px',
                      fontWeight: 'bold',
                      background: lobbyState.mapSize === size.value ? 'linear-gradient(145deg, #5a5a5a, #3a3a3a)' : 'linear-gradient(145deg, #4a4a4a, #2a2a2a)',
                      color: '#e0e0e0',
                      border: '2px solid #666',
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

            {/* Fog of War Toggle */}
            <div style={{
              padding: '8px',
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ marginBottom: '2px', fontSize: '15px', color: '#e0e0e0' }}>
                    Fog of War {!isHost && '(Host)'}
                  </h3>
                  <p style={{ margin: 0, fontSize: '11px', color: '#b0b0b0' }}>
                    {lobbyState.fogOfWar
                      ? 'Limited visibility'
                      : 'Full map visibility'}
                  </p>
                </div>
                <button
                  onClick={handleFogOfWarToggle}
                  disabled={!isHost}
                  style={{
                    padding: '8px 16px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    background: lobbyState.fogOfWar ? 'linear-gradient(145deg, #5a5a5a, #3a3a3a)' : 'linear-gradient(145deg, #4a4a4a, #2a2a2a)',
                    color: '#e0e0e0',
                    border: '2px solid #666',
                    borderRadius: '5px',
                    cursor: isHost ? 'pointer' : 'not-allowed',
                    opacity: !isHost ? 0.6 : 1,
                    minWidth: '70px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
                    transition: 'all 0.2s'
                  }}
                >
                  {lobbyState.fogOfWar ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>

            {/* Opponent Status */}
            <div style={{
              padding: '8px',
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '8px'
            }}>
              <h3 style={{ marginBottom: '6px', fontSize: '15px', color: '#e0e0e0' }}>
                Opponent
              </h3>
              <div style={{ fontSize: '13px', color: '#b0b0b0' }}>
                {opponentJoined ? (
                  <div style={{ color: '#27ae60', fontWeight: 'bold' }}>✓ Opponent Connected</div>
                ) : (
                  <div style={{ color: '#e67e22' }}>Waiting for opponent...</div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Info */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{
              padding: '8px',
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '8px',
              border: '3px solid #e74c3c'
            }}>
              <h3 style={{ marginBottom: '6px', fontSize: '15px', color: '#e0e0e0' }}>
                How to Play
              </h3>
              <div style={{ fontSize: '11px', color: '#b0b0b0', lineHeight: '1.4' }}>
                <p style={{ margin: '0 0 6px 0' }}>1. Choose your hero</p>
                <p style={{ margin: '0 0 6px 0' }}>2. Wait for opponent to join</p>
                <p style={{ margin: '0 0 6px 0' }}>3. {isHost ? 'Start the game!' : 'Wait for host to start'}</p>
                <p style={{ margin: '0', marginTop: '8px', padding: '6px', backgroundColor: 'rgba(0, 0, 0, 0.3)', borderRadius: '4px', fontSize: '10px' }}>
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
            disabled={isHost && !opponentJoined}
            style={{
              flex: 2,
              padding: '12px',
              fontSize: '16px',
              fontWeight: 'bold',
              background: (isHost && !opponentJoined) ? 'linear-gradient(145deg, #3a3a3a, #2a2a2a)' : 'linear-gradient(145deg, #4a4a4a, #2a2a2a)',
              color: '#e0e0e0',
              border: '2px solid #666',
              borderRadius: '5px',
              cursor: (isHost && !opponentJoined) ? 'not-allowed' : 'pointer',
              opacity: (isHost && !opponentJoined) ? 0.6 : 1,
              boxShadow: '0 4px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
              transition: 'all 0.2s'
            }}
          >
            {isHost
              ? (opponentJoined ? 'Start Game' : 'Waiting for opponent...')
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
