import type { Item, Kind, Status, Quality } from "../types";
import type { PlayerSource } from "../store/usePlayerSources";

/**
 * The advanced filters, as one serialisable object.
 *
 * Every field is optional and an absent field means "don't care" — never
 * "must be empty". That distinction is what keeps a library built before the
 * catalogue metadata existed usable: a title with no `studio` is invisible to
 * a studio filter, which is correct, but stays visible to every other one.
 */
export interface Filters {
  kind?: Kind;
  status?: Status;
  genre?: string;
  studio?: string;
  country?: string;
  /** ISO 639-1 code, matched against the title's spoken languages. */
  audioLang?: string;
  quality?: Quality;
  /** Only titles that have at least one subtitle track configured. */
  hasSubtitles?: boolean;
  yearFrom?: number;
  yearTo?: number;
  /** Minutes. For a series this is the per-episode runtime, as stored. */
  runtimeMax?: number;
  runtimeMin?: number;
  /** Your own 1–10 vote. */
  voteMin?: number;
  /** TMDB's 0–10 average — a different question, so a separate control. */
  tmdbRatingMin?: number;
}

export const EMPTY_FILTERS: Filters = {};

export function activeFilterCount(filters: Filters): number {
  return Object.values(filters).filter((v) => v !== undefined && v !== "" && v !== false).length;
}

/**
 * Subtitles are the one filter that cannot be answered from the library record:
 * `.vtt` tracks live in the player's own store, deliberately (see
 * usePlayerSources). The caller passes a lookup rather than this module
 * importing the store, so the filter stays a pure function and the library
 * page keeps working for someone who has never opened the player.
 */
export type SourceLookup = (itemId: string) => PlayerSource | undefined;

export function applyFilters(items: Item[], filters: Filters, lookupSource?: SourceLookup): Item[] {
  return items.filter((item) => {
    if (filters.kind && item.kind !== filters.kind) return false;
    if (filters.status && item.status !== filters.status) return false;
    if (filters.genre && item.genre !== filters.genre) return false;
    if (filters.studio && item.studio !== filters.studio) return false;
    if (filters.country && !(item.countries ?? []).includes(filters.country)) return false;
    if (filters.audioLang && !(item.audioLangs ?? []).includes(filters.audioLang)) return false;
    if (filters.quality && item.quality !== filters.quality) return false;

    if (filters.hasSubtitles) {
      const source = lookupSource?.(item.id);
      if (!source || source.subtitles.length === 0) return false;
    }

    if (filters.yearFrom !== undefined && item.year < filters.yearFrom) return false;
    if (filters.yearTo !== undefined && item.year > filters.yearTo) return false;

    // A runtime of 0 means "unknown", not "instant": a length filter must not
    // silently delete every title TMDB never gave a duration for.
    if (filters.runtimeMin !== undefined && (!item.runtime || item.runtime < filters.runtimeMin)) return false;
    if (filters.runtimeMax !== undefined && (!item.runtime || item.runtime > filters.runtimeMax)) return false;

    if (filters.voteMin !== undefined && (item.vote ?? 0) < filters.voteMin) return false;
    if (filters.tmdbRatingMin !== undefined && (item.tmdbRating ?? 0) < filters.tmdbRatingMin) return false;

    return true;
  });
}

// ---------------------------------------------------------------------------
// Option lists.
//
// Built from the library rather than from a fixed table, so the studio menu
// offers the studios you actually own and the country menu the countries you
// actually watch. A fixed list would be mostly options that match nothing —
// and would go stale the first time TMDB renamed a company.
// ---------------------------------------------------------------------------

function tally(values: string[]): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

export function genreOptions(items: Item[]) {
  return tally(items.map((i) => i.genre));
}

export function studioOptions(items: Item[]) {
  return tally(items.map((i) => i.studio ?? ""));
}

export function countryOptions(items: Item[]) {
  return tally(items.flatMap((i) => i.countries ?? []));
}

export function audioLangOptions(items: Item[]) {
  return tally(items.flatMap((i) => i.audioLangs ?? []));
}

export function qualityOptions(items: Item[]) {
  return tally(items.map((i) => i.quality ?? ""));
}

// Intl.DisplayNames turns "US" into "Stati Uniti" and "ja" into "giapponese"
// without shipping a table of our own — and it localises for free. Wrapped
// because it throws on codes it doesn't recognise, and a filter menu should
// print the raw code rather than take the page down with it.
const countryNames = safeDisplayNames("region");
const languageNames = safeDisplayNames("language");

function safeDisplayNames(type: "region" | "language"): Intl.DisplayNames | null {
  try {
    return new Intl.DisplayNames(["it"], { type });
  } catch {
    return null;
  }
}

function displayName(names: Intl.DisplayNames | null, code: string): string {
  try {
    return names?.of(code) ?? code;
  } catch {
    return code;
  }
}

export function countryLabel(code: string): string {
  return displayName(countryNames, code);
}

export function languageLabel(code: string): string {
  const name = displayName(languageNames, code);
  return name.charAt(0).toUpperCase() + name.slice(1);
}
