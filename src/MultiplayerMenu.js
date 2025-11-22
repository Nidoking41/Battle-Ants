import React, { useState } from 'react';
import { createOrJoinGameRoom } from './multiplayerUtils';

function MultiplayerMenu({ onStartGame, onEnterLobby, onEnterLocalSetup, onEnterAISetup }) {
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
      const playerId = `player_${Date.now()}`;

      // Don't create game state here - that happens in the lobby
      // Just determine the player role
      const { playerRole, isNewRoom } = await createOrJoinGameRoom(
        roomCode,
        null, // No initial state needed yet
        playerId
      );

      if (isNewRoom) {
        alert(`Room ${roomCode} created! Share this code with your opponent.`);
      } else {
        alert(`Joined room ${roomCode}!`);
      }

      // Enter lobby instead of starting game
      onEnterLobby({
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
      const playerId = `player_${Date.now()}`;

      // Don't create game state here - that happens in the lobby
      await createOrJoinGameRoom(code, null, playerId);

      alert(`Room ${code} created! Share this code with your opponent.`);

      // Enter lobby instead of starting game
      onEnterLobby({
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
    // Navigate to local game setup screen
    onEnterLocalSetup();
  };

  const handleAIGame = () => {
    // Navigate to AI game setup screen
    onEnterAISetup();
  };

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
      <div style={{
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        padding: '25px',
        borderRadius: '10px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
        maxWidth: '400px',
        width: '100%',
        border: '2px solid rgba(192, 192, 192, 0.3)'
      }}>
        <h2 style={{ marginBottom: '30px', textAlign: 'center', color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>Choose Game Mode</h2>

        {/* AI Game */}
        <button
          onClick={handleAIGame}
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
          ⚙️ Versus AI
        </button>

        {/* Local Game */}
        <button
          onClick={handleLocalGame}
          style={{
            width: '100%',
            padding: '15px',
            fontSize: '18px',
            marginBottom: '30px',
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
          🖥️ Local Game (Hot Seat)
        </button>

        <div style={{
          borderTop: '2px solid rgba(192, 192, 192, 0.3)',
          paddingTop: '30px',
          marginBottom: '30px'
        }}>
          <h3 style={{ marginBottom: '20px', textAlign: 'center', color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>Online Multiplayer</h3>

          {/* Quick Play */}
          <button
            onClick={handleQuickPlay}
            disabled={loading}
            style={{
              width: '100%',
              padding: '15px',
              fontSize: '18px',
              marginBottom: '20px',
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
            ⚡ Quick Play (Create Room)
          </button>

          <div style={{
            textAlign: 'center',
            margin: '20px 0',
            color: '#ccc',
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
              color: '#e0e0e0'
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
                border: '2px solid #666',
                borderRadius: '5px',
                marginBottom: '10px',
                letterSpacing: '8px',
                fontWeight: 'bold',
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)'
              }}
            />
            <button
              onClick={handleJoinWithCode}
              disabled={loading || roomCode.length !== 4}
              style={{
                width: '100%',
                padding: '15px',
                fontSize: '18px',
                background: (loading || roomCode.length !== 4) ? 'linear-gradient(145deg, #3a3a3a, #2a2a2a)' : 'linear-gradient(145deg, #4a4a4a, #2a2a2a)',
                color: '#e0e0e0',
                border: '2px solid #666',
                borderRadius: '5px',
                cursor: (loading || roomCode.length !== 4) ? 'not-allowed' : 'pointer',
                opacity: (loading || roomCode.length !== 4) ? 0.6 : 1,
                fontWeight: 'bold',
                boxShadow: '0 4px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                if (!loading && roomCode.length === 4) {
                  e.target.style.background = 'linear-gradient(145deg, #5a5a5a, #3a3a3a)';
                  e.target.style.borderColor = '#888';
                }
              }}
              onMouseOut={(e) => {
                if (!loading && roomCode.length === 4) {
                  e.target.style.background = 'linear-gradient(145deg, #4a4a4a, #2a2a2a)';
                  e.target.style.borderColor = '#666';
                }
              }}
            >
              {loading ? 'Joining...' : '🚪 Join/Create Room'}
            </button>
          </div>
        </div>

        <div style={{
          marginTop: '30px',
          padding: '15px',
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          borderRadius: '5px',
          fontSize: '13px',
          color: '#e0e0e0',
          border: '1px solid rgba(192, 192, 192, 0.2)'
        }}>
          <strong>💡 Tip:</strong> Share your 4-digit room code with a friend to play together!
        </div>
      </div>
    </div>
  );
}

export default MultiplayerMenu;
