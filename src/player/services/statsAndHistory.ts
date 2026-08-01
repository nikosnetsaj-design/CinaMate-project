import type { WatchStatus, LifetimeStats } from '../types';

export const HISTORY_KEY = 'ppv:watch-history';
const STATS_KEY = 'ppv:lifetime-stats';
const MARATHON_KEY = 'ppv:marathon-state';
export const DAILY_KEY = 'ppv:daily-seconds';

/**
 * Fired after any write here, so the library side of the app (the "Continua a
 * guardare" row, the profile dashboard) can redraw while a video is playing in
 * another tab or on the route next door. `storage` events only reach *other*
 * tabs, which is exactly the case this covers for the tab doing the watching.
 */
export const PROGRESS_EVENT = 'cinemate:playback-progress';

export type PlaybackHistoryEntry = {
  contentId: string;
  positionSec: number;
  /**
   * Length of the title as the player measured it. Absent in entries written
   * before this field existed and for streams whose duration never resolved —
   * read it as "unknown", never as zero.
   */
  durationSec?: number;
  status: WatchStatus;
  updatedAt: number;
};

type HistoryEntry = PlaybackHistoryEntry;
type MarathonState = { playlistId: string; index: number; updatedAt: number };

/** Seconds actually played, bucketed by local calendar day (`yyyy-mm-dd`). */
export type DailySeconds = Record<string, number>;

function announce() {
  try {
    window.dispatchEvent(new Event(PROGRESS_EVENT));
  } catch {
    // No window (tests, SSR): the stored value is still correct, only the
    // live redraw is lost.
  }
}

function localDay(at = new Date()): string {
  // Deliberately local rather than `toISOString()`: an episode watched at
  // 01:00 belongs to the night you watched it, not to the previous UTC day.
  const y = at.getFullYear();
  const m = String(at.getMonth() + 1).padStart(2, '0');
  const d = String(at.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or unavailable — fail silently, this is best-effort persistence
  }
  // Production apps should also debounce-sync this to a backend (e.g. POST
  // /api/history) so progress carries across devices — see README
  // "Cross-device sync".
}

function getHistory(): Record<string, HistoryEntry> {
  return readJson(HISTORY_KEY, {} as Record<string, HistoryEntry>);
}

// ---------- Resume / history / status ----------

export function saveProgress(contentId: string, positionSec: number, durationSec?: number) {
  const history = getHistory();
  const prev = history[contentId];
  const prevStatus = prev?.status ?? 'not_started';
  history[contentId] = {
    contentId,
    positionSec,
    // A duration of 0 is what a live or still-loading manifest reports, so it
    // must never overwrite a length that was already measured.
    durationSec: durationSec && durationSec > 0 ? durationSec : prev?.durationSec,
    status: prevStatus === 'completed' ? 'completed' : 'in_progress',
    updatedAt: Date.now(),
  };
  writeJson(HISTORY_KEY, history);
  announce();
}

/** Everything known about a resume point, or null for an untouched title. */
export function getPlaybackEntry(contentId: string): PlaybackHistoryEntry | null {
  return getHistory()[contentId] ?? null;
}

export function getPlaybackHistory(): Record<string, PlaybackHistoryEntry> {
  return getHistory();
}

/**
 * Drops a title's resume point — "rimuovi da Continua a guardare". The lifetime
 * totals are left alone on purpose: those hours were watched either way.
 */
export function clearProgress(contentId: string) {
  const history = getHistory();
  if (!(contentId in history)) return;
  delete history[contentId];
  writeJson(HISTORY_KEY, history);
  announce();
}

export function getResumePosition(contentId: string): number {
  return getHistory()[contentId]?.positionSec ?? 0;
}

export function getWatchStatus(contentId: string): WatchStatus {
  return getHistory()[contentId]?.status ?? 'not_started';
}

export function setWatchStatus(contentId: string, status: WatchStatus) {
  const history = getHistory();
  history[contentId] = { ...(history[contentId] ?? { contentId, positionSec: 0 }), status, updatedAt: Date.now() };
  writeJson(HISTORY_KEY, history);
}

