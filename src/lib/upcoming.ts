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
        fetchedAt: Date.now(),
      };
      dateCache.set(key, fresh);
      return fresh;
    }
    const date = await getReleaseDate(item.tmdbId!, "movie", apiKey);
    const fresh = { date, season: null, episode: null, fetchedAt: Date.now() };
    dateCache.set(key, fresh);
    return fresh;
  } catch {
    // Offline or rate limited: skip this title rather than failing the sweep.
    return null;
  }
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
