import React, { useEffect, useState, useCallback } from 'react';
import { getHeroById } from '../heroQueens';

// Campaign cutscene: a portrait on black with narration at the bottom.
// Lines type out one at a time. Click / Space / Enter finishes the current
// line or advances to the next; the last line offers Begin. Esc skips.
//
// Driven entirely by level data - `cutscene: { portrait, lines }` - so any
// level can have one without touching this file. `portrait` is a filename
// under public/sprites/, resolved the same way hero portraits are elsewhere.
//
// A line is either a string (narration, shown over the level's portrait) or
// an object for a speaking character:
//   { hero: 'gorlak', text }              - a rival: name and portrait looked up
//   { speaker, portrait, text }           - anyone else
// The portrait swaps per line, so rivals can talk trash in their own face.

const TYPE_MS = 28; // per character

export function normalizeCutsceneLines(cutscene) {
  return (cutscene?.lines || []).map(line => {
    if (typeof line === 'string') return { text: line, portrait: cutscene.portrait || null, speaker: null };
    if (line.hero) {
      const hero = getHeroById(line.hero);
      return {
        text: line.text,
        portrait: line.portrait || hero?.portraitImage || cutscene.portrait || null,
        speaker: line.speaker || hero?.name || null
      };
    }
    return { text: line.text, portrait: line.portrait || cutscene.portrait || null, speaker: line.speaker || null };
  });
}

function Cutscene({ cutscene, title, onDone }) {
  const lines = normalizeCutsceneLines(cutscene);
  const [lineIdx, setLineIdx] = useState(0);
  const [shown, setShown] = useState(0); // characters of the current line revealed
  const [portraitLoaded, setPortraitLoaded] = useState(false);

  const current = lines[lineIdx] || { text: '', portrait: null, speaker: null };
  const lineDone = shown >= current.text.length;
  const isLast = lineIdx >= lines.length - 1;

  // Typewriter for the current line
  useEffect(() => {
    if (lineDone) return undefined;
    const id = setTimeout(() => setShown(s => s + 1), TYPE_MS);
    return () => clearTimeout(id);
  }, [shown, lineDone]);

  // A new portrait fades in from black again
  useEffect(() => { setPortraitLoaded(false); }, [current.portrait]);

  const advance = useCallback(() => {
    if (!lineDone) { setShown(current.text.length); return; }
    if (isLast) { onDone(); return; }
    setLineIdx(i => i + 1);
    setShown(0);
  }, [lineDone, isLast, current.text.length, onDone]);

  // Keyboard: Space / Enter advance, Escape skips
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); advance(); }
      else if (e.key === 'Escape') { onDone(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, onDone]);

  if (!lines.length) return null;

  return (
    <div
      onClick={advance}
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        zIndex: 5000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        cursor: 'pointer',
        userSelect: 'none',
        color: '#e8e8e8',
        fontFamily: 'Georgia, "Times New Roman", serif'
      }}
    >
      {/* Skip */}
      <button
        onClick={(e) => { e.stopPropagation(); onDone(); }}
        style={{
          position: 'absolute',
          top: '18px',
          right: '22px',
          background: 'transparent',
          color: '#777',
          border: '1px solid #444',
          borderRadius: '4px',
          padding: '5px 12px',
          fontSize: '12px',
          letterSpacing: '1px',
          cursor: 'pointer'
        }}
      >
        SKIP
      </button>

      {/* Portrait */}
      {current.portrait && (
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          padding: '40px 20px 20px'
        }}>
          <img
            key={current.portrait}
            src={`${process.env.PUBLIC_URL}/sprites/${current.portrait}`}
            alt=""
            onLoad={() => setPortraitLoaded(true)}
            style={{
              // The portraits are small pixel sprites; a max-size cap never scales
              // them up, so pin the height to half the screen and let width follow.
              height: 'min(50vh, 90vw)',
              width: 'auto',
              objectFit: 'contain',
              imageRendering: 'pixelated',
              opacity: portraitLoaded ? 1 : 0,
              transition: 'opacity 1.2s ease',
              // The portrait PNGs have no alpha channel - they are painted on solid
              // black. Screen-blending onto this black backdrop makes those pixels
              // vanish and leaves the (light) ant untouched, so no asset edit needed.
              mixBlendMode: 'screen'
            }}
          />
        </div>
      )}

      {/* Narration */}
      <div style={{
        width: '100%',
        maxWidth: '820px',
        padding: '0 30px 48px',
        boxSizing: 'border-box'
      }}>
        {title && (
          <div style={{
            color: '#ffd700',
            fontSize: '13px',
            letterSpacing: '3px',
            textTransform: 'uppercase',
            marginBottom: '14px',
            opacity: 0.85
          }}>
            {title}
          </div>
        )}
        {current.speaker && (
          <div style={{
            color: '#f0c419',
            fontSize: '15px',
            fontWeight: 'bold',
            letterSpacing: '1px',
            marginBottom: '6px'
          }}>
            {current.speaker}
          </div>
        )}
        <div style={{
          minHeight: '4.5em',
          fontSize: '21px',
          lineHeight: 1.5,
          textShadow: '0 2px 8px rgba(0,0,0,0.8)'
        }}>
          {current.text.slice(0, shown)}
          {!lineDone && <span style={{ opacity: 0.6 }}>▌</span>}
        </div>
        <div style={{
          marginTop: '18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '12px',
          color: '#666',
          letterSpacing: '1px'
        }}>
          <span>{lineIdx + 1} / {lines.length}</span>
          {lineDone && isLast ? (
            <button
              onClick={(e) => { e.stopPropagation(); onDone(); }}
              style={{
                background: 'linear-gradient(145deg, #6b5410, #3d2f08)',
                color: '#ffd700',
                border: '2px solid #a67c00',
                borderRadius: '5px',
                padding: '10px 26px',
                fontSize: '15px',
                fontWeight: 'bold',
                letterSpacing: '1px',
                cursor: 'pointer'
              }}
            >
              BEGIN
            </button>
          ) : (
            <span style={{ opacity: lineDone ? 1 : 0.4 }}>click or space to continue</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default Cutscene;
