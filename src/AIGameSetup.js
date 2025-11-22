import React, { useState } from 'react';
import { AIDifficulty } from './aiController';
import { HeroQueens } from './heroQueens';

function AIGameSetup({ onStartGame, onBack }) {
  const [mapSize, setMapSize] = useState('large');
  const [difficulty, setDifficulty] = useState(AIDifficulty.EASY);
  const [fogOfWar, setFogOfWar] = useState(true);
  const [playerHero, setPlayerHero] = useState('gorlak');
  const [aiHero, setAiHero] = useState('sorlorg');

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

  // Map size options
  const mapSizeOptions = [
    { name: 'Small (7x7)', value: 'small' },
    { name: 'Medium (9x9)', value: 'medium' },
    { name: 'Large (11x11)', value: 'large' }
  ];

  // Difficulty options
  const difficultyOptions = [
    { name: 'Easy', value: AIDifficulty.EASY, description: 'Beginner-friendly, focuses on gathering' },
    { name: 'Medium', value: AIDifficulty.MEDIUM, description: 'Balanced strategy and combat' },
    { name: 'Hard', value: AIDifficulty.HARD, description: 'Aggressive and strategic' }
  ];

  const handleStartGame = () => {
    onStartGame({
      gameId: null,
      playerId: null,
      playerRole: 'player1',
      isMultiplayer: false,
      isAI: true,
      aiDifficulty: difficulty,
      fogOfWar: fogOfWar,
      mapSize,
      player1Color: heroColors[playerHero],
      player2Color: heroColors[aiHero],
      player1Hero: playerHero,
      player2Hero: aiHero
    });
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      minHeight: '100vh',
      backgroundColor: '#f0f0f0',
      padding: '10px',
      overflowY: 'auto'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '15px',
        borderRadius: '10px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        maxWidth: '1400px',
        width: '100%',
        margin: '10px 0',
        marginBottom: '20px'
      }}>
        <h1 style={{ textAlign: 'center', marginBottom: '5px', fontSize: '24px' }}>🤖 VS AI Setup</h1>
        <h3 style={{ textAlign: 'center', marginBottom: '15px', color: '#7f8c8d', fontSize: '16px' }}>
          Single Player
        </h3>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
          {/* Left Column - You */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Player Card */}
            <div style={{
              padding: '10px',
              backgroundColor: '#ecf0f1',
              borderRadius: '8px',
              border: '3px solid #3498db'
            }}>
              <h3 style={{ marginBottom: '10px', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                👤 You (South)
                <div style={{
                  width: '24px',
                  height: '24px',
                  backgroundColor: heroColors[playerHero],
                  border: '2px solid #2c3e50',
                  borderRadius: '50%'
                }} title={`Color: ${heroColors[playerHero]}`} />
              </h3>
              <div style={{ marginTop: '10px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Choose Your Hero:</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                  {heroOptions.map(hero => (
                    <div
                      key={hero.id}
                      onClick={() => setPlayerHero(hero.id)}
                      style={{
                        width: '170px',
                        padding: '8px',
                        border: playerHero === hero.id ? '3px solid #3498db' : '2px solid #95a5a6',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        backgroundColor: playerHero === hero.id ? '#e3f2fd' : 'white',
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
          </div>

          {/* Middle Column - Game Settings */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Map Size Selection */}
            <div style={{
              padding: '10px',
              backgroundColor: '#ecf0f1',
              borderRadius: '8px'
            }}>
              <h3 style={{ marginBottom: '10px', fontSize: '16px' }}>
                🗺️ Map Size
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {mapSizeOptions.map(size => (
                  <button
                    key={size.value}
                    onClick={() => setMapSize(size.value)}
                    style={{
                      padding: '10px',
                      fontSize: '14px',
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

            {/* Fog of War Toggle */}
            <div style={{
              padding: '10px',
              backgroundColor: '#ecf0f1',
              borderRadius: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ marginBottom: '3px', fontSize: '16px' }}>
                    🌫️ Fog of War
                  </h3>
                  <p style={{ margin: 0, fontSize: '12px', color: '#7f8c8d' }}>
                    {fogOfWar
                      ? 'Limited visibility'
                      : 'Full map visibility'}
                  </p>
                </div>
                <button
                  onClick={() => setFogOfWar(!fogOfWar)}
                  style={{
                    padding: '10px 20px',
                    fontSize: '15px',
                    fontWeight: 'bold',
                    backgroundColor: fogOfWar ? '#27ae60' : '#95a5a6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    minWidth: '90px'
                  }}
                >
                  {fogOfWar ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column - AI */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* AI Card */}
            <div style={{
              padding: '10px',
              backgroundColor: '#ecf0f1',
              borderRadius: '8px',
              border: '3px solid #e74c3c'
            }}>
              <h3 style={{ marginBottom: '10px', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🤖 AI (North)
                <div style={{
                  width: '24px',
                  height: '24px',
                  backgroundColor: heroColors[aiHero],
                  border: '2px solid #2c3e50',
                  borderRadius: '50%'
                }} title={`Color: ${heroColors[aiHero]}`} />
              </h3>
              <div style={{ marginTop: '10px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Choose AI Hero:</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                  {heroOptions.map(hero => (
                    <div
                      key={hero.id}
                      onClick={() => setAiHero(hero.id)}
                      style={{
                        width: '80px',
                        padding: '6px',
                        border: aiHero === hero.id ? '3px solid #e74c3c' : '2px solid #95a5a6',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        backgroundColor: aiHero === hero.id ? '#ffebee' : 'white',
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

            {/* AI Difficulty Selection */}
            <div style={{
              padding: '10px',
              backgroundColor: '#ecf0f1',
              borderRadius: '8px'
            }}>
              <h3 style={{ marginBottom: '10px', fontSize: '16px' }}>
                🎯 AI Difficulty
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {difficultyOptions.map(diff => (
                  <button
                    key={diff.value}
                    onClick={() => setDifficulty(diff.value)}
                    style={{
                      padding: '10px',
                      fontSize: '15px',
                      fontWeight: 'bold',
                      backgroundColor: difficulty === diff.value ? '#e74c3c' : 'white',
                      color: difficulty === diff.value ? 'white' : '#2c3e50',
                      border: '2px solid #e74c3c',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '3px'
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>{diff.name}</span>
                    <span style={{
                      fontSize: '12px',
                      opacity: difficulty === diff.value ? 1 : 0.7,
                      fontWeight: 'normal'
                    }}>
                      {diff.description}
                    </span>
                  </button>
                ))}
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
              padding: '12px',
              fontSize: '16px',
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
          marginTop: '8px',
          padding: '8px',
          backgroundColor: '#d5f4e6',
          borderRadius: '5px',
          fontSize: '11px',
          color: '#0c5460'
        }}>
          <strong>🤖 AI Mode:</strong> Test your skills against a computer opponent. Choose your difficulty and dominate the battlefield!
        </div>
      </div>
    </div>
  );
}

export default AIGameSetup;
