import { getNextEpisode, getReleaseDate } from "./tmdb";
import { daysBetweenToday } from "./format";
import type { Item } from "../types";

export interface UpcomingEntry {
  item: Item;
  /** ISO `yyyy-mm-dd`. */
  date: string;
  type: "episodio" | "film";
  season: number | null;
  episode: number | null;
}

interface CachedDate {
  date: string | null;
  season: number | null;
  episode: number | null;
  /**
   * L'ultima data *passata*: quando il film è uscito, o quando è andato in onda
   * l'ultimo episodio disponibile. Serve a distinguere «sta per arrivare» da
   * «è arrivato la settimana scorsa», che sono due pastiglie diverse e finora
   * erano la stessa (nessuna).
   */
  lastDate: string | null;
  fetchedAt: number;
}

/**
 * Air and release dates change at most daily, while the library re-renders on
 * every edit. Caching per title keeps a fav toggle from replaying the whole set
 * of TMDB round-trips, and survives navigating away and back.
 */
const dateCache = new Map<string, CachedDate>();
const TTL_MS = 6 * 60 * 60 * 1000;

/** How many titles a single sweep will ask about, to stay polite to the API. */
const MAX_LOOKUPS = 24;

export function trackedForUpcoming(items: Item[]): Item[] {
  return items.filter(
    (i) =>
      i.tmdbId != null &&
      (i.status === "In visione" || i.status === "Da vedere") &&
      (i.tmdbMediaType === "tv" || i.tmdbMediaType === "movie"),
  );
}

/** Stable identity of the tracked set, for effect dependencies. */
export function trackedKey(items: Item[]): string {
  return trackedForUpcoming(items)
    .map((i) => `${i.tmdbMediaType}:${i.tmdbId}`)
    .sort()
    .join(",");
}

async function lookup(item: Item, apiKey: string): Promise<CachedDate | null> {
  const key = `${item.tmdbMediaType}:${item.tmdbId}`;
  const hit = dateCache.get(key);
  if (hit && Date.now() - hit.fetchedAt < TTL_MS) return hit;

  try {
    if (item.tmdbMediaType === "tv") {
      const next = await getNextEpisode(item.tmdbId!, apiKey);
      const fresh = {
        date: next.airDate,
        season: next.seasonNumber,
        episode: next.episodeNumber,
        lastDate: next.lastAirDate,
        fetchedAt: Date.now(),
      };
      dateCache.set(key, fresh);
      return fresh;
    }
    const date = await getReleaseDate(item.tmdbId!, "movie", apiKey);
    // Per un film la data è una sola: se è passata è quella dell'uscita, se è
    // futura è quella dell'attesa. Non ci sono due campi da riempire.
    const past = date != null && daysBetweenToday(date) < 0;
    const fresh = {
      date: past ? null : date,
      season: null,
      episode: null,
      lastDate: past ? date : null,
      fetchedAt: Date.now(),
    };
    dateCache.set(key, fresh);
    return fresh;
  } catch {
    // Offline or rate limited: skip this title rather than failing the sweep.
    return null;
  }
}

/**
 * Le date di un titolo, in avanti e all'indietro: cosa sta per uscire e quando
 * è uscito l'ultimo pezzo disponibile.
 *
 * È la stessa ricognizione di `loadUpcoming` — stessa cache, stesse richieste —
 * esposta senza il filtro sul futuro, perché le pastiglie sulle copertine hanno
 * bisogno anche del passato recente.
 */
export interface TitleDates {
  itemId: string;
  type: "episodio" | "film";
  /** La prossima uscita, se c'è. */
  date: string | null;
  season: number | null;
  episode: number | null;
  /** L'ultima uscita già avvenuta, se nota. */
  lastDate: string | null;
}

export async function loadTitleDates(items: Item[], apiKey: string): Promise<TitleDates[]> {
  if (!apiKey) return [];
  const tracked = trackedForUpcoming(items).slice(0, MAX_LOOKUPS);

  const results = await Promise.all(
    tracked.map(async (item): Promise<TitleDates | null> => {
      const found = await lookup(item, apiKey);
      if (!found) return null;
      return {
        itemId: item.id,
        type: item.tmdbMediaType === "tv" ? "episodio" : "film",
        date: found.date,
        season: found.season,
        episode: found.episode,
        lastDate: found.lastDate,
      };
    }),
  );

  return results.filter((r): r is TitleDates => r !== null);
}

/**
 * Everything with a date still ahead of it, oldest first. Films already in
 * cinemas are dropped — a release that has happened is not news — while a
 * series episode airing today is kept, because that is exactly the day it
 * matters.
 */
export async function loadUpcoming(items: Item[], apiKey: string): Promise<UpcomingEntry[]> {
  if (!apiKey) return [];
  const tracked = trackedForUpcoming(items).slice(0, MAX_LOOKUPS);

  const results = await Promise.all(
    tracked.map(async (item): Promise<UpcomingEntry | null> => {
      const found = await lookup(item, apiKey);
      if (!found?.date) return null;
      if (daysBetweenToday(found.date) < 0) return null;
      return {
        item,
        date: found.date,
        type: item.tmdbMediaType === "tv" ? "episodio" : "film",
        season: found.season,
        episode: found.episode,
      };
    }),
  );

  return results
    .filter((r): r is UpcomingEntry => r !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function groupByMonth(entries: UpcomingEntry[]): { month: string; entries: UpcomingEntry[] }[] {
  const groups = new Map<string, UpcomingEntry[]>();
  for (const entry of entries) {
    const month = entry.date.slice(0, 7);
    const bucket = groups.get(month);
    if (bucket) bucket.push(entry);
    else groups.set(month, [entry]);
  }
  return Array.from(groups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, list]) => ({ month, entries: list }));
}
