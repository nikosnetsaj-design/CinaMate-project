import type { HistoryEntry, Item } from "../types";

export interface DiaryEntry {
  item: Item;
  action: HistoryEntry["action"];
  count: number;
  /** Le voci del diario raccolte in questa riga: le note si scrivono su tutte. */
  ids: string[];
  with?: string;
  where?: string;
}

export interface DiaryDay {
  date: string;
  entries: DiaryEntry[];
}

export function groupDiary(history: HistoryEntry[], items: Item[]): DiaryDay[] {
  const itemById = new Map(items.map((i) => [i.id, i]));
  const byDate = new Map<string, Map<string, DiaryEntry>>();

  for (const h of history) {
    const item = itemById.get(h.itemId);
    if (!item) continue;
    const dayMap = byDate.get(h.date) ?? new Map<string, DiaryEntry>();
    const key = `${h.itemId}:${h.action}`;
    const existing = dayMap.get(key);
    if (existing) {
      existing.count += h.count ?? 1;
      existing.ids.push(h.id);
      existing.with = existing.with || h.with;
      existing.where = existing.where || h.where;
    } else dayMap.set(key, { item, action: h.action, count: h.count ?? 1, ids: [h.id], with: h.with, where: h.where });
    byDate.set(h.date, dayMap);
  }

  return Array.from(byDate.entries())
    .map(([date, dayMap]) => ({ date, entries: Array.from(dayMap.values()) }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

// --- La mappa dell'anno -------------------------------------------------------

/**
 * Quanto hai guardato ogni giorno, in visioni: un film è uno, un episodio è
 * uno. Le ore sarebbero più precise ma meno oneste — metà delle durate sono
 * stime — mentre «tre episodi» è un fatto del diario.
 */
export function dayCounts(history: HistoryEntry[], year: number): Map<string, number> {
  const out = new Map<string, number>();
  const prefix = `${year}-`;
  for (const h of history) {
    if (!h.date.startsWith(prefix)) continue;
    out.set(h.date, (out.get(h.date) ?? 0) + (h.count ?? 1));
  }
  return out;
}

function iso(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Le settimane dell'anno come colonne da lunedì a domenica, come un
 * calendario italiano. I giorni fuori dall'anno restano `null`, così la prima
 * e l'ultima colonna partono e finiscono al giorno giusto.
 */
export function yearWeeks(year: number): (string | null)[][] {
  const first = new Date(Date.UTC(year, 0, 1));
  const offset = (first.getUTCDay() + 6) % 7; // lunedì = 0
  const weeks: (string | null)[][] = [];
  const cursor = new Date(first);
  cursor.setUTCDate(cursor.getUTCDate() - offset);
  while (cursor.getUTCFullYear() <= year) {
    const week: (string | null)[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(cursor.getUTCFullYear() === year ? iso(cursor) : null);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(week);
    if (cursor.getUTCFullYear() > year) break;
  }
  return weeks;
}

/** Cinque gradini: niente, uno, due-tre, quattro-sei, sette e oltre. */
export function heatLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

// --- Un anno fa ----------------------------------------------------------------

export interface YearAgo {
  date: string;
  /** Lo stesso giorno esatto, o il più vicino entro tre giorni. */
  exact: boolean;
  entries: DiaryEntry[];
}

/**
 * Cosa guardavi un anno fa. Lo stesso giorno se il diario ce l'ha, altrimenti
 * il giorno più vicino entro tre: «più o meno un anno fa» resta un ricordo,
 * un mese di scarto no.
 */
export function yearAgo(days: DiaryDay[], today: string): YearAgo | null {
  const [y, m, d] = today.split("-").map(Number);
  const target = Date.UTC(y - 1, m - 1, d);
  let best: { day: DiaryDay; gap: number } | null = null;
  for (const day of days) {
    const [dy, dm, dd] = day.date.split("-").map(Number);
    const gap = Math.abs(Date.UTC(dy, dm - 1, dd) - target) / 86_400_000;
    if (gap <= 3 && (!best || gap < best.gap)) best = { day, gap };
  }
  return best ? { date: best.day.date, exact: best.gap === 0, entries: best.day.entries } : null;
}

/** I valori già scritti, i più usati prima: suggerimenti per le note. */
export function noteSuggestions(history: HistoryEntry[], field: "with" | "where", limit = 6): string[] {
  const counts = new Map<string, number>();
  for (const h of history) {
    const v = h[field]?.trim();
    if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([v]) => v);
}
