/**
 * @learn-center
 * AnimationSpeedContext — shared pause/speed state for all animation components.
 * Wrap any animation with <AnimationSpeedProvider> to enable controls.
 */
import { createContext, useContext, useState } from 'react';

export type AnimationSpeed = 0.5 | 1 | 2;

interface AnimationSpeedState {
  paused: boolean;
  speed: AnimationSpeed;
  togglePause: () => void;
  setSpeed: (s: AnimationSpeed) => void;
}

const defaultState: AnimationSpeedState = {
  paused: false,
  speed: 1,
  togglePause: () => {},
  setSpeed: () => {},
};

export const AnimationSpeedContext = createContext<AnimationSpeedState>(defaultState);

export function AnimationSpeedProvider({ children }: { children: React.ReactNode }) {
  const [paused, setPaused] = useState(false);
  const [speed, setSpeedState] = useState<AnimationSpeed>(1);

  const togglePause = () => setPaused((p) => !p);
  const setSpeed = (s: AnimationSpeed) => setSpeedState(s);

  return (
    <AnimationSpeedContext.Provider value={{ paused, speed, togglePause, setSpeed }}>
      {children}
    </AnimationSpeedContext.Provider>
  );
}

export function useAnimationSpeed() {
  return useContext(AnimationSpeedContext);
}
