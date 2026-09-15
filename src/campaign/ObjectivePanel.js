import React from 'react';
import { objectiveProgress } from './objectives';
import { nextWave } from './waves';

// Persistent on-board list of the current level's objectives.
// Rendered only when gameState.campaign exists, so it never appears in
// normal local / AI / online games.

const STATUS_ICON = {
  pending: '○',
  complete: '✓',
  failed: '✕'
};

const STATUS_COLOR = {
  pending: '#d0d0d0',
  complete: '#4ade80',
  failed: '#f87171'
};

function ObjectivePanel({ gameState }) {
  const campaign = gameState?.campaign;
  if (!campaign || !campaign.objectives?.length) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      maxWidth: '90vw',
      padding: '5px 16px 7px',
      background: 'rgba(10, 10, 10, 0.82)',
      border: '1px solid rgba(255, 215, 0, 0.35)',
      borderTop: 'none',
      borderRadius: '0 0 8px 8px',
      color: '#e0e0e0',
      fontSize: '13px',
      zIndex: 2500,
      pointerEvents: 'none',
      boxShadow: '0 4px 14px rgba(0, 0, 0, 0.5)'
    }}>
      <div style={{
        color: '#ffd700',
        fontWeight: 'bold',
        fontSize: '12px',
        letterSpacing: '1px',
        textTransform: 'uppercase',
        marginBottom: '2px',
        textAlign: 'center'
      }}>
        {campaign.levelName ? `Level ${campaign.levelId}: ${campaign.levelName}` : 'Objectives'}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '4px 22px' }}>
      {campaign.objectives.map((o, i) => {
        const s = o.status || 'pending';
        const progress = objectiveProgress(o, gameState);
        return (
          <div key={i} style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '6px',
            color: STATUS_COLOR[s],
            textDecoration: s === 'complete' ? 'line-through' : 'none',
            opacity: s === 'complete' ? 0.75 : 1,
            margin: 0
          }}>
            <span style={{ fontWeight: 'bold', width: '12px' }}>{STATUS_ICON[s]}</span>
            <span>{o.text}</span>
            {progress && s !== 'complete' && (
              <span style={{ color: '#999', fontSize: '12px' }}>{progress}</span>
            )}
          </div>
        );
      })}
      </div>
      {(() => {
        const waves = campaign.waves || [];
        if (!waves.length) return null;
        const next = nextWave(campaign, gameState.turn);
        return (
          <div style={{ marginTop: '3px', textAlign: 'center', fontSize: '12px', color: next ? '#fbbf24' : '#888' }}>
            {next
              ? `\u26a0 Enemy reinforcements arrive on turn ${next.turn}`
              : 'All enemy reinforcements have arrived'}
          </div>
        );
      })()}
    </div>
  );
}

export default ObjectivePanel;
