import { useRef, useEffect, useCallback } from 'react';

export function useCountdownBeep(timeRemaining: number, isActive: boolean) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastBeepTimeRef = useRef<number | null>(null);

  const playBeep = useCallback((frequency: number = 800, duration: number = 100) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration / 1000);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration / 1000);
    } catch (error) {
      console.warn('Could not play beep sound:', error);
    }
  }, []);

  useEffect(() => {
    if (!isActive) {
      lastBeepTimeRef.current = null;
      return;
    }

    // Only beep in the last 5 seconds, and avoid duplicate beeps for the same second
    if (timeRemaining > 0 && timeRemaining <= 5 && lastBeepTimeRef.current !== timeRemaining) {
      lastBeepTimeRef.current = timeRemaining;
      
      if (timeRemaining === 1) {
        // Final beep - higher pitch, longer duration
        playBeep(1200, 200);
      } else {
        // Regular countdown beep
        playBeep(800, 100);
      }
    }
  }, [timeRemaining, isActive, playBeep]);

  // Cleanup audio context on unmount
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);
}
