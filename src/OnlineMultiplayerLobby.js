import React, { useState, useEffect } from 'react';
import { createLobbyWithMetadata, joinLobbyWithPassword, getAvailableLobbies } from './multiplayerUtils';
import { ref, onValue } from 'firebase/database';
import { database } from './firebaseConfig';

function OnlineMultiplayerLobby({ onEnterGameLobby, onBack }) {
  const [view, setView] = useState('main'); // 'main', 'host', 'browse'
  const [loading, setLoading] = useState(false);

  // Host game state
  const [gameName, setGameName] = useState('');
  const [password, setPassword] = useState('');
  const [usePassword, setUsePassword] = useState(false);

  // Browse games state
  const [availableGames, setAvailableGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);
  const [passwordInput, setPasswordInput] = useState('');

  // Generate a random 4-digit code
  const generateRoomCode = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
  };

  // Load available games when browsing
  useEffect(() => {
    if (view === 'browse') {
      loadAvailableGames();

      // Set up real-time listener for lobbies
      const lobbiesRef = ref(database, 'lobbies');
      const unsubscribe = onValue(lobbiesRef, () => {
        loadAvailableGames();
      });

      return () => unsubscribe();
    }
  }, [view]);

  const loadAvailableGames = async () => {
    try {
      const games = await getAvailableLobbies();
      setAvailableGames(games);
    } catch (error) {
      console.error('Error loading games:', error);
    }
  };

  const handleHostGame = async () => {
    if (!gameName.trim()) {
      alert('Please enter a game name');
      return;
    }

    if (usePassword && !password.trim()) {
      alert('Please enter a password or uncheck "Password Protected"');
      return;
    }

    setLoading(true);
    try {
      const code = generateRoomCode();
      const playerId = `player_${Date.now()}`;

      // Create lobby with metadata
      await createLobbyWithMetadata(code, playerId, {
        gameName: gameName.trim(),
        password: usePassword ? password.trim() : null
      });

      // Enter lobby as host
      onEnterGameLobby({
        gameId: code,
        playerId,
        playerRole: 'player1',
        isHost: true,
        isMultiplayer: true
      });
    } catch (error) {
      alert('Error creating game: ' + error.message);
      console.error('Full error:', error);
    }
    setLoading(false);
  };

  const handleJoinGame = async (game) => {
    if (game.hasPassword && !selectedGame) {
      // Show password input
      setSelectedGame(game);
      return;
    }

    setLoading(true);
    try {
      const playerId = `player_${Date.now()}`;
      const pwd = game.hasPassword ? passwordInput : null;

      // Join lobby with password if needed
      const { playerRole, isHost } = await joinLobbyWithPassword(
        game.roomCode,
        playerId,
        pwd
      );

      // Enter lobby as guest
      onEnterGameLobby({
        gameId: game.roomCode,
        playerId,
        playerRole,
        isHost,
        isMultiplayer: true
      });
    } catch (error) {
      alert('Error joining game: ' + error.message);
      console.error('Full error:', error);
      setPasswordInput('');
      setSelectedGame(null);
    }
    setLoading(false);
  };

  const formatTimeAgo = (timestamp) => {
    const minutes = Math.floor((Date.now() - timestamp) / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes === 1) return '1 minute ago';
    if (minutes < 60) return `${minutes} minutes ago`;
    return `${Math.floor(minutes / 60)} hours ago`;
  };

  const renderMainView = () => (
    <>
      <h2 style={{
        textAlign: 'center',
        marginTop: 0,
        marginBottom: '20px',
        color: '#e0e0e0',
        fontSize: '24px'
      }}>
        Online Multiplayer
      </h2>

      {/* Host Game Button */}
      <button
        onClick={() => setView('host')}
        style={{
          width: '100%',
          padding: '15px',
          fontSize: '18px',
          marginBottom: '15px',
          background: 'linear-gradient(145deg, #4a4a4a, #2a2a2a)',
          color: '#e0e0e0',
          border: '2px solid #666',
          borderRadius: '5px',
          cursor: 'pointer',
          fontWeight: 'bold',
          boxShadow: '0 4px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
          transition: 'all 0.2s'
        }}
        onMouseOver={(e) => {
          e.target.style.background = 'linear-gradient(145deg, #5a5a5a, #3a3a3a)';
          e.target.style.borderColor = '#888';
        }}
        onMouseOut={(e) => {
          e.target.style.background = 'linear-gradient(145deg, #4a4a4a, #2a2a2a)';
          e.target.style.borderColor = '#666';
        }}
      >
        Host Game
      </button>

      {/* Browse Games Button */}
      <button
        onClick={() => setView('browse')}
        style={{
          width: '100%',
          padding: '15px',
          fontSize: '18px',
          marginBottom: '15px',
          background: 'linear-gradient(145deg, #4a4a4a, #2a2a2a)',
          color: '#e0e0e0',
          border: '2px solid #666',
          borderRadius: '5px',
          cursor: 'pointer',
          fontWeight: 'bold',
          boxShadow: '0 4px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
          transition: 'all 0.2s'
        }}
        onMouseOver={(e) => {
          e.target.style.background = 'linear-gradient(145deg, #5a5a5a, #3a3a3a)';
          e.target.style.borderColor = '#888';
        }}
        onMouseOut={(e) => {
          e.target.style.background = 'linear-gradient(145deg, #4a4a4a, #2a2a2a)';
          e.target.style.borderColor = '#666';
        }}
      >
        Browse Games
      </button>

      {/* Back to Main Menu */}
      <button
        onClick={onBack}
        style={{
          width: '100%',
          padding: '12px',
          fontSize: '16px',
          background: 'linear-gradient(145deg, #4a4a4a, #2a2a2a)',
          color: '#e0e0e0',
          border: '2px solid #666',
          borderRadius: '5px',
          cursor: 'pointer',
          fontWeight: 'bold',
          boxShadow: '0 4px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
          transition: 'all 0.2s'
        }}
        onMouseOver={(e) => {
          e.target.style.background = 'linear-gradient(145deg, #5a5a5a, #3a3a3a)';
          e.target.style.borderColor = '#888';
        }}
        onMouseOut={(e) => {
          e.target.style.background = 'linear-gradient(145deg, #4a4a4a, #2a2a2a)';
          e.target.style.borderColor = '#666';
        }}
      >
        Back to Main Menu
      </button>

      <div style={{
        marginTop: '15px',
        padding: '12px',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        borderRadius: '5px',
        fontSize: '12px',
        color: '#ccc',
        border: '1px solid rgba(192, 192, 192, 0.2)',
        textAlign: 'center'
      }}>
        Host a new game or browse available games to join
      </div>
    </>
  );

  const renderHostView = () => (
    <>
      <h2 style={{
        textAlign: 'center',
        marginTop: 0,
        marginBottom: '20px',
        color: '#e0e0e0',
        fontSize: '24px'
      }}>
        Host New Game
      </h2>

      {/* Game Name Input */}
      <div style={{ marginBottom: '15px' }}>
        <label style={{
          display: 'block',
          marginBottom: '8px',
          fontWeight: 'bold',
          color: '#e0e0e0',
          fontSize: '14px'
        }}>
          Game Name:
        </label>
        <input
          type="text"
          value={gameName}
          onChange={(e) => setGameName(e.target.value)}
          placeholder="Enter game name..."
          maxLength="30"
          autoFocus
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '16px',
            border: '2px solid #666',
            borderRadius: '5px',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)',
            boxSizing: 'border-box'
          }}
        />
      </div>

      {/* Password Protection Checkbox */}
      <div style={{ marginBottom: '15px' }}>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          color: '#e0e0e0',
          fontSize: '14px'
        }}>
          <input
            type="checkbox"
            checked={usePassword}
            onChange={(e) => setUsePassword(e.target.checked)}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          />
          Password Protected
        </label>
      </div>

      {/* Password Input (if enabled) */}
      {usePassword && (
        <div style={{ marginBottom: '15px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontWeight: 'bold',
            color: '#e0e0e0',
            fontSize: '14px'
          }}>
            Password:
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password..."
            maxLength="20"
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '16px',
              border: '2px solid #666',
              borderRadius: '5px',
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)',
              boxSizing: 'border-box'
            }}
          />
        </div>
      )}

      {/* Create Button */}
      <button
        onClick={handleHostGame}
        disabled={loading}
        style={{
          width: '100%',
          padding: '12px',
          fontSize: '16px',
          marginBottom: '10px',
          background: loading ? 'linear-gradient(145deg, #3a3a3a, #2a2a2a)' : 'linear-gradient(145deg, #4a4a4a, #2a2a2a)',
          color: '#e0e0e0',
          border: '2px solid #666',
          borderRadius: '5px',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.6 : 1,
          fontWeight: 'bold',
          boxShadow: '0 4px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
          transition: 'all 0.2s'
        }}
        onMouseOver={(e) => {
          if (!loading) {
            e.target.style.background = 'linear-gradient(145deg, #5a5a5a, #3a3a3a)';
            e.target.style.borderColor = '#888';
          }
        }}
        onMouseOut={(e) => {
          if (!loading) {
            e.target.style.background = 'linear-gradient(145deg, #4a4a4a, #2a2a2a)';
            e.target.style.borderColor = '#666';
          }
        }}
      >
        {loading ? 'Creating...' : 'Create Game'}
      </button>

      {/* Back Button */}
      <button
        onClick={() => setView('main')}
        style={{
          width: '100%',
          padding: '10px',
          fontSize: '14px',
          background: 'linear-gradient(145deg, #4a4a4a, #2a2a2a)',
          color: '#e0e0e0',
          border: '2px solid #666',
          borderRadius: '5px',
          cursor: 'pointer',
          fontWeight: 'bold',
          boxShadow: '0 4px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
          transition: 'all 0.2s'
        }}
      >
        Back
      </button>
    </>
  );

  const renderBrowseView = () => (
    <>
      <h2 style={{
        textAlign: 'center',
        marginTop: 0,
        marginBottom: '15px',
        color: '#e0e0e0',
        fontSize: '24px'
      }}>
        Available Games
      </h2>

      {/* Game List */}
      <div style={{
        maxHeight: '400px',
        overflowY: 'auto',
        marginBottom: '15px',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        borderRadius: '8px',
        padding: '10px'
      }}>
        {availableGames.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: '#b0b0b0',
            fontSize: '14px'
          }}>
            No games available. Host a new game to get started!
          </div>
        ) : (
          availableGames.map((game) => (
            <div
              key={game.roomCode}
              style={{
                backgroundColor: selectedGame?.roomCode === game.roomCode ? 'rgba(52, 152, 219, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                padding: '12px',
                marginBottom: '10px',
                borderRadius: '8px',
                border: selectedGame?.roomCode === game.roomCode ? '2px solid #3498db' : '2px solid #666',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onClick={() => {
                if (!game.hasPassword || selectedGame?.roomCode === game.roomCode) {
                  handleJoinGame(game);
                } else {
                  setSelectedGame(game);
                  setPasswordInput('');
                }
              }}
              onMouseOver={(e) => {
                if (selectedGame?.roomCode !== game.roomCode) {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
                  e.currentTarget.style.borderColor = '#888';
                }
              }}
              onMouseOut={(e) => {
                if (selectedGame?.roomCode !== game.roomCode) {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.borderColor = '#666';
                }
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px'
              }}>
                <div style={{
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: '#e0e0e0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  {game.gameName}
                  {game.hasPassword && <span style={{ fontSize: '14px' }}>🔒</span>}
                </div>
                <div style={{
                  fontSize: '12px',
                  color: '#b0b0b0'
                }}>
                  {formatTimeAgo(game.createdAt)}
                </div>
              </div>
              <div style={{
                fontSize: '12px',
                color: '#b0b0b0',
                display: 'flex',
                gap: '15px'
              }}>
                <span>Map: {game.mapSize}</span>
                <span>Fog: {game.fogOfWar ? 'On' : 'Off'}</span>
                <span style={{ fontFamily: 'monospace' }}>#{game.roomCode}</span>
              </div>

              {/* Password Input (if selected and has password) */}
              {selectedGame?.roomCode === game.roomCode && game.hasPassword && (
                <div style={{ marginTop: '10px' }} onClick={(e) => e.stopPropagation()}>
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Enter password..."
                    autoFocus
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleJoinGame(game);
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '8px',
                      fontSize: '14px',
                      border: '2px solid #666',
                      borderRadius: '5px',
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                      boxSizing: 'border-box'
                    }}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleJoinGame(game);
                    }}
                    disabled={loading}
                    style={{
                      width: '100%',
                      marginTop: '8px',
                      padding: '8px',
                      fontSize: '14px',
                      background: 'linear-gradient(145deg, #4a4a4a, #2a2a2a)',
                      color: '#e0e0e0',
                      border: '2px solid #666',
                      borderRadius: '5px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    {loading ? 'Joining...' : 'Join'}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Refresh Button */}
      <button
        onClick={loadAvailableGames}
        style={{
          width: '100%',
          padding: '10px',
          fontSize: '14px',
          marginBottom: '10px',
          background: 'linear-gradient(145deg, #4a4a4a, #2a2a2a)',
          color: '#e0e0e0',
          border: '2px solid #666',
          borderRadius: '5px',
          cursor: 'pointer',
          fontWeight: 'bold',
          boxShadow: '0 4px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
          transition: 'all 0.2s'
        }}
      >
        Refresh
      </button>

      {/* Back Button */}
      <button
        onClick={() => {
          setView('main');
          setSelectedGame(null);
          setPasswordInput('');
        }}
        style={{
          width: '100%',
          padding: '10px',
          fontSize: '14px',
          background: 'linear-gradient(145deg, #4a4a4a, #2a2a2a)',
          color: '#e0e0e0',
          border: '2px solid #666',
          borderRadius: '5px',
          cursor: 'pointer',
          fontWeight: 'bold',
          boxShadow: '0 4px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
          transition: 'all 0.2s'
        }}
      >
        Back
      </button>
    </>
  );

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
      padding: '20px'
    }}>
      {/* Title Image */}
      <img
        src={`${process.env.PUBLIC_URL}/sprites/title_screen_title.png`}
        alt="Ant Wars"
        style={{
          maxWidth: '500px',
          width: '90%',
          marginBottom: '40px',
          marginTop: '-60px',
          filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))'
        }}
      />

      <div style={{
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        padding: '25px',
        borderRadius: '10px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
        maxWidth: view === 'browse' ? '600px' : '400px',
        width: '100%',
        border: '2px solid rgba(192, 192, 192, 0.3)'
      }}>
        {view === 'main' && renderMainView()}
        {view === 'host' && renderHostView()}
        {view === 'browse' && renderBrowseView()}
      </div>
    </div>
  );
}

export default OnlineMultiplayerLobby;
