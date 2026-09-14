import React from 'react';

// End-of-level modal for campaign games. Replaces the generic
// "Player 1 wins!" victory modal, which makes no sense for a tutorial.

function LevelComplete({ gameState, onRetry, onNext, onMenu }) {
  const campaign = gameState?.campaign;
  if (!campaign || !gameState.gameOver) return null;

  const won = gameState.winner === 'player1';
  const failed = (campaign.objectives || []).find(o => o.status === 'failed');

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 4000
    }}>
      <div style={{
        minWidth: '340px',
        maxWidth: '480px',
        padding: '28px 32px',
        background: 'linear-gradient(160deg, #2a2a2a, #141414)',
        border: `2px solid ${won ? '#4ade80' : '#f87171'}`,
        borderRadius: '12px',
        color: '#e0e0e0',
        textAlign: 'center',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.7)'
      }}>
        <div style={{ fontSize: '13px', color: '#999', letterSpacing: '1px', textTransform: 'uppercase' }}>
          Level {campaign.levelId}{campaign.levelName ? ` · ${campaign.levelName}` : ''}
        </div>
        <h2 style={{ margin: '8px 0 14px', fontSize: '28px', color: won ? '#4ade80' : '#f87171' }}>
          {won ? 'Level Complete' : 'Level Failed'}
        </h2>
        {!won && failed && (
          <p style={{ margin: '0 0 14px', color: '#ccc' }}>{failed.text} — failed.</p>
        )}
        <div style={{ textAlign: 'left', margin: '0 auto 20px', display: 'inline-block' }}>
          {(campaign.objectives || []).map((o, i) => (
            <div key={i} style={{
              color: o.status === 'complete' ? '#4ade80' : o.status === 'failed' ? '#f87171' : '#bbb',
              margin: '3px 0'
            }}>
              {o.status === 'complete' ? '✓' : o.status === 'failed' ? '✕' : '○'} {o.text}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          {won && onNext && (
            <button onClick={onNext} style={buttonStyle('#16a34a')}>
              Next Level
            </button>
          )}
          <button onClick={onRetry} style={buttonStyle('#3b82f6')}>
            {won ? 'Play Again' : 'Retry'}
          </button>
          <button onClick={onMenu} style={buttonStyle('#555')}>
            Main Menu
          </button>
        </div>
      </div>
    </div>
  );
}

function buttonStyle(color) {
  return {
    padding: '10px 22px',
    fontSize: '15px',
    fontWeight: 'bold',
    color: '#fff',
    background: color,
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer'
  };
}

export default LevelComplete;
