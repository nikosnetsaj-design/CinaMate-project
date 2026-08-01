import { useCallback, useEffect, useRef, useState } from 'react';

/** Minutes, or the marker for "stop when this episode ends". */
export type SleepChoice = number | 'end-of-episode';

export const SLEEP_PRESETS: { value: SleepChoice; label: string }[] = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 ora' },
  { value: 'end-of-episode', label: 'Fine episodio' },
];

/**
 * Stops playback after a while, for watching in bed.
 *
 * The version that matters is "fine episodio": a fixed timer that cuts out
 * eight minutes before the end is worse than none, and autoplay means falling
 * asleep otherwise costs four more episodes of a series you now have to rewind.
 * Both stop at a *pause*, never a navigation — waking up to find the app has
 * closed itself and lost your place would be its own small betrayal.
 */
export function useSleepTimer(pause: () => void, autoplayBlocked: (blocked: boolean) => void) {
  const [choice, setChoice] = useState<SleepChoice | null>(null);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const pauseRef = useRef(pause);
  pauseRef.current = pause;
  const blockRef = useRef(autoplayBlocked);
  blockRef.current = autoplayBlocked;

  // A minute timer, counted down once a second so the chip can show it.
  useEffect(() => {
    if (typeof choice !== 'number') {
      setRemainingSec(null);
      return;
    }
    setRemainingSec(choice * 60);
    const id = window.setInterval(() => {
      setRemainingSec((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          pauseRef.current();
          setChoice(null);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [choice]);

  // "End of episode" doesn't count anything: it just tells the autoplay logic
  // to stand down, and the film ends when it ends.
  useEffect(() => {
    blockRef.current(choice === 'end-of-episode');
    return () => blockRef.current(false);
  }, [choice]);

  const cancel = useCallback(() => setChoice(null), []);

  return {
    choice,
    remainingSec,
    /** True while anything is armed — what the chip in the controls keys on. */
    armed: choice !== null,
    arm: setChoice,
    cancel,
  };
}
