import React, { useState } from 'react';
import { LEVELS } from './levels';
import { loadProgress, isUnlocked, isCompleted, resetProgress, bestScore } from './progress';

// Level select. A level unlocks when the one before it has been beaten.
// Locked levels show only their number - no name or objectives - so the
// player is not told what is coming.

function CampaignMenu({ onStartLevel, onBack }) {
  const [progress, setProgress] = useState(() => loadProgress());

  const handleReset = () => {
    resetProgress();
    setProgress(loadProgress());
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      color: '#e0e0e0'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '520px',
        padding: '25px',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        borderRadius: '10px',
        border: '2px solid rgba(255, 215, 0, 0.35)',
        boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
      }}>
        <h1 style={{ margin: '0 0 4px', color: '#ffd700', textAlign: 'center' }}>Campaign</h1>
        <p style={{ margin: '0 0 18px', textAlign: 'center', color: '#aaa', fontSize: '14px' }}>
          Learn the colony one level at a time.
        </p>

        {LEVELS.map(level => {
          const unlocked = isUnlocked(level.id, progress);
          const done = isCompleted(level.id, progress);

          if (!unlocked) {
            return (
              <div
                key={level.id}
                style={{
                  padding: '12px 16px',
                  marginBottom: '10px',
                  background: 'rgba(30, 30, 30, 0.6)',
                  color: '#666',
                  border: '2px solid #333',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  fontSize: '16px'
                }}
              >
                <span style={{ marginRight: '8px' }}>{level.id}.</span>
                <span style={{ fontSize: '14px', fontWeight: 'normal' }}>
                  Locked &mdash; beat level {level.id - 1} to unlock
                </span>
              </div>
            );
          }

          return (
            <button
              key={level.id}
              onClick={() => onStartLevel(level.id)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '12px 16px',
                marginBottom: '10px',
                background: 'linear-gradient(145deg, #4a4a4a, #2a2a2a)',
                color: '#e0e0e0',
                border: `2px solid ${done ? '#4ade80' : '#666'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => { e.currentTarget.style.borderColor = '#d4a800'; }}
              onMouseOut={(e) => { e.currentTarget.style.borderColor = done ? '#4ade80' : '#666'; }}
            >
              <div style={{ fontWeight: 'bold', fontSize: '16px', display: 'flex', justifyContent: 'space-between' }}>
                <span>
                  <span style={{ color: '#ffd700', marginRight: '8px' }}>{level.id}.</span>{level.name}
                </span>
                {done && (
                  <span style={{ color: '#4ade80', fontSize: '14px' }}>
                    &#10003; Complete{bestScore(level.id, progress) !== null ? ` \u00b7 Best ${bestScore(level.id, progress)}` : ''}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '13px', color: '#aaa', marginTop: '3px' }}>
                {level.objectives.map(o => o.text).join(' · ')}
              </div>
            </button>
          );
        })}

        <button
          onClick={onBack}
          style={{
            width: '100%',
            padding: '10px',
            marginTop: '8px',
            background: 'transparent',
            color: '#aaa',
            border: '2px solid #555',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          Back
        </button>

        {progress.completed.length > 0 && (
          <button
            onClick={handleReset}
            style={{
              display: 'block',
              margin: '12px auto 0',
              background: 'none',
              border: 'none',
              color: '#666',
              fontSize: '12px',
              textDecoration: 'underline',
              cursor: 'pointer'
            }}
          >
            Reset campaign progress
          </button>
        )}
      </div>
    </div>
  );
}

export default CampaignMenu;