/** When the status was last written, or null if the title has no history. */
export function getWatchUpdatedAt(contentId: string): number | null {
  return getHistory()[contentId]?.updatedAt ?? null;
}

export function markWatched(contentId: string) {
  setWatchStatus(contentId, 'completed');
  const stats = getLifetimeStats();
  if (!stats.completedContentIds.includes(contentId)) {
    stats.completedContentIds.push(contentId);
    writeJson(STATS_KEY, stats);
  }
}

export function getFullHistory(): HistoryEntry[] {
  return Object.values(getHistory()).sort((a, b) => b.updatedAt - a.updatedAt);
}

// ---------- Lifetime + session stats ----------

export function getLifetimeStats(): LifetimeStats {
  return readJson(STATS_KEY, {
    totalWatchedSec: 0,
    totalPauseCount: 0,
    completedContentIds: [],
    completedSeriesIds: [],
    completedMarathons: 0,
  });
}

export function addWatchedSeconds(sec: number) {
  const stats = getLifetimeStats();
  stats.totalWatchedSec += sec;
  writeJson(STATS_KEY, stats);

  // Same seconds, kept a second time by day. The lifetime counter can only
  // ever answer "how much in total"; the profile's activity chart, the daily
  // record and the streak all need to know *when*, and that is not something
  // a single running total can be asked afterwards.
  const daily = getDailySeconds();
  const day = localDay();
  daily[day] = (daily[day] ?? 0) + sec;
  writeJson(DAILY_KEY, pruneDaily(daily));
}

export function getDailySeconds(): DailySeconds {
  const raw = readJson<DailySeconds>(DAILY_KEY, {});
  const clean: DailySeconds = {};
  for (const [day, sec] of Object.entries(raw)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(day) && typeof sec === 'number' && Number.isFinite(sec) && sec > 0) {
      clean[day] = sec;
    }
  }
  return clean;
}

/**
 * Restores days from a backup by taking the *larger* of the two readings for
 * each day rather than replacing the map.
 *
 * Merging is what the data means: two devices watching on the same day both
 * hold a partial truth, and neither is the whole one. Taking the larger of the
 * two is the honest reconciliation available without a server — it never
 * invents minutes, and it never throws away the device that saw more.
 */
export function restoreDailySeconds(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const merged = getDailySeconds();
  for (const [day, sec] of Object.entries(value as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    if (typeof sec !== 'number' || !Number.isFinite(sec) || sec <= 0) continue;
    merged[day] = Math.max(merged[day] ?? 0, Math.round(sec));
  }
  writeJson(DAILY_KEY, pruneDaily(merged));
}

/**
 * Two years of days is 730 keys and a few kB — enough for every window the
 * profile offers, bounded so a long-lived install cannot grow this without
 * limit inside a storage budget shared with the whole library.
 */
const DAILY_RETENTION_DAYS = 730;

function pruneDaily(daily: DailySeconds): DailySeconds {
  const days = Object.keys(daily);
  if (days.length <= DAILY_RETENTION_DAYS) return daily;
  const keep = days.sort().slice(-DAILY_RETENTION_DAYS);
  return Object.fromEntries(keep.map((d) => [d, daily[d]]));
}

export function incrementPauseCount() {
  const stats = getLifetimeStats();
  stats.totalPauseCount += 1;
  writeJson(STATS_KEY, stats);
}

export function markSeriesCompleted(seriesId: string) {
  const stats = getLifetimeStats();
  if (!stats.completedSeriesIds.includes(seriesId)) {
    stats.completedSeriesIds.push(seriesId);
    writeJson(STATS_KEY, stats);
  }
}

export function markMarathonCompleted() {
  const stats = getLifetimeStats();
  stats.completedMarathons += 1;
  writeJson(STATS_KEY, stats);
}

// ---------- Marathon persistence ----------

export function saveMarathonState(playlistId: string, index: number) {
  writeJson(MARATHON_KEY, { playlistId, index, updatedAt: Date.now() } as MarathonState);
}

export function getMarathonState(playlistId: string): number | null {
  const state = readJson<MarathonState | null>(MARATHON_KEY, null);
  return state && state.playlistId === playlistId ? state.index : null;
}
