import { useState, useEffect, useRef } from 'react';
import { getSpriteInfo } from './spriteConfig';

// Custom hook to manage sprite animations
export function useSprites() {
  // Track animation state for each ant: { antId: { animation: 'idle'|'walk'|'attack', frame: 0, timestamp: number } }
  const [antAnimations, setAntAnimations] = useState({});
  const animationFrameRef = useRef();

  // Update animation frames
  useEffect(() => {
    const updateFrames = () => {
      const now = Date.now();
      setAntAnimations(prev => {
        const updated = { ...prev };
        let hasChanges = false;

        Object.keys(updated).forEach(antId => {
          const anim = updated[antId];
          if (!anim) return;

          const spriteInfo = getSpriteInfo(anim.antType, anim.animation, anim.playerColor);
          if (!spriteInfo) return;

          const timeSinceLastFrame = now - (anim.timestamp || now);
          if (timeSinceLastFrame >= spriteInfo.animationSpeed) {
            // Advance to next frame
            const nextFrame = (anim.frame + 1) % spriteInfo.frames;
            updated[antId] = {
              ...anim,
              frame: nextFrame,
              timestamp: now
            };
            hasChanges = true;
          }
        });

        return hasChanges ? updated : prev;
      });

      animationFrameRef.current = requestAnimationFrame(updateFrames);
    };

    animationFrameRef.current = requestAnimationFrame(updateFrames);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Set animation for an ant
  const setAntAnimation = (antId, antType, animation, playerColor = null) => {
    setAntAnimations(prev => ({
      ...prev,
      [antId]: {
        antType,
        animation,
        playerColor,
        frame: 0,
        timestamp: Date.now()
      }
    }));
  };

  // Remove ant animation when ant is deleted
  const removeAntAnimation = (antId) => {
    setAntAnimations(prev => {
      const updated = { ...prev };
      delete updated[antId];
      return updated;
    });
  };

  // Get current frame info for an ant
  const getAntFrame = (antId, antType, defaultAnimation = 'idle', playerColor = null) => {
    const anim = antAnimations[antId];
    const animation = anim?.animation || defaultAnimation;
    const frame = anim?.frame || 0;
    // Always prefer the passed playerColor (most up-to-date) over stored one
    const animPlayerColor = playerColor || anim?.playerColor;

    const spriteInfo = getSpriteInfo(antType, animation, animPlayerColor);
    if (!spriteInfo) {
      return null;
    }

    return {
      ...spriteInfo,
      currentFrame: frame,
      animation
    };
  };

  return {
    setAntAnimation,
    removeAntAnimation,
    getAntFrame
  };
}
