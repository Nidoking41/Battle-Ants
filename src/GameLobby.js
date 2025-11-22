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

  // Hero options
  const heroOptions = Object.values(HeroQueens);

  const isHost = playerRole === 'player1';
  const myColor = heroColors[playerRole === 'player1' ? lobbyState.player1.hero : lobbyState.player2.hero];
  const opponentColor = heroColors[playerRole === 'player1' ? lobbyState.player2.hero : lobbyState.player1.hero];
  const opponentReady = playerRole === 'player1' ? lobbyState.player2.ready : lobbyState.player1.ready;
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
          onStartGame({
            gameId: roomCode,
            playerId,
            playerRole,
            isMultiplayer: true,
            mapSize: data.mapSize,
            fogOfWar: data.fogOfWar !== undefined ? data.fogOfWar : true,
            player1Color: data.player1.color,
            player2Color: data.player2.color,
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
    update(lobbyRef, {
      [`${playerRole}/hero`]: newHero,
      [`${playerRole}/color`]: heroColors[newHero]
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

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#f0f0f0',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '10px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        maxWidth: '800px',
        width: '100%'
      }}>
        <h1 style={{ textAlign: 'center', marginBottom: '10px' }}>🐜 Game Lobby</h1>
        <h3 style={{ textAlign: 'center', marginBottom: '30px', color: '#7f8c8d' }}>
          Room Code: <span style={{ color: '#2c3e50', fontFamily: 'monospace', fontSize: '28px', letterSpacing: '4px' }}>{roomCode}</span>
        </h3>

        <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
          {/* Player 1 Card */}
          <div style={{
            flex: 1,
            padding: '20px',
            backgroundColor: lobbyState.player1.id ? '#ecf0f1' : '#bdc3c7',
            borderRadius: '8px',
            border: playerRole === 'player1' ? '3px solid #3498db' : 'none'
          }}>
            <h3 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              👤 Player 1 {playerRole === 'player1' && '(You)'}
              {isHost && ' 👑'}
              <div style={{
                width: '20px',
                height: '20px',
                backgroundColor: heroColors[lobbyState.player1.hero],
                border: '2px solid #2c3e50',
                borderRadius: '50%'
              }} title={`Color: ${heroColors[lobbyState.player1.hero]}`} />
            </h3>
            {lobbyState.player1.id ? (
              <>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Choose Your Hero:</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
                    {heroOptions.map(hero => (
                      <div
                        key={hero.id}
                        onClick={() => playerRole === 'player1' && handleHeroChange(hero.id)}
                        style={{
                          width: '100px',
                          padding: '8px',
                          border: lobbyState.player1.hero === hero.id ? '3px solid #3498db' : '2px solid #95a5a6',
                          borderRadius: '8px',
                          cursor: playerRole === 'player1' ? 'pointer' : 'not-allowed',
                          opacity: playerRole !== 'player1' ? 0.7 : 1,
                          backgroundColor: lobbyState.player1.hero === hero.id ? '#e3f2fd' : 'white',
                          textAlign: 'center',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ fontSize: '32px', marginBottom: '4px' }}>{hero.icon}</div>
                        <div style={{ fontSize: '10px', fontWeight: 'bold', marginBottom: '4px' }}>{hero.name}</div>
                        <div style={{ fontSize: '8px', color: '#666', lineHeight: '1.2' }}>{hero.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {lobbyState.player1.ready && (
                  <div style={{ color: '#27ae60', fontWeight: 'bold', fontSize: '18px' }}>
                    ✓ Ready!
                  </div>
                )}
              </>
            ) : (
              <p style={{ color: '#95a5a6', fontStyle: 'italic' }}>Waiting for player...</p>
            )}
          </div>

          {/* Player 2 Card */}
          <div style={{
            flex: 1,
            padding: '20px',
            backgroundColor: lobbyState.player2.id ? '#ecf0f1' : '#bdc3c7',
            borderRadius: '8px',
            border: playerRole === 'player2' ? '3px solid #3498db' : 'none'
          }}>
            <h3 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              👤 Player 2 {playerRole === 'player2' && '(You)'}
              <div style={{
                width: '20px',
                height: '20px',
                backgroundColor: heroColors[lobbyState.player2.hero],
                border: '2px solid #2c3e50',
                borderRadius: '50%'
              }} title={`Color: ${heroColors[lobbyState.player2.hero]}`} />
            </h3>
            {lobbyState.player2.id ? (
              <>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Choose Your Hero:</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
                    {heroOptions.map(hero => (
                      <div
                        key={hero.id}
                        onClick={() => playerRole === 'player2' && handleHeroChange(hero.id)}
                        style={{
                          width: '100px',
                          padding: '8px',
                          border: lobbyState.player2.hero === hero.id ? '3px solid #e74c3c' : '2px solid #95a5a6',
                          borderRadius: '8px',
                          cursor: playerRole === 'player2' ? 'pointer' : 'not-allowed',
                          opacity: playerRole !== 'player2' ? 0.7 : 1,
                          backgroundColor: lobbyState.player2.hero === hero.id ? '#ffebee' : 'white',
                          textAlign: 'center',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ fontSize: '32px', marginBottom: '4px' }}>{hero.icon}</div>
                        <div style={{ fontSize: '10px', fontWeight: 'bold', marginBottom: '4px' }}>{hero.name}</div>
                        <div style={{ fontSize: '8px', color: '#666', lineHeight: '1.2' }}>{hero.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {lobbyState.player2.ready && (
                  <div style={{ color: '#27ae60', fontWeight: 'bold', fontSize: '18px' }}>
                    ✓ Ready!
                  </div>
                )}
              </>
            ) : (
              <p style={{ color: '#95a5a6', fontStyle: 'italic' }}>Waiting for player...</p>
            )}
          </div>
        </div>

        {/* Map Size Selection (Host Only) */}
        <div style={{
          padding: '20px',
          backgroundColor: '#ecf0f1',
          borderRadius: '8px',
          marginBottom: '15px'
        }}>
          <h3 style={{ marginBottom: '15px' }}>
            🗺️ Map Size {!isHost && '(Host decides)'}
          </h3>
          <div style={{ display: 'flex', gap: '10px' }}>
            {mapSizeOptions.map(size => (
              <button
                key={size.value}
                onClick={() => handleMapSizeChange(size.value)}
                disabled={!isHost}
                style={{
                  flex: 1,
                  padding: '15px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  backgroundColor: lobbyState.mapSize === size.value ? '#3498db' : 'white',
                  color: lobbyState.mapSize === size.value ? 'white' : '#2c3e50',
                  border: '2px solid #3498db',
                  borderRadius: '5px',
                  cursor: isHost ? 'pointer' : 'not-allowed',
                  opacity: !isHost ? 0.6 : 1
                }}
              >
                {size.name}
              </button>
            ))}
          </div>
        </div>

        {/* Fog of War Toggle (Host Only) */}
        <div style={{
          padding: '20px',
          backgroundColor: '#ecf0f1',
          borderRadius: '8px',
          marginBottom: '30px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ marginBottom: '5px', fontSize: '18px' }}>
                🌫️ Fog of War {!isHost && '(Host decides)'}
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#7f8c8d' }}>
                {lobbyState.fogOfWar
                  ? 'You can only see areas near your units'
                  : 'Full map visibility (easier)'}
              </p>
            </div>
            <button
              onClick={handleFogOfWarToggle}
              disabled={!isHost}
              style={{
                padding: '12px 24px',
                fontSize: '16px',
                fontWeight: 'bold',
                backgroundColor: lobbyState.fogOfWar ? '#27ae60' : '#95a5a6',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: isHost ? 'pointer' : 'not-allowed',
                minWidth: '90px',
                opacity: !isHost ? 0.6 : 1
              }}
            >
              {lobbyState.fogOfWar ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onBack}
            style={{
              flex: 1,
              padding: '15px',
              fontSize: '18px',
              fontWeight: 'bold',
              backgroundColor: '#95a5a6',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            ← Back
          </button>

          {isHost ? (
            <button
              onClick={handleStartGame}
              disabled={!opponentJoined}
              style={{
                flex: 2,
                padding: '15px',
                fontSize: '18px',
                fontWeight: 'bold',
                backgroundColor: opponentJoined ? '#27ae60' : '#95a5a6',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: opponentJoined ? 'pointer' : 'not-allowed'
              }}
            >
              {opponentJoined ? '🚀 Start Game!' : 'Waiting for opponent...'}
            </button>
          ) : (
            <button
              onClick={handleReady}
              style={{
                flex: 2,
                padding: '15px',
                fontSize: '18px',
                fontWeight: 'bold',
                backgroundColor: lobbyState[playerRole].ready ? '#e67e22' : '#27ae60',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              {lobbyState[playerRole].ready ? '❌ Not Ready' : '✓ Ready!'}
            </button>
          )}
        </div>

        <div style={{
          marginTop: '20px',
          padding: '15px',
          backgroundColor: '#fff3cd',
          borderRadius: '5px',
          fontSize: '13px',
          color: '#856404'
        }}>
          <strong>💡 Tip:</strong> Choose your color and map size. The host can start the game when both players have joined!
        </div>
      </div>
    </div>
  );
}

export default GameLobby;
