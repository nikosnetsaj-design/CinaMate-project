import type { WatchStatus, LifetimeStats } from '../types';

const HISTORY_KEY = 'ppv:watch-history';
const STATS_KEY = 'ppv:lifetime-stats';
const MARATHON_KEY = 'ppv:marathon-state';

type HistoryEntry = { contentId: string; positionSec: number; status: WatchStatus; updatedAt: number };
type MarathonState = { playlistId: string; index: number; updatedAt: number };

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

export function saveProgress(contentId: string, positionSec: number) {
  const history = getHistory();
  const prevStatus = history[contentId]?.status ?? 'not_started';
  history[contentId] = {
    contentId,
    positionSec,
    status: prevStatus === 'completed' ? 'completed' : 'in_progress',
    updatedAt: Date.now(),
  };
  writeJson(HISTORY_KEY, history);
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
