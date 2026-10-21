import React, { useEffect, useRef } from 'react';

// Full-screen pixel-art video: the opening before the title screen, or a
// level's outroVideo after a win. Ends on its own; a click or any key skips
// it. Muted and inline so browsers allow it to autoplay.
function IntroVideo({ onDone, src = '/intro/intro.mp4' }) {
  const doneRef = useRef(false);
  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  };

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
        style={{ width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'pixelated' }}
      />
      <div style={{
        position: 'absolute',
        bottom: '18px',
        right: '24px',
        color: '#777',
        fontSize: '13px',
        letterSpacing: '1px',
        fontFamily: 'sans-serif',
        pointerEvents: 'none'
      }}>
        click or press any key to skip
      </div>
    </div>
  );
}

export default IntroVideo;
