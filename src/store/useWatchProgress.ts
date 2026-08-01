import { useEffect } from "react";
import { create } from "zustand";
import {
  DAILY_KEY,
  HISTORY_KEY,
  PROGRESS_EVENT,
  clearProgress,
  getDailySeconds,
  getPlaybackHistory,
  type DailySeconds,
  type PlaybackHistoryEntry,
} from "../player/services/statsAndHistory";

/**
 * The playhead, as the rest of the app sees it.
 *
 * The player already writes every position to localStorage, but the library
 * side of CineMate is built on zustand stores and would never learn that a
 * value changed. This is the bridge: one place that reads those two keys, and
 * a subscription that makes "Continua a guardare" and the profile redraw while
 * something is playing — in this tab (custom event) or in another (`storage`).
 */
interface WatchProgressState {
  progress: Record<string, PlaybackHistoryEntry>;
  daily: DailySeconds;
  refresh: () => void;
  /** Forgets a resume point — the row's "rimuovi" action. */
  forget: (contentId: string) => void;
}

export const useWatchProgress = create<WatchProgressState>((set) => ({
  progress: getPlaybackHistory(),
  daily: getDailySeconds(),
  refresh: () => set({ progress: getPlaybackHistory(), daily: getDailySeconds() }),
  forget: (contentId) => {
    clearProgress(contentId);
    set({ progress: getPlaybackHistory() });
  },
}));

/**
 * Keeps the store in step with whoever is writing. Mounted once, at the app
 * root: several copies would each re-read the same two keys on every tick a
 * playing video produces.
 */
export function useWatchProgressSync() {
  const refresh = useWatchProgress((s) => s.refresh);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === HISTORY_KEY || e.key === DAILY_KEY) refresh();
    };
    window.addEventListener(PROGRESS_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(PROGRESS_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, [refresh]);
}
