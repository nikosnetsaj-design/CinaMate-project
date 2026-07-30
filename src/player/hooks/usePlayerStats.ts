import { useEffect, useRef, useState } from 'react';
import { addWatchedSeconds, incrementPauseCount, getLifetimeStats } from '../services/statsAndHistory';
import type { SessionStats, LifetimeStats } from '../types';

export function usePlayerStats(isPlaying: boolean) {
  const [session, setSession] = useState<SessionStats>(() => ({ startedAt: Date.now(), watchedSec: 0, pauseCount: 0 }));
  const [lifetime, setLifetime] = useState<LifetimeStats>(getLifetimeStats);
  const wasPlayingRef = useRef(isPlaying);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = window.setInterval(() => {
        setSession(prev => ({ ...prev, watchedSec: prev.watchedSec + 1 }));
        addWatchedSeconds(1);
      }, 1000);
    }
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [isPlaying]);

  useEffect(() => {
    if (wasPlayingRef.current && !isPlaying) {
      setSession(prev => ({ ...prev, pauseCount: prev.pauseCount + 1 }));
      incrementPauseCount();
      setLifetime(getLifetimeStats());
    }
    wasPlayingRef.current = isPlaying;
  }, [isPlaying]);

  return { session, lifetime };
}
