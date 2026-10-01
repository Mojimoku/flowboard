import { useEffect, useState } from 'react';

const STORAGE_KEY = 'flowboard:reduce-motion';

function readStored(): boolean | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === null ? null : value === 'true';
  } catch {
    return null;
  }
}

/** Defaults to the OS "reduce motion" setting until the user picks explicitly. */
export function useReduceMotion() {
  const [reduceMotion, setReduceMotionState] = useState<boolean>(
    () => readStored() ?? window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  // Lets CSS animations (burn, skeleton pulse) follow the in-app setting too.
  useEffect(() => {
    document.documentElement.dataset.reduceMotion = String(reduceMotion);
  }, [reduceMotion]);

  function setReduceMotion(value: boolean) {
    setReduceMotionState(value);
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // Preference just won't persist.
    }
  }

  return [reduceMotion, setReduceMotion] as const;
}
