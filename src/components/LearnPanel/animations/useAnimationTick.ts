/**
 * @learn-center
 * useAnimationTick — drop-in replacement for the manual useState+setInterval tick pattern.
 * Reads pause/speed from AnimationSpeedContext automatically.
 *
 * Usage: replace the following 4-line block in any animation:
 *   const [tick, setTick] = useState(0);
 *   useEffect(() => {
 *     const id = setInterval(() => setTick((p) => (p + 1) % CYCLE_TICKS), TICK_MS);
 *     return () => clearInterval(id);
 *   }, []);
 *
 * With a single line:
 *   const tick = useAnimationTick(CYCLE_TICKS);
 */
import { useState, useEffect } from 'react';
import { useAnimationSpeed } from './AnimationSpeedContext';

const BASE_TICK_MS = 50;

export function useAnimationTick(cycleTicks: number): number {
  const { paused, speed } = useAnimationSpeed();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (paused) return;
    const intervalMs = Math.round(BASE_TICK_MS / speed);
    const id = setInterval(() => setTick((p) => (p + 1) % cycleTicks), intervalMs);
    return () => clearInterval(id);
  }, [paused, speed, cycleTicks]);

  return tick;
}
