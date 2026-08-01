import { useEffect, useRef, useState } from 'react';

type WakeLockSentinelLike = { released: boolean; release: () => Promise<void>; addEventListener: (t: string, cb: () => void) => void };
type WakeLockCapableNavigator = Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> } };

/**
 * Keeps the screen on while a video is playing.
 *
 * A phone dims and locks after thirty seconds of no touching, and watching a
 * film is thirty minutes of exactly that. Every native player holds this lock;
 * a web player that doesn't is the one where you have to poke the screen every
 * half minute.
 *
 * The lock is dropped the moment playback stops — holding it through a pause,
 * or after the tab is hidden, would be a battery leak with nothing on screen to
 * justify it. The browser also revokes it on tab switch without telling anyone,
 * so it is re-acquired when the page becomes visible again.
 */
export function useWakeLock(active: boolean): { supported: boolean; held: boolean } {
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const [held, setHeld] = useState(false);
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;

    const release = () => {
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      setHeld(false);
      if (sentinel && !sentinel.released) void sentinel.release().catch(() => {});
    };

    const acquire = async () => {
      if (cancelled || sentinelRef.current || document.visibilityState !== 'visible') return;
      try {
        const sentinel = await (navigator as WakeLockCapableNavigator).wakeLock!.request('screen');
        if (cancelled) {
          void sentinel.release().catch(() => {});
          return;
        }
        sentinelRef.current = sentinel;
        setHeld(true);
        // Revoked by the system (tab hidden, battery saver): reflect it rather
        // than reporting a lock that no longer exists.
        sentinel.addEventListener('release', () => {
          if (sentinelRef.current === sentinel) {
            sentinelRef.current = null;
            setHeld(false);
          }
        });
      } catch {
        // Denied — usually battery saver. Nothing to do but let the screen dim.
      }
    };

    if (active) void acquire();
    else release();

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && active) void acquire();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      release();
    };
  }, [active, supported]);

  return { supported, held };
}
