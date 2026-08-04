import type { Item } from "../types";
import type { TmdbSaga } from "./tmdb";
import { sagaKey, universeKey, type SagaKey } from "../store/useSagas";
import { UNIVERSES } from "./universes";

function fold(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Levenshtein distance, bounded: it stops as soon as the whole row exceeds
 * `max`, so comparing a query against a few hundred titles stays cheap enough
 * to run on every keystroke. Only two rows are kept — the full matrix is never
 * needed when all we want is the final number.
 */
export function editDistance(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return max + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/**
 * How many typos to forgive at a given length. None below five characters, one
 * up to seven, two from eight up. Scaling matters: two edits on a four-letter
 * word turns "Alien" into "Alias" and half the shelf, while two on
 * "Interstellar" is just a pair of slips on a long word.
 */
function tolerance(length: number): number {
  if (length < 5) return 0;
  if (length < 8) return 1;
  return 2;
}

/**
 * True when `needle` is a near-miss for some word inside `haystack`. Compared
 * word by word rather than against the whole string, because the distance from
 * "padrino" to "il padrino" is three edits — enough to reject the exact title
 * the user was reaching for.
 */
function fuzzyContains(haystack: string, needle: string): boolean {
  const max = tolerance(needle.length);
  if (max === 0) return false;
  for (const word of haystack.split(/[\s:,._'-]+/)) {
    if (!word) continue;
    // A word longer than the query can still be the one meant
    // ("interstellare" for "interstelar"), so compare against its prefix.
    if (editDistance(word.slice(0, needle.length + max), needle, max) <= max) return true;
  }
  return false;
}

/** Every string of an item worth matching a query against, folded once. */
function haystacks(item: Item): string[] {
  return [
    item.title,
    item.director,
    item.genre,
    item.notes,
    item.platform,
    item.overview,
    item.collectionName ?? "",
    item.studio ?? "",
    String(item.year),
    ...item.cast,
  ].map(fold);
}

export type MatchKind = "exact" | "fuzzy" | "none";

/**
 * Exact substring first, near-miss second. Three states rather than a boolean
 * so callers can tell them apart: the library only offers a correction when
 * everything on screen matched fuzzily, and saying "forse cercavi" over exact
 * hits would be nonsense.
 */
export function matchQuality(item: Item, query: string): MatchKind {
  const q = fold(query.trim());
  if (!q) return "exact";
  const fields = haystacks(item);
  if (fields.some((f) => f.includes(q))) return "exact";
  // Multi-word queries match per word, so "nolan interstelar" still lands:
  // every word has to appear somewhere, not all of them in the same field.
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length > 1 && words.every((w) => fields.some((f) => f.includes(w) || fuzzyContains(f, w)))) {
    return "fuzzy";
  }
  return fields.some((f) => fuzzyContains(f, q)) ? "fuzzy" : "none";
}

/**
 * Shared matcher so the command palette and the library filter stay in sync —
 * a query that finds a title in one place finds it in the other.
 */
export function matchesQuery(item: Item, query: string): boolean {
  return matchQuality(item, query) !== "none";
}

/**
 * The closest real title to a query, for the "forse cercavi" line. Returns null
 * when nothing is near enough to be worth offering: a wrong suggestion is worse
 * than none, because it sends the user to check a title they never meant.
 */
export function didYouMean(query: string, items: Item[]): string | null {
  const q = fold(query.trim());
  if (q.length < 4) return null;

  const max = tolerance(q.length) || 1;
  let best: { title: string; distance: number } | null = null;

  for (const item of items) {
    const title = fold(item.title);
    if (title.includes(q)) return null; // an exact hit exists; nothing to correct
    const distance = Math.min(
      editDistance(title, q, max),
      editDistance(title.slice(0, q.length + max), q, max),
    );
    if (distance <= max && (!best || distance < best.distance)) {
      best = { title: item.title, distance };
    }
  }
  return best?.title ?? null;
}

export type SearchGroup = "titolo" | "saga" | "persona";

export const GROUP_LABELS: Record<SearchGroup, string> = {
  titolo: "Titoli",
  saga: "Saghe e universi",
  persona: "Attori e registi",
};

export interface SearchHit {
  group: SearchGroup;
  /** Stable React key and identity for keyboard selection. */
  id: string;
  label: string;
  sublabel: string;
  item?: Item;
  sagaKey?: SagaKey;
  personName?: string;
}

const MAX_PER_GROUP = { titolo: 6, saga: 4, persona: 4 } as const;

/** Names come from the library itself, so the list stays small and offline. */
function peopleIndex(items: Item[]): Map<string, { name: string; asDirector: number; asActor: number }> {
  const index = new Map<string, { name: string; asDirector: number; asActor: number }>();

  const bump = (name: string, role: "asDirector" | "asActor") => {
    const clean = name.trim();
    if (!clean) return;
    const key = fold(clean);
    const entry = index.get(key) ?? { name: clean, asDirector: 0, asActor: 0 };
    entry[role] += 1;
    index.set(key, entry);
  };

  for (const item of items) {
    // A director field can hold several names: TV shows list every creator.
    for (const name of item.director.split(",")) bump(name, "asDirector");
    for (const name of item.cast) bump(name, "asActor");
  }
  return index;
}

function personSublabel(entry: { asDirector: number; asActor: number }): string {
  const parts: string[] = [];
  if (entry.asDirector) parts.push(`regia di ${entry.asDirector}`);
  if (entry.asActor) parts.push(`nel cast di ${entry.asActor}`);
  return parts.join(" · ");
}

/**
 * One query, every kind of answer, grouped rather than interleaved: a search
 * for "nolan" should offer the man and the films as two separate decisions, not
 * as one ranked soup where the person is lost between two Interstellars.
 */
export function smartSearch(query: string, items: Item[], sagas: Record<string, TmdbSaga>): SearchHit[] {
  const q = fold(query.trim());
  if (!q) return [];

  const titles: SearchHit[] = items
    .filter((item) => matchesQuery(item, query))
    .slice(0, MAX_PER_GROUP.titolo)
    .map((item) => ({
      group: "titolo" as const,
      id: `titolo:${item.id}`,
      label: item.title,
      sublabel: [item.year, item.genre, item.status].filter(Boolean).join(" · "),
      item,
    }));

  const sagaHits: SearchHit[] = Object.values(sagas)
    .filter((saga) => fold(saga.name).includes(q))
    .slice(0, MAX_PER_GROUP.saga)
    .map((saga) => ({
      group: "saga" as const,
      id: `saga:${saga.id}`,
      label: saga.name,
      sublabel: `${saga.parts.length} capitoli`,
      sagaKey: sagaKey(saga.id),
    }));

  const universeHits: SearchHit[] = UNIVERSES.filter((u) => fold(u.name).includes(q)).map((u) => ({
    group: "saga" as const,
    id: `universe:${u.id}`,
    label: u.name,
    sublabel: "Universo",
    sagaKey: universeKey(u.id),
  }));

  const people: SearchHit[] = Array.from(peopleIndex(items).values())
    .filter((entry) => fold(entry.name).includes(q))
    .sort((a, b) => b.asDirector + b.asActor - (a.asDirector + a.asActor))
    .slice(0, MAX_PER_GROUP.persona)
    .map((entry) => ({
      group: "persona" as const,
      id: `persona:${entry.name}`,
      label: entry.name,
      sublabel: personSublabel(entry),
      personName: entry.name,
    }));

  return [...titles, ...sagaHits.concat(universeHits).slice(0, MAX_PER_GROUP.saga), ...people];
}
