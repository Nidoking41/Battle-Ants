import React, { useState } from 'react';
import { HeroQueens } from './heroQueens';

function LocalGameSetup({ onStartGame, onBack }) {
  const [mapSize, setMapSize] = useState('large');
  const [fogOfWar, setFogOfWar] = useState(true);
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
      fogOfWar: fogOfWar,
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
        <h1 style={{ textAlign: 'center', marginBottom: '4px', fontSize: '22px', color: '#e0e0e0' }}>Local Game Setup</h1>
        <h3 style={{ textAlign: 'center', marginBottom: '10px', color: '#b0b0b0', fontSize: '13px' }}>
          Hot Seat (Pass & Play)
        </h3>

        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '10px' }}>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '10px' }}>
          {/* Player 1 Selection */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{
              padding: '8px',
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '8px',
              border: '3px solid #3498db'
            }}>
              <h3 style={{ marginBottom: '6px', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px', color: '#e0e0e0' }}>
                Player 1 (South)
                <div style={{
                  width: '20px',
                  height: '20px',
                  backgroundColor: heroColors[player1Hero],
                  border: '2px solid #2c3e50',
                  borderRadius: '50%'
                }} title={`Color: ${heroColors[player1Hero]}`} />
              </h3>
              <div style={{ marginTop: '6px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px', color: '#e0e0e0' }}>Choose Your Hero:</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
                  {heroOptions.map(hero => (
                    <div
                      key={hero.id}
                      onClick={() => setPlayer1Hero(hero.id)}
                      style={{
                        width: '120px',
                        padding: '6px',
                        border: player1Hero === hero.id ? '3px solid #3498db' : '2px solid #95a5a6',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        backgroundColor: player1Hero === hero.id ? 'rgba(52, 152, 219, 0.2)' : 'rgba(255, 255, 255, 0.1)',
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
                Map Size
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {mapSizeOptions.map(size => (
                  <button
                    key={size.value}
                    onClick={() => setMapSize(size.value)}
                    style={{
                      padding: '8px',
                      fontSize: '13px',
                      fontWeight: 'bold',
                      background: mapSize === size.value ? 'linear-gradient(145deg, #8a8a8a, #6a6a6a)' : 'linear-gradient(145deg, #4a4a4a, #2a2a2a)',
                      color: '#e0e0e0',
                      border: mapSize === size.value ? '2px solid #aaa' : '2px solid #666',
                      borderRadius: '5px',
                      cursor: 'pointer',
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
                    Fog of War
                  </h3>
                  <p style={{ margin: 0, fontSize: '11px', color: '#b0b0b0' }}>
                    {fogOfWar
                      ? 'Limited visibility'
                      : 'Full map visibility'}
                  </p>
                </div>
                <button
                  onClick={() => setFogOfWar(!fogOfWar)}
                  style={{
                    padding: '8px 16px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    background: fogOfWar ? 'linear-gradient(145deg, #8a8a8a, #6a6a6a)' : 'linear-gradient(145deg, #4a4a4a, #2a2a2a)',
                    color: '#e0e0e0',
                    border: fogOfWar ? '2px solid #aaa' : '2px solid #666',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    minWidth: '70px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
                    transition: 'all 0.2s'
                  }}
                >
                  {fogOfWar ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column - Player 2 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{
              padding: '8px',
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '8px',
              border: '3px solid #e74c3c'
            }}>
              <h3 style={{ marginBottom: '6px', fontSize: '15px', color: '#e0e0e0' }}>
                Player 2 (North)
                <div style={{
                  width: '20px',
                  height: '20px',
                  backgroundColor: getPlayer2Color(),
                  border: '2px solid #2c3e50',
                  borderRadius: '50%',
                  display: 'inline-block',
                  marginLeft: '8px'
                }} title={`Color: ${getPlayer2Color()}`} />
              </h3>
              <div style={{ marginTop: '6px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px', color: '#e0e0e0' }}>Choose Hero:</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
                  {heroOptions.map(hero => (
                    <div
                      key={hero.id}
                      onClick={() => setPlayer2Hero(hero.id)}
                      style={{
                        width: '120px',
                        padding: '6px',
                        border: player2Hero === hero.id ? '3px solid #e74c3c' : '2px solid #95a5a6',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        backgroundColor: player2Hero === hero.id ? 'rgba(231, 76, 60, 0.2)' : 'rgba(255, 255, 255, 0.1)',
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
            onClick={handleStartGame}
            style={{
              flex: 2,
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
            Start Game
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
          <strong>Hot Seat Mode:</strong> Take turns playing on the same device. Pass the device to the other player when it's their turn!
        </div>
      </div>
    </div>
  );
}

export default LocalGameSetup;
