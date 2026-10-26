import React from 'react';
import { objectiveProgress } from './objectives';
import { nextWave } from './waves';

// Persistent on-board list of the current level's objectives.
// Rendered only when gameState.campaign exists, so it never appears in
// normal local / AI / online games.
// With `intro`, the panel opens big in the middle of the screen at the start
// of a level; "Got it" (onDismiss) slides it up to its usual place at the top.

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

function ObjectivePanel({ gameState, intro = false, onDismiss }) {
  const campaign = gameState?.campaign;
  if (!campaign || !campaign.objectives?.length) return null;

  return (
    <>
    {intro && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.55)', zIndex: 5000 }} />
    )}
    <div style={{
      position: 'fixed',
      top: intro ? '50%' : 0,
      left: '50%',
      transform: intro ? 'translate(-50%, -50%) scale(1.35)' : 'translateX(-50%)',
      transition: 'top 0.6s ease, transform 0.6s ease',
      maxWidth: intro ? '68vw' : '90vw',
      padding: intro ? '14px 22px 14px' : '5px 16px 7px',
      background: intro ? 'rgba(10, 10, 10, 0.95)' : 'rgba(10, 10, 10, 0.82)',
      border: '1px solid rgba(255, 215, 0, 0.35)',
      borderTop: intro ? undefined : 'none',
      borderRadius: intro ? '8px' : '0 0 8px 8px',
      color: '#e0e0e0',
      fontSize: '13px',
      zIndex: intro ? 5001 : 2500,
      pointerEvents: intro ? 'auto' : 'none',
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
        {campaign.levelName ? (campaign.levelId === 0 ? campaign.levelName : `Level ${campaign.levelId}: ${campaign.levelName}`) : 'Objectives'}
      </div>
      {intro && (
        <div style={{ textAlign: 'center', color: '#bbb', fontSize: '11px', margin: '2px 0 6px' }}>
          To win this level:
        </div>
      )}
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
            {s === 'pending' && Number.isFinite(o.byTurn) && (
              <span style={{ color: '#fbbf24', fontSize: '12px' }}>
                {o.byTurn - gameState.turn <= 0 ? 'last turn' : `by turn ${o.byTurn}`}
              </span>
            )}
          </div>
        );
      })}
      </div>
      {campaign.boss && (() => {
        const { nextBossRound, SPORE_EVERY, MIND_EVERY } = require('./boss');
        return (
          <div style={{ marginTop: '3px', textAlign: 'center', fontSize: '12px', color: '#fbbf24' }}>
            {`\u26a0 Spore burst on turn ${nextBossRound(gameState.turn, SPORE_EVERY)} \u00b7 Mind control on turn ${nextBossRound(gameState.turn, MIND_EVERY)}`}
          </div>
        );
      })()}
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
      {intro && (
        <div style={{ textAlign: 'center', marginTop: '10px' }}>
          <button
            onClick={onDismiss}
            style={{
              padding: '6px 22px',
              background: 'linear-gradient(145deg, #ffd700, #d4a017)',
              color: '#1a1a1a',
              border: 'none',
              borderRadius: '4px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Got it
          </button>
        </div>
      )}
    </div>
    </>
  );
}

export default ObjectivePanel;
