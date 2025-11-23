import React from 'react';

function GameSummary({ gameState, onReturnToMenu }) {
  if (!gameState || !gameState.stats) {
    return null;
  }

  const player1Stats = gameState.stats.player1;
  const player2Stats = gameState.stats.player2;
  const armyHistory = gameState.armyStrengthHistory || { player1: [], player2: [] };

  // Determine winner display
  const winner = gameState.winner;
  const winnerName = gameState.players[winner]?.name || `Player ${winner === 'player1' ? '1' : '2'}`;

  // SVG Graph dimensions
  const graphWidth = 700;
  const graphHeight = 300;
  const padding = 40;
  const plotWidth = graphWidth - 2 * padding;
  const plotHeight = graphHeight - 2 * padding;

  // Get max values for scaling
  const maxTurn = Math.max(armyHistory.player1.length, armyHistory.player2.length);
  const maxStrength = Math.max(
    ...armyHistory.player1,
    ...armyHistory.player2,
    1 // Minimum of 1 to avoid division by zero
  );

  // Generate SVG path for a line
  const generatePath = (data, color) => {
    if (data.length === 0) return null;

    const points = data.map((strength, index) => {
      const x = padding + (index / Math.max(maxTurn - 1, 1)) * plotWidth;
      const y = padding + plotHeight - (strength / maxStrength) * plotHeight;
      return `${x},${y}`;
    });

    return (
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinejoin="round"
      />
    );
  };

  // Calculate total ants hatched
  const getTotalAntsHatched = (antsHatched) => {
    return Object.values(antsHatched).reduce((sum, count) => sum + count, 0);
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
      padding: '20px',
      boxSizing: 'border-box'
    }}>
      <div style={{
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        padding: '30px',
        borderRadius: '15px',
        boxShadow: '0 8px 20px rgba(0,0,0,0.5)',
        maxWidth: '1200px',
        width: '100%',
        border: '3px solid rgba(192, 192, 192, 0.4)'
      }}>
        {/* Title */}
        <h1 style={{
          textAlign: 'center',
          marginTop: 0,
          marginBottom: '10px',
          fontSize: '32px',
          color: '#e0e0e0'
        }}>
          Game Summary
        </h1>
        <h2 style={{
          textAlign: 'center',
          marginTop: 0,
          marginBottom: '30px',
          fontSize: '24px',
          color: winner === 'player1' ? '#4CAF50' : '#f44336'
        }}>
          {winnerName} Wins!
        </h2>

        {/* Army Strength Graph */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          borderRadius: '10px',
          padding: '20px',
          marginBottom: '30px'
        }}>
          <h3 style={{
            textAlign: 'center',
            marginTop: 0,
            marginBottom: '15px',
            color: '#333',
            fontSize: '20px'
          }}>
            Army Strength Over Time
          </h3>
          <svg width={graphWidth} height={graphHeight} style={{ display: 'block', margin: '0 auto' }}>
            {/* Background */}
            <rect x={padding} y={padding} width={plotWidth} height={plotHeight} fill="#f5f5f5" stroke="#ccc" strokeWidth="1" />

            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
              const y = padding + plotHeight - ratio * plotHeight;
              return (
                <g key={`grid-${idx}`}>
                  <line
                    x1={padding}
                    y1={y}
                    x2={padding + plotWidth}
                    y2={y}
                    stroke="#ddd"
                    strokeWidth="1"
                  />
                  <text
                    x={padding - 5}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="12"
                    fill="#666"
                  >
                    {Math.round(maxStrength * ratio)}
                  </text>
                </g>
              );
            })}

            {/* X-axis labels */}
            {maxTurn > 0 && [0, Math.floor(maxTurn / 2), maxTurn - 1].map((turn, idx) => {
              const x = padding + (turn / Math.max(maxTurn - 1, 1)) * plotWidth;
              return (
                <text
                  key={`x-label-${idx}`}
                  x={x}
                  y={padding + plotHeight + 25}
                  textAnchor="middle"
                  fontSize="12"
                  fill="#666"
                >
                  Turn {turn + 1}
                </text>
              );
            })}

            {/* Lines */}
            {generatePath(armyHistory.player1, '#2196F3')}
            {generatePath(armyHistory.player2, '#f44336')}

            {/* Legend */}
            <g transform={`translate(${padding + 10}, ${padding + 10})`}>
              <rect x="0" y="0" width="15" height="15" fill="#2196F3" />
              <text x="20" y="12" fontSize="14" fill="#333">
                {gameState.players.player1?.name || 'Player 1'}
              </text>
              <rect x="0" y="25" width="15" height="15" fill="#f44336" />
              <text x="20" y="37" fontSize="14" fill="#333">
                {gameState.players.player2?.name || 'Player 2'}
              </text>
            </g>
          </svg>
        </div>

        {/* Stats Tables Side-by-Side */}
        <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
          {/* Player 1 Stats */}
          <div style={{ flex: 1 }}>
            <h3 style={{
              textAlign: 'center',
              marginTop: 0,
              marginBottom: '15px',
              fontSize: '20px',
              color: '#2196F3',
              backgroundColor: 'rgba(33, 150, 243, 0.2)',
              padding: '10px',
              borderRadius: '8px'
            }}>
              {gameState.players.player1?.name || 'Player 1'}
            </h3>
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '15px',
              border: '2px solid rgba(33, 150, 243, 0.4)'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                    <td style={{ padding: '8px', color: '#e0e0e0', fontWeight: 'bold' }}>Damage Dealt</td>
                    <td style={{ padding: '8px', color: '#e0e0e0', textAlign: 'right' }}>{player1Stats.damageDealt}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                    <td style={{ padding: '8px', color: '#e0e0e0', fontWeight: 'bold' }}>Damage Received</td>
                    <td style={{ padding: '8px', color: '#e0e0e0', textAlign: 'right' }}>{player1Stats.damageReceived}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                    <td style={{ padding: '8px', color: '#e0e0e0', fontWeight: 'bold' }}>Ants Hatched</td>
                    <td style={{ padding: '8px', color: '#e0e0e0', textAlign: 'right' }}>{getTotalAntsHatched(player1Stats.antsHatched)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                    <td style={{ padding: '8px', color: '#e0e0e0', fontWeight: 'bold' }}>Ants Killed</td>
                    <td style={{ padding: '8px', color: '#e0e0e0', textAlign: 'right' }}>{player1Stats.antsKilled}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                    <td style={{ padding: '8px', color: '#e0e0e0', fontWeight: 'bold' }}>Ants Lost</td>
                    <td style={{ padding: '8px', color: '#e0e0e0', textAlign: 'right' }}>{player1Stats.antsLost}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                    <td style={{ padding: '8px', color: '#e0e0e0', fontWeight: 'bold' }}>Food Mined</td>
                    <td style={{ padding: '8px', color: '#e0e0e0', textAlign: 'right' }}>{player1Stats.foodMined}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px', color: '#e0e0e0', fontWeight: 'bold' }}>Minerals Mined</td>
                    <td style={{ padding: '8px', color: '#e0e0e0', textAlign: 'right' }}>{player1Stats.mineralsMined}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Player 2 Stats */}
          <div style={{ flex: 1 }}>
            <h3 style={{
              textAlign: 'center',
              marginTop: 0,
              marginBottom: '15px',
              fontSize: '20px',
              color: '#f44336',
              backgroundColor: 'rgba(244, 67, 54, 0.2)',
              padding: '10px',
              borderRadius: '8px'
            }}>
              {gameState.players.player2?.name || 'Player 2'}
            </h3>
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '15px',
              border: '2px solid rgba(244, 67, 54, 0.4)'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                    <td style={{ padding: '8px', color: '#e0e0e0', fontWeight: 'bold' }}>Damage Dealt</td>
                    <td style={{ padding: '8px', color: '#e0e0e0', textAlign: 'right' }}>{player2Stats.damageDealt}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                    <td style={{ padding: '8px', color: '#e0e0e0', fontWeight: 'bold' }}>Damage Received</td>
                    <td style={{ padding: '8px', color: '#e0e0e0', textAlign: 'right' }}>{player2Stats.damageReceived}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                    <td style={{ padding: '8px', color: '#e0e0e0', fontWeight: 'bold' }}>Ants Hatched</td>
                    <td style={{ padding: '8px', color: '#e0e0e0', textAlign: 'right' }}>{getTotalAntsHatched(player2Stats.antsHatched)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                    <td style={{ padding: '8px', color: '#e0e0e0', fontWeight: 'bold' }}>Ants Killed</td>
                    <td style={{ padding: '8px', color: '#e0e0e0', textAlign: 'right' }}>{player2Stats.antsKilled}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                    <td style={{ padding: '8px', color: '#e0e0e0', fontWeight: 'bold' }}>Ants Lost</td>
                    <td style={{ padding: '8px', color: '#e0e0e0', textAlign: 'right' }}>{player2Stats.antsLost}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                    <td style={{ padding: '8px', color: '#e0e0e0', fontWeight: 'bold' }}>Food Mined</td>
                    <td style={{ padding: '8px', color: '#e0e0e0', textAlign: 'right' }}>{player2Stats.foodMined}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px', color: '#e0e0e0', fontWeight: 'bold' }}>Minerals Mined</td>
                    <td style={{ padding: '8px', color: '#e0e0e0', textAlign: 'right' }}>{player2Stats.mineralsMined}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Return Button */}
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={onReturnToMenu}
            style={{
              padding: '15px 50px',
              fontSize: '18px',
              fontWeight: 'bold',
              backgroundColor: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              boxShadow: '0 4px 10px rgba(0,0,0,0.4)',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.target.style.backgroundColor = '#1976D2';
              e.target.style.boxShadow = '0 6px 15px rgba(0,0,0,0.5)';
            }}
            onMouseOut={(e) => {
              e.target.style.backgroundColor = '#2196F3';
              e.target.style.boxShadow = '0 4px 10px rgba(0,0,0,0.4)';
            }}
          >
            Return to Main Menu
          </button>
        </div>
      </div>
    </div>
  );
}

export default GameSummary;
