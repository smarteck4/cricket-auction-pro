import { useRef, useCallback } from 'react';

export function useBidAlert() {
  const audioContextRef = useRef<AudioContext | null>(null);

  const playBidSound = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      const now = ctx.currentTime;

      // Two-tone rising chime: C5 → E5
      const frequencies = [523, 659];
      frequencies.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'triangle';
        const start = now + i * 0.1;
        gain.gain.setValueAtTime(0.25, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + 0.15);
        osc.start(start);
        osc.stop(start + 0.15);
      });
    } catch (e) {
      console.warn('Could not play bid alert:', e);
    }
  }, []);

  // Cleanup
  const cleanup = useCallback(() => {
    audioContextRef.current?.close();
    audioContextRef.current = null;
  }, []);

  return { playBidSound, cleanup };
}
