import type { Item } from "../types";
import type { TmdbSaga } from "./tmdb";
import { sagaKey, universeKey, type SagaKey } from "../store/useSagas";
import { UNIVERSES } from "./universes";

function fold(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Shared matcher so the command palette and the library filter stay in sync —
 * a query that finds a title in one place finds it in the other.
 */
export function matchesQuery(item: Item, query: string): boolean {
  const q = fold(query.trim());
  if (!q) return true;
  return (
    fold(item.title).includes(q) ||
    fold(item.director).includes(q) ||
    fold(item.genre).includes(q) ||
    fold(item.notes).includes(q) ||
    fold(item.platform).includes(q) ||
    fold(item.overview).includes(q) ||
    fold(item.collectionName ?? "").includes(q) ||
    String(item.year).includes(q) ||
    item.cast.some((c) => fold(c).includes(q))
  );
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
