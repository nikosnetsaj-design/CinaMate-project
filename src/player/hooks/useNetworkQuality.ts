import { useState, useEffect, useRef, useCallback } from 'react';
import type { NetworkQuality } from '../types';

// The Network Information API (`navigator.connection`) is Chromium-only —
// not implemented in Safari or Firefox — so it's used as a hint when
// present, never as the only signal. The signal that works everywhere is
// the player's own buffering behavior: if playback keeps stalling, the
// network is poor right now regardless of what any API claims.
//
// Stalls arrive through `reportStall` rather than as an `isBuffering`
// argument so this hook can run *before* the player it describes. The
// adaptive buffer needs a quality reading at the moment hls.js is
// constructed, and a hook that took the player's own buffering state as an
// argument could only ever run after it — a cycle that would have left the
// first attach tuning itself from a default it had no reason to trust.
export function useNetworkQuality(): { quality: NetworkQuality; reportStall: () => void } {
  const [quality, setQuality] = useState<NetworkQuality>('good');
  const stallTimestampsRef = useRef<number[]>([]);

  useEffect(() => {
    const conn = (navigator as any).connection;
    if (!conn) return;
    const applyFromConnection = () => {
      if (!navigator.onLine) {
        setQuality('offline');
        return;
      }
      switch (conn.effectiveType) {
        case '4g':
          setQuality('excellent');
          break;
        case '3g':
          setQuality('good');
          break;
        case '2g':
        case 'slow-2g':
          setQuality('poor');
          break;
        // Unknown effectiveType values are left as-is rather than guessed at.
      }
    };
    applyFromConnection();
    conn.addEventListener('change', applyFromConnection);
    return () => conn.removeEventListener('change', applyFromConnection);
  }, []);

  useEffect(() => {
    const handleOffline = () => setQuality('offline');
    const handleOnline = () => setQuality('good');
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // Rolling 60s window of buffering *starts*: frequent stalls downgrade the
  // reading even on a browser that has no Network Information API at all,
  // or one that's reporting a misleadingly good effectiveType.
  const reportStall = useCallback(() => {
    const now = Date.now();
    const recent = [...stallTimestampsRef.current, now].filter(t => now - t < 60_000);
    stallTimestampsRef.current = recent;
    if (recent.length >= 3) setQuality('poor');
    else if (recent.length >= 1) setQuality(q => (q === 'excellent' ? 'good' : q));
  }, []);

  return { quality, reportStall };
}
