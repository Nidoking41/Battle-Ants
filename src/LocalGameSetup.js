import React, { useState } from 'react';
import { HeroQueens } from './heroQueens';

function LocalGameSetup({ onStartGame, onBack }) {
  const [mapSize, setMapSize] = useState('large');
  const [player1Hero, setPlayer1Hero] = useState('gorlak');
  const [player2Hero, setPlayer2Hero] = useState('sorlorg');

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
    if (player1Hero === player2Hero) {
      // Same hero selected, use an alternative sprite color
      const player1Color = heroColors[player1Hero];
      // Find first available color that's different from player 1
      const alternativeColor = availableColors.find(color => color !== player1Color);
      return alternativeColor || availableColors[0];
    }
    return heroColors[player2Hero];
  };

  // Hero options
  const heroOptions = Object.values(HeroQueens);

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
      player1Color: heroColors[player1Hero],
      player2Color: getPlayer2Color(),
      player1Hero: player1Hero,
      player2Hero: player2Hero
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
        maxWidth: '1100px',
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
            <h3 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              👤 Player 1 (South)
              <div style={{
                width: '24px',
                height: '24px',
                backgroundColor: heroColors[player1Hero],
                border: '2px solid #2c3e50',
                borderRadius: '50%'
              }} title={`Color: ${heroColors[player1Hero]}`} />
            </h3>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Choose Hero:</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                {heroOptions.map(hero => (
                  <div
                    key={hero.id}
                    onClick={() => setPlayer1Hero(hero.id)}
                    style={{
                      width: '170px',
                      padding: '8px',
                      border: player1Hero === hero.id ? '3px solid #e74c3c' : '2px solid #95a5a6',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      backgroundColor: player1Hero === hero.id ? '#ffebee' : 'white',
                      textAlign: 'center',
                      transition: 'all 0.2s'
                    }}
                  >
                    <img
                      src={`${process.env.PUBLIC_URL}/sprites/${hero.portraitImage}`}
                      alt={hero.name}
                      style={{ width: '144px', height: '144px', marginBottom: '6px', imageRendering: 'pixelated' }}
                    />
                    <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>{hero.name}</div>
                    <div style={{ fontSize: '10px', color: '#666', lineHeight: '1.2' }}>{hero.description}</div>
                  </div>
                ))}
              </div>
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
            <h3 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              👤 Player 2 (North)
              <div style={{
                width: '24px',
                height: '24px',
                backgroundColor: getPlayer2Color(),
                border: '2px solid #2c3e50',
                borderRadius: '50%'
              }} title={`Color: ${getPlayer2Color()}`} />
            </h3>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Choose Hero:</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                {heroOptions.map(hero => (
                  <div
                    key={hero.id}
                    onClick={() => setPlayer2Hero(hero.id)}
                    style={{
                      width: '80px',
                      padding: '6px',
                      border: player2Hero === hero.id ? '3px solid #3498db' : '2px solid #95a5a6',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      backgroundColor: player2Hero === hero.id ? '#e3f2fd' : 'white',
                      textAlign: 'center',
                      transition: 'all 0.2s'
                    }}
                  >
                    <img
                      src={`${process.env.PUBLIC_URL}/sprites/${hero.portraitImage}`}
                      alt={hero.name}
                      style={{ width: '48px', height: '48px', marginBottom: '4px', imageRendering: 'pixelated' }}
                    />
                    <div style={{ fontSize: '9px', fontWeight: 'bold', marginBottom: '2px' }}>{hero.name}</div>
                    <div style={{ fontSize: '7px', color: '#666', lineHeight: '1.1' }}>{hero.description}</div>
                  </div>
                ))}
              </div>
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
