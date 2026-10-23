import React, { useEffect, useRef, useState } from 'react';

// Full-screen pixel-art video: the opening before the title screen, or a
// level's outroVideo after a win. Ends on its own; a click or any key skips
// it. Muted and inline so browsers allow it to autoplay. When it ends (or is
// skipped) the picture fades to black before moving on, and it fades in
// from black at the start, so nothing cuts.
export const VIDEO_FADE_MS = 500;

function IntroVideo({ onDone, src = '/intro/intro.mp4' }) {
  const doneRef = useRef(false);
  const [fading, setFading] = useState(false);
  const [faded, setFaded] = useState(true); // starts black, fades in once on screen
  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setFading(true);
    setTimeout(onDone, VIDEO_FADE_MS);
  };

  useEffect(() => {
    const show = requestAnimationFrame(() => requestAnimationFrame(() => setFaded(false)));
    return () => cancelAnimationFrame(show);
  }, []);

  useEffect(() => {
    const onKey = () => finish();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      onClick={finish}
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        zIndex: 5000,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <video
        src={`${process.env.PUBLIC_URL}${src}`}
        autoPlay
        muted
        playsInline
        onEnded={finish}
        onError={finish}
        style={{
          width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'pixelated',
          opacity: fading || faded ? 0 : 1, transition: `opacity ${VIDEO_FADE_MS}ms ease-in-out`
        }}
      />
      <div style={{
        position: 'absolute',
        bottom: '18px',
        right: '24px',
        color: '#777',
        fontSize: '13px',
        letterSpacing: '1px',
        fontFamily: 'sans-serif',
        pointerEvents: 'none',
        opacity: fading ? 0 : 1,
        transition: `opacity ${VIDEO_FADE_MS}ms`
      }}>
        click or press any key to skip
      </div>
    </div>
  );
}

// A black screen that fades away over `ms`, laid over whatever comes next
// (the title screen after the opening video).
export function FadeFromBlack({ ms = 1200 }) {
  const [shown, setShown] = useState(true);
  const [clear, setClear] = useState(false);
  useEffect(() => {
    const start = requestAnimationFrame(() => requestAnimationFrame(() => setClear(true)));
    const end = setTimeout(() => setShown(false), ms);
    return () => { cancelAnimationFrame(start); clearTimeout(end); };
  }, [ms]);
  if (!shown) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#000', zIndex: 5000, pointerEvents: 'none',
      opacity: clear ? 0 : 1, transition: `opacity ${ms}ms ease-out`
    }} />
  );
}

export default IntroVideo;
