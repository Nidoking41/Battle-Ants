import React, { useState } from 'react';
import { createOrJoinGameRoom } from './multiplayerUtils';

function MultiplayerMenu({ onStartGame }) {
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);

  // Generate a random 4-digit code
  const generateRoomCode = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
  };

  const handleJoinWithCode = async () => {
    if (!roomCode || roomCode.length !== 4 || !/^\d+$/.test(roomCode)) {
      alert('Please enter a valid 4-digit room code');
      return;
    }

    setLoading(true);
    try {
      const { createInitialGameState } = await import('./gameState');
      const initialState = createInitialGameState();
      const playerId = `player_${Date.now()}`;

      const { playerRole, isNewRoom } = await createOrJoinGameRoom(
        roomCode,
        initialState,
        playerId
      );

      if (isNewRoom) {
        alert(`Room ${roomCode} created! Share this code with your opponent.`);
      } else {
        alert(`Joined room ${roomCode}!`);
      }

      onStartGame({
        gameId: roomCode,
        playerId,
        playerRole,
        isMultiplayer: true
      });
    } catch (error) {
      alert('Error: ' + error.message);
      console.error('Full error:', error);
    }
    setLoading(false);
  };

  const handleQuickPlay = async () => {
    const code = generateRoomCode();
    setRoomCode(code);

    setLoading(true);
    try {
      const { createInitialGameState } = await import('./gameState');
      const initialState = createInitialGameState();
      const playerId = `player_${Date.now()}`;

      await createOrJoinGameRoom(code, initialState, playerId);

      alert(`Room ${code} created! Share this code with your opponent.`);

      onStartGame({
        gameId: code,
        playerId,
        playerRole: 'player1',
        isMultiplayer: true
      });
    } catch (error) {
      alert('Error: ' + error.message);
      console.error('Full error:', error);
    }
    setLoading(false);
  };

  const handleLocalGame = () => {
    onStartGame({
      gameId: null,
      playerId: null,
      playerRole: 'player1',
      isMultiplayer: false
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
      <h1 style={{ marginBottom: '40px' }}>🐜 Ant Colony Battler</h1>

      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '10px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        maxWidth: '500px',
        width: '100%'
      }}>
        <h2 style={{ marginBottom: '30px', textAlign: 'center' }}>Choose Game Mode</h2>

        {/* Local Game */}
        <button
          onClick={handleLocalGame}
          style={{
            width: '100%',
            padding: '15px',
            fontSize: '18px',
            marginBottom: '30px',
            backgroundColor: '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          🖥️ Local Game (Hot Seat)
        </button>

        <div style={{
          borderTop: '2px solid #ecf0f1',
          paddingTop: '30px',
          marginBottom: '30px'
        }}>
          <h3 style={{ marginBottom: '20px', textAlign: 'center' }}>Online Multiplayer</h3>

          {/* Quick Play */}
          <button
            onClick={handleQuickPlay}
            disabled={loading}
            style={{
              width: '100%',
              padding: '15px',
              fontSize: '18px',
              marginBottom: '20px',
              backgroundColor: '#2ecc71',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              fontWeight: 'bold'
            }}
          >
            ⚡ Quick Play (Create Room)
          </button>

          <div style={{
            textAlign: 'center',
            margin: '20px 0',
            color: '#95a5a6',
            fontSize: '14px',
            fontWeight: 'bold'
          }}>
            OR
          </div>

          {/* Join with Code */}
          <div style={{ marginTop: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '10px',
              fontWeight: 'bold',
              color: '#34495e'
            }}>
              Enter 4-Digit Room Code:
            </label>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="0000"
              maxLength="4"
              style={{
                width: '100%',
                padding: '15px',
                fontSize: '24px',
                textAlign: 'center',
                border: '2px solid #bdc3c7',
                borderRadius: '5px',
                marginBottom: '10px',
                letterSpacing: '8px',
                fontWeight: 'bold'
              }}
            />
            <button
              onClick={handleJoinWithCode}
              disabled={loading || roomCode.length !== 4}
              style={{
                width: '100%',
                padding: '15px',
                fontSize: '18px',
                backgroundColor: roomCode.length === 4 ? '#9b59b6' : '#95a5a6',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: (loading || roomCode.length !== 4) ? 'not-allowed' : 'pointer',
                fontWeight: 'bold'
              }}
            >
              {loading ? 'Joining...' : '🚪 Join/Create Room'}
            </button>
          </div>
        </div>

        <div style={{
          marginTop: '30px',
          padding: '15px',
          backgroundColor: '#ecf0f1',
          borderRadius: '5px',
          fontSize: '13px',
          color: '#7f8c8d'
        }}>
          <strong>💡 Tip:</strong> Share your 4-digit room code with a friend to play together!
        </div>
      </div>
    </div>
  );
}

export default MultiplayerMenu;
