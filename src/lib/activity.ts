import type { HistoryEntry, Item } from "../types";
import type { DailySeconds } from "../player/services/statsAndHistory";

/** One column of the activity chart. */
export interface ActivityBucket {
  /** `yyyy-mm-dd` for a day, `yyyy-mm` for a month. */
  key: string;
  /** Short axis label — "lun", "12", "gen". */
  label: string;
  minutes: number;
}

export type ActivityRange = "settimana" | "mese" | "anno";

export const ACTIVITY_RANGES: { id: ActivityRange; label: string }[] = [
  { id: "settimana", label: "Settimana" },
  { id: "mese", label: "Mese" },
  { id: "anno", label: "Anno" },
];

const WEEKDAY = new Intl.DateTimeFormat("it-IT", { weekday: "short" });
const MONTH_SHORT = new Intl.DateTimeFormat("it-IT", { month: "short" });
const FULL_DAY = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" });

export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDay(key: string): string {
  return FULL_DAY.format(new Date(`${key}T12:00:00`));
}

/**
 * Minutes watched per calendar day, from both things that know: the player's
 * own per-second counter, and the diary.
 *
 * They are added rather than reconciled, and that is a deliberate imprecision.
 * Marking an episode watched by hand *after* streaming it here would count it
 * twice — but the alternative, trusting one source only, loses every hour
 * watched on a television for a library that is mostly kept by hand. The chart
 * answers "when am I watching", and for that question the shape is what matters.
 */
export function dailyMinutes(items: Item[], history: HistoryEntry[], daily: DailySeconds): Map<string, number> {
  const minutes = new Map<string, number>();

  for (const [day, seconds] of Object.entries(daily)) {
    minutes.set(day, Math.round(seconds / 60));
  }

  const byId = new Map(items.map((i) => [i.id, i]));
  for (const entry of history) {
    const item = byId.get(entry.itemId);
    if (!item || !item.runtime) continue;
    const isFilm = item.kind === "film" || item.kind === "doc";
    let added = 0;
    if (entry.action === "episode") added = item.runtime * (entry.count ?? 1);
    else if (entry.action === "rewatch") added = item.runtime;
    // A film completed by hand is its whole runtime; a series marked complete
    // is not, or every finished show would land on one single day as a spike
    // of forty hours it never took.
    else if (entry.action === "watched" && isFilm) added = item.runtime;
    if (added > 0) minutes.set(entry.date, (minutes.get(entry.date) ?? 0) + added);
  }

  return minutes;
}

/** The chart's columns for a range, including the empty days — gaps are data. */
export function activityBuckets(minutes: Map<string, number>, range: ActivityRange, now = new Date()): ActivityBucket[] {
  if (range === "anno") {
    const monthly = new Map<string, number>();
    for (const [day, min] of minutes) monthly.set(day.slice(0, 7), (monthly.get(day.slice(0, 7)) ?? 0) + min);
    return Array.from({ length: 12 }, (_, idx) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - idx), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return { key, label: MONTH_SHORT.format(d).replace(".", ""), minutes: monthly.get(key) ?? 0 };
    });
  }

  const days = range === "settimana" ? 7 : 30;
  return Array.from({ length: days }, (_, idx) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1 - idx));
    const key = dayKey(d);
    return {
      key,
      label: range === "settimana" ? WEEKDAY.format(d).replace(".", "") : String(d.getDate()),
      minutes: minutes.get(key) ?? 0,
    };
  });
}

/** The single best day on record — the article's "record personale". */
export function personalRecord(minutes: Map<string, number>): { date: string; minutes: number } | null {
  let best: { date: string; minutes: number } | null = null;
  for (const [date, min] of minutes) {
    if (min > 0 && (!best || min > best.minutes)) best = { date, minutes: min };
  }
  return best;
}

/** Consecutive days up to today with something watched. Today may still be empty. */
export function currentStreak(minutes: Map<string, number>, now = new Date()): number {
  let streak = 0;
  for (let back = 0; back < 400; back++) {
    const key = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - back));
    const watched = (minutes.get(key) ?? 0) > 0;
    if (watched) streak++;
    // A day that has barely started is not yet a broken streak.
    else if (back > 0) break;
  }
  return streak;
}

export interface Level {
  level: number;
  title: string;
  /** Hours into the current level. */
  hoursInto: number;
  /** Hours the level spans, or null once the last one is reached. */
  hoursSpan: number | null;
  /** 0–100 towards the next level; 100 at the top. */
  pct: number;
  /** Hours still needed, or null at the top. */
  hoursToNext: number | null;
  nextTitle: string | null;
}

/**
 * The ladder. Deliberately shallow at the bottom and long at the top: the first
 * levels should arrive while you are still deciding whether to keep a diary at
 * all, and the last one should take years.
 */
const LEVELS: { at: number; title: string }[] = [
  { at: 0, title: "Spettatore" },
  { at: 10, title: "Habitué" },
  { at: 40, title: "Appassionato" },
  { at: 100, title: "Cinefilo" },
  { at: 250, title: "Maratoneta" },
  { at: 500, title: "Divoratore di serie" },
  { at: 1000, title: "Critico" },
  { at: 2500, title: "Archivista" },
  { at: 5000, title: "Leggenda" },
];

export function levelFor(hours: number): Level {
  const safeHours = Math.max(0, hours);
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (safeHours >= LEVELS[i].at) idx = i;
  }
  const current = LEVELS[idx];
  const next = LEVELS[idx + 1] ?? null;
  const hoursInto = safeHours - current.at;
  const hoursSpan = next ? next.at - current.at : null;

  return {
    level: idx + 1,
    title: current.title,
    hoursInto: Math.round(hoursInto),
    hoursSpan,
    pct: hoursSpan ? Math.min(100, Math.round((hoursInto / hoursSpan) * 100)) : 100,
    hoursToNext: next ? Math.max(0, Math.ceil(next.at - safeHours)) : null,
    nextTitle: next?.title ?? null,
  };
}

export interface SeriesRank {
  item: Item;
  episodes: number;
  minutes: number;
  pct: number;
}

/** Series ranked by episodes actually watched — the article's "classifica serie". */
export function seriesRanking(items: Item[], limit = 8): SeriesRank[] {
  return items
    .filter((i) => (i.kind === "serie" || i.kind === "anime") && (i.seen || 0) > 0)
    .map((item) => ({
      item,
      episodes: item.seen || 0,
      minutes: (item.seen || 0) * item.runtime,
      pct: item.episodes ? Math.min(100, Math.round(((item.seen || 0) / item.episodes) * 100)) : 0,
    }))
    .sort((a, b) => b.episodes - a.episodes || a.item.title.localeCompare(b.item.title))
    .slice(0, limit);
}
