import { useCallback, useEffect, useRef } from 'react';
import { saveProgress } from '../services/statsAndHistory';

/** How often the playhead is written while nothing else happens. */
const INTERVAL_MS = 5000;

/**
 * Writes the playhead often enough to be useful and rarely enough to be free —
 * and, crucially, at the moments it is actually about to be lost.
 *
 * The old rule was `if (Math.floor(t) % 5 === 0) save()` inside `timeupdate`.
 * It has two faults. `timeupdate` fires about four times a second, so that
 * condition is true four times in a row and wrote the same position four times
 * over. And it only ever fires *while playing*: pausing at 42:10 and closing
 * the tab saved nothing after the last whole second before the pause, so
 * "Continua a guardare" offered a point the viewer had already moved past.
 *
 * This saves on a real clock, and flushes on every event that means the value
 * is about to stop being reachable: pause, tab hidden, page unload, unmount.
 */
export function useProgressSaver(contentId: string, getState: () => { time: number; duration: number }, isPlaying: boolean) {
  const getStateRef = useRef(getState);
  getStateRef.current = getState;
  const contentIdRef = useRef(contentId);
  contentIdRef.current = contentId;
  const lastSavedRef = useRef(-1);

  const flush = useCallback(() => {
    const { time, duration } = getStateRef.current();
    // A playhead at zero is what a freshly attached element reports before the
    // first frame; writing it would erase a real resume point on every switch.
    if (!Number.isFinite(time) || time < 1) return;
    if (Math.abs(time - lastSavedRef.current) < 1) return;
    lastSavedRef.current = time;
    saveProgress(contentIdRef.current, time, Number.isFinite(duration) ? duration : undefined);
  }, []);

  // Switching title resets the guard: the next save belongs to a different
  // recording and must not be skipped for being close to the previous one.
  useEffect(() => {
    lastSavedRef.current = -1;
  }, [contentId]);

  useEffect(() => {
    if (!isPlaying) {
      // The pause itself is the most valuable save there is: it is the exact
      // point someone stopped, and the one they expect to come back to.
      flush();
      return;
    }
    const id = window.setInterval(flush, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [isPlaying, flush]);

  useEffect(() => {
    // `pagehide` rather than `unload`: it is the only one that fires reliably
    // on iOS, where a swipe away from the browser is the normal way to stop
    // watching. `visibilitychange` covers switching tabs and apps.
    const onHide = () => flush();
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onHide);
      flush();
    };
  }, [flush]);

  return flush;
}
