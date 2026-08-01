import type { Item } from "../types";
import type { PlaybackHistoryEntry } from "../player/services/statsAndHistory";

/**
 * A title you are in the middle of, with everything the card has to say:
 * where you are, how much is left, and which episode comes back on screen.
 */
export interface ResumeEntry {
  item: Item;
  /** 0–100, whichever measure of progress the title actually has. */
  pct: number;
  /** Minutes still to go — of the current episode, or of the whole series. */
  remainingMin: number;
  /** "S2 · E4" for a series, the year for a film. */
  label: string;
  /** Second to resume from. 0 when only the episode counter knows anything. */
  positionSec: number;
  /** True when a real playhead exists: the card can then promise the exact frame. */
  hasPlayhead: boolean;
  /** Sort key — last time this title moved, in ms. */
  touchedAt: number;
}

const SERIES_KINDS = new Set(["serie", "anime"]);

/** Milliseconds in a day, for the "recente" cut-off below. */
const DAY = 86_400_000;

/**
 * How far back a resume point stays interesting. Six months of not touching
 * something is an answer in itself; the title stays in the library, in its own
 * status, and simply stops occupying the row meant for what you are watching.
 */
const STALE_AFTER = 180 * DAY;

/**
 * Which season and episode a series is sitting on.
 *
 * Derived by spreading the episode count evenly over the seasons, because that
 * is genuinely all CineMate knows: the library stores totals, not a per-season
 * breakdown. It is right for the great majority of shows and honestly wrong for
 * the ones with a six-episode final season — which is why nothing else in the
 * app is computed from it, and why the label is never used to decide anything,
 * only to be read.
 */
export function episodePosition(item: Item): { season: number; episode: number } | null {
  if (!item.episodes || !SERIES_KINDS.has(item.kind)) return null;
  const next = Math.min(item.episodes, (item.seen || 0) + 1);
  const seasons = Math.max(1, item.seasons || 1);
  const perSeason = Math.max(1, Math.ceil(item.episodes / seasons));
  const season = Math.min(seasons, Math.ceil(next / perSeason));
  return { season, episode: next - (season - 1) * perSeason };
}

export function resumeLabel(item: Item): string {
  const pos = episodePosition(item);
  if (pos) return `S${pos.season} · E${pos.episode}`;
  return item.year ? String(item.year) : "Film";
}

/** Timestamp of the last thing that happened to a title, from either source. */
function touchedAt(item: Item, entry: PlaybackHistoryEntry | undefined, fallbackDate: string | undefined): number {
  if (entry) return entry.updatedAt;
  // No playhead: fall back to the diary, then to the day it was filed, so a
  // library used entirely by hand still orders the row the same way.
  const date = fallbackDate ?? item.added;
  const parsed = Date.parse(`${date}T12:00:00`);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildEntry(
  item: Item,
  entry: PlaybackHistoryEntry | undefined,
  lastDiaryDate: string | undefined,
): ResumeEntry | null {
  const playing = entry && entry.status !== "completed" && entry.positionSec > 30;
  const duration = entry?.durationSec && entry.durationSec > 0 ? entry.durationSec : item.runtime * 60;

  if (playing && duration > 0) {
    // A playhead is the sharper answer wherever it exists: it knows the minute,
    // not just the episode.
    const pct = Math.min(100, Math.round((entry.positionSec / duration) * 100));
    return {
      item,
      pct,
      remainingMin: Math.max(0, Math.round((duration - entry.positionSec) / 60)),
      label: resumeLabel(item),
      positionSec: Math.floor(entry.positionSec),
      hasPlayhead: true,
      touchedAt: entry.updatedAt,
    };
  }

  // Nothing played here, so progress is whatever the library itself records:
  // episodes ticked off for a series, and for a film the fact that it is open.
  const seen = item.seen || 0;
  if (item.episodes && SERIES_KINDS.has(item.kind)) {
    const pct = Math.min(100, Math.round((seen / item.episodes) * 100));
    return {
      item,
      pct,
      remainingMin: Math.max(0, (item.episodes - seen) * item.runtime),
      label: resumeLabel(item),
      positionSec: 0,
      hasPlayhead: false,
      touchedAt: touchedAt(item, entry, lastDiaryDate),
    };
  }

  return {
    item,
    pct: 0,
    remainingMin: item.runtime,
    label: resumeLabel(item),
    positionSec: 0,
    hasPlayhead: false,
    touchedAt: touchedAt(item, entry, lastDiaryDate),
  };
}

/**
 * The "Continua a guardare" list: everything started and not finished, most
 * recently touched first.
 *
 * Two things can put a title here — a playhead left by the player, or a status
 * of *In visione* / *In pausa* set by hand — because both mean the same thing
 * to someone looking at the home page, and an app that only remembered the
 * first would forget every title watched somewhere else.
 */
export function continueWatching(
  items: Item[],
  progress: Record<string, PlaybackHistoryEntry>,
  lastSeenByItem: Record<string, string> = {},
  now = Date.now(),
): ResumeEntry[] {
  return items
    .filter((item) => {
      if (item.status === "Visto" || item.status === "Abbandonato") return false;
      const entry = progress[item.id];
      if (entry && entry.status !== "completed" && entry.positionSec > 30) return true;
      if (item.status === "In visione" || item.status === "In pausa") return true;
      return false;
    })
    .map((item) => buildEntry(item, progress[item.id], lastSeenByItem[item.id]))
    .filter((entry): entry is ResumeEntry => entry !== null)
    // 98% is the closing credits, not something left half-watched.
    .filter((entry) => entry.pct < 98)
    .filter((entry) => entry.touchedAt === 0 || now - entry.touchedAt < STALE_AFTER)
    .sort((a, b) => b.touchedAt - a.touchedAt);
}

/** Last diary date per title — the fallback ordering for hand-kept libraries. */
export function lastSeenDates(history: { itemId: string; date: string }[]): Record<string, string> {
  const dates: Record<string, string> = {};
  for (const h of history) {
    if (!dates[h.itemId] || h.date > dates[h.itemId]) dates[h.itemId] = h.date;
  }
  return dates;
}
