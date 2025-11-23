import React, { useState, useEffect } from 'react';
import { createOrJoinGameRoom, cleanupOldRooms } from './multiplayerUtils';

function MultiplayerMenu({ onStartGame, onEnterLobby, onEnterLocalSetup, onEnterAISetup, onEnterOnlineMultiplayer }) {
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);

  // Clean up old rooms when component mounts
  useEffect(() => {
    const cleanup = async () => {
      try {
        // Clean up rooms older than 24 hours
        const result = await cleanupOldRooms(24);
        if (result.deleted > 0) {
          console.log(`Cleaned up ${result.deleted} old rooms`);
        }
      } catch (error) {
        console.error('Error cleaning up old rooms:', error);
      }
    };
    cleanup();
  }, []);

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

  const handleOnlineMultiplayer = () => {
    // Navigate to online multiplayer lobby (host/join selection)
    onEnterOnlineMultiplayer();
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
        maxWidth: '400px',
        width: '100%',
        border: '2px solid rgba(192, 192, 192, 0.3)'
      }}>
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
          Versus AI
        </button>

        {/* Online Multiplayer */}
        <button
          onClick={handleOnlineMultiplayer}
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
          Online Multiplayer
        </button>

        {/* Local Game */}
        <button
          onClick={handleLocalGame}
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
          Local Game (Hot Seat)
        </button>

        <div style={{
          marginTop: '5px',
          padding: '12px',
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          borderRadius: '5px',
          fontSize: '12px',
          color: '#ccc',
          border: '1px solid rgba(192, 192, 192, 0.2)',
          textAlign: 'center'
        }}>
          Choose your game mode to begin your ant empire!
        </div>
      </div>
    </div>
  );
}

export default MultiplayerMenu;
