import React, { useState } from 'react';

function LocalGameSetup({ onStartGame, onBack }) {
  const [player1Color, setPlayer1Color] = useState('#FF0000');
  const [player2Color, setPlayer2Color] = useState('#0000FF');
  const [mapSize, setMapSize] = useState('large');

  // Color options (only colors with sprite variants)
  const colorOptions = [
    { name: 'Red', value: '#FF0000' },
    { name: 'Blue', value: '#0000FF' },
    { name: 'Green', value: '#00FF00' },
    { name: 'Yellow', value: '#FFFF00' }
  ];

  // Map size options
  const mapSizeOptions = [
    { name: 'Small (7x7)', value: 'small' },
    { name: 'Medium (9x9)', value: 'medium' },
    { name: 'Large (11x11)', value: 'large' }
  ];

  const handleStartGame = () => {
    onStartGame({
      gameId: null,
      playerId: null,
      playerRole: 'player1',
      isMultiplayer: false,
      mapSize,
      player1Color,
      player2Color
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
        <h1 style={{ textAlign: 'center', marginBottom: '10px' }}>🐜 Local Game Setup</h1>
        <h3 style={{ textAlign: 'center', marginBottom: '30px', color: '#7f8c8d' }}>
          Hot Seat (Pass & Play)
        </h3>

        <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
          {/* Player 1 Card */}
          <div style={{
            flex: 1,
            padding: '20px',
            backgroundColor: '#ecf0f1',
            borderRadius: '8px',
            border: '3px solid #e74c3c'
          }}>
            <h3 style={{ marginBottom: '15px' }}>
              👤 Player 1 (South)
            </h3>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Color:</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {colorOptions.map(color => (
                  <button
                    key={color.value}
                    onClick={() => setPlayer1Color(color.value)}
                    disabled={player2Color === color.value}
                    style={{
                      width: '40px',
                      height: '40px',
                      backgroundColor: color.value,
                      border: player1Color === color.value ? '4px solid #2c3e50' : '2px solid #95a5a6',
                      borderRadius: '50%',
                      cursor: player2Color !== color.value ? 'pointer' : 'not-allowed',
                      opacity: player2Color === color.value ? 0.3 : 1
                    }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
            <div style={{
              marginTop: '15px',
              padding: '10px',
              backgroundColor: player1Color,
              borderRadius: '5px',
              textAlign: 'center',
              color: 'white',
              fontWeight: 'bold',
              textShadow: '1px 1px 2px rgba(0,0,0,0.5)'
            }}>
              Preview
            </div>
          </div>

          {/* Player 2 Card */}
          <div style={{
            flex: 1,
            padding: '20px',
            backgroundColor: '#ecf0f1',
            borderRadius: '8px',
            border: '3px solid #3498db'
          }}>
            <h3 style={{ marginBottom: '15px' }}>
              👤 Player 2 (North)
            </h3>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Color:</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {colorOptions.map(color => (
                  <button
                    key={color.value}
                    onClick={() => setPlayer2Color(color.value)}
                    disabled={player1Color === color.value}
                    style={{
                      width: '40px',
                      height: '40px',
                      backgroundColor: color.value,
                      border: player2Color === color.value ? '4px solid #2c3e50' : '2px solid #95a5a6',
                      borderRadius: '50%',
                      cursor: player1Color !== color.value ? 'pointer' : 'not-allowed',
                      opacity: player1Color === color.value ? 0.3 : 1
                    }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
            <div style={{
              marginTop: '15px',
              padding: '10px',
              backgroundColor: player2Color,
              borderRadius: '5px',
              textAlign: 'center',
              color: 'white',
              fontWeight: 'bold',
              textShadow: '1px 1px 2px rgba(0,0,0,0.5)'
            }}>
              Preview
            </div>
          </div>
        </div>

        {/* Map Size Selection */}
        <div style={{
          padding: '20px',
          backgroundColor: '#ecf0f1',
          borderRadius: '8px',
          marginBottom: '30px'
        }}>
          <h3 style={{ marginBottom: '15px' }}>
            🗺️ Map Size
          </h3>
          <div style={{ display: 'flex', gap: '10px' }}>
            {mapSizeOptions.map(size => (
              <button
                key={size.value}
                onClick={() => setMapSize(size.value)}
                style={{
                  flex: 1,
                  padding: '15px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  backgroundColor: mapSize === size.value ? '#3498db' : 'white',
                  color: mapSize === size.value ? 'white' : '#2c3e50',
                  border: '2px solid #3498db',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                {size.name}
              </button>
            ))}
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

          <button
            onClick={handleStartGame}
            style={{
              flex: 2,
              padding: '15px',
              fontSize: '18px',
              fontWeight: 'bold',
              backgroundColor: '#27ae60',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            🚀 Start Game!
          </button>
        </div>

        <div style={{
          marginTop: '20px',
          padding: '15px',
          backgroundColor: '#d1ecf1',
          borderRadius: '5px',
          fontSize: '13px',
          color: '#0c5460'
        }}>
          <strong>💡 Hot Seat Mode:</strong> Take turns playing on the same device. Pass the device to the other player when it's their turn!
        </div>
      </div>
    </div>
  );
}

export default LocalGameSetup;
