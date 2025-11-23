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

  // Available sprite colors (must match actual sprite files in /sprites/ants/)
  const availableColors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#000000'];

  // Get actual color for player 2/AI, handling duplicate hero selection
  const getPlayer2Color = () => {
    if (playerHero === aiHero) {
      // Same hero selected, use an alternative sprite color
      const player1Color = heroColors[playerHero];
      // Find first available color that's different from player 1
      const alternativeColor = availableColors.find(color => color !== player1Color);
      return alternativeColor || availableColors[0];
    }
    return heroColors[aiHero];
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
      player2Color: getPlayer2Color(),
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
      backgroundImage: `url(${process.env.PUBLIC_URL}/sprites/ai_lobby.png)`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      padding: '10px',
      overflowY: 'auto'
    }}>
      <div style={{
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        padding: '15px',
        borderRadius: '10px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
        maxWidth: '1200px',
        width: '100%',
        margin: '10px 0',
        marginBottom: '20px',
        border: '2px solid rgba(192, 192, 192, 0.3)'
      }}>
        <h1 style={{ textAlign: 'center', marginBottom: '5px', fontSize: '24px', color: '#e0e0e0' }}>VS AI Setup</h1>
        <h3 style={{ textAlign: 'center', marginBottom: '15px', color: '#b0b0b0', fontSize: '14px' }}>
          Single Player
        </h3>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
          {/* Left Column - You */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Player Card */}
            <div style={{
              padding: '10px',
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '8px',
              border: '3px solid #3498db'
            }}>
              <h3 style={{ marginBottom: '10px', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#e0e0e0' }}>
                You (South)
                <div style={{
                  width: '24px',
                  height: '24px',
                  backgroundColor: heroColors[playerHero],
                  border: '2px solid #2c3e50',
                  borderRadius: '50%'
                }} title={`Color: ${heroColors[playerHero]}`} />
              </h3>
              <div style={{ marginTop: '10px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#e0e0e0' }}>Choose Your Hero:</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                  {heroOptions.map(hero => (
                    <div
                      key={hero.id}
                      onClick={() => setPlayerHero(hero.id)}
                      style={{
                        width: '140px',
                        padding: '8px',
                        border: playerHero === hero.id ? '3px solid #3498db' : '2px solid #95a5a6',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        backgroundColor: playerHero === hero.id ? 'rgba(52, 152, 219, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                        textAlign: 'center',
                        transition: 'all 0.2s'
                      }}
                    >
                      <img
                        src={`${process.env.PUBLIC_URL}/sprites/${hero.portraitImage}`}
                        alt={hero.name}
                        style={{ width: '100%', height: 'auto', aspectRatio: '1', marginBottom: '6px', imageRendering: 'pixelated' }}
                      />
                      <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '4px', color: '#e0e0e0' }}>{hero.name}</div>
                      <div style={{ fontSize: '11px', color: '#b0b0b0', lineHeight: '1.3' }}>{hero.description}</div>
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
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '8px'
            }}>
              <h3 style={{ marginBottom: '10px', fontSize: '16px', color: '#e0e0e0' }}>
                Map Size
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
                      background: mapSize === size.value ? 'linear-gradient(145deg, #5a5a5a, #3a3a3a)' : 'linear-gradient(145deg, #4a4a4a, #2a2a2a)',
                      color: '#e0e0e0',
                      border: '2px solid #666',
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
              padding: '10px',
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ marginBottom: '3px', fontSize: '16px', color: '#e0e0e0' }}>
                    Fog of War
                  </h3>
                  <p style={{ margin: 0, fontSize: '12px', color: '#b0b0b0' }}>
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
                    background: fogOfWar ? 'linear-gradient(145deg, #5a5a5a, #3a3a3a)' : 'linear-gradient(145deg, #4a4a4a, #2a2a2a)',
                    color: '#e0e0e0',
                    border: '2px solid #666',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    minWidth: '90px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
                    transition: 'all 0.2s'
                  }}
                >
                  {fogOfWar ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>

            {/* AI Difficulty Selection */}
            <div style={{
              padding: '10px',
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '8px'
            }}>
              <h3 style={{ marginBottom: '10px', fontSize: '16px', color: '#e0e0e0' }}>
                AI Difficulty
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
                      background: difficulty === diff.value ? 'linear-gradient(145deg, #5a5a5a, #3a3a3a)' : 'linear-gradient(145deg, #4a4a4a, #2a2a2a)',
                      color: '#e0e0e0',
                      border: '2px solid #666',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '3px',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
                      transition: 'all 0.2s'
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>{diff.name}</span>
                    <span style={{
                      fontSize: '12px',
                      opacity: 0.8,
                      fontWeight: 'normal'
                    }}>
                      {diff.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - AI */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* AI Card */}
            <div style={{
              padding: '10px',
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '8px',
              border: '3px solid #e74c3c'
            }}>
              <h3 style={{ marginBottom: '10px', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#e0e0e0' }}>
                AI (North)
                <div style={{
                  width: '24px',
                  height: '24px',
                  backgroundColor: getPlayer2Color(),
                  border: '2px solid #2c3e50',
                  borderRadius: '50%'
                }} title={`Color: ${getPlayer2Color()}`} />
              </h3>
              <div style={{ marginTop: '10px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#e0e0e0' }}>Choose AI Hero:</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                  {heroOptions.map(hero => (
                    <div
                      key={hero.id}
                      onClick={() => setAiHero(hero.id)}
                      style={{
                        width: '140px',
                        padding: '8px',
                        border: aiHero === hero.id ? '3px solid #e74c3c' : '2px solid #95a5a6',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        backgroundColor: aiHero === hero.id ? 'rgba(231, 76, 60, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                        textAlign: 'center',
                        transition: 'all 0.2s'
                      }}
                    >
                      <img
                        src={`${process.env.PUBLIC_URL}/sprites/${hero.portraitImage}`}
                        alt={hero.name}
                        style={{ width: '100%', height: 'auto', aspectRatio: '1', marginBottom: '6px', imageRendering: 'pixelated' }}
                      />
                      <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '4px', color: '#e0e0e0' }}>{hero.name}</div>
                      <div style={{ fontSize: '11px', color: '#b0b0b0', lineHeight: '1.3' }}>{hero.description}</div>
                    </div>
                  ))}
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
          marginTop: '8px',
          padding: '8px',
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          borderRadius: '5px',
          fontSize: '11px',
          color: '#ccc',
          border: '1px solid rgba(192, 192, 192, 0.2)',
          textAlign: 'center'
        }}>
          <strong>AI Mode:</strong> Test your skills against a computer opponent. Choose your difficulty and dominate the battlefield!
        </div>
      </div>
    </div>
  );
}

export default AIGameSetup;
