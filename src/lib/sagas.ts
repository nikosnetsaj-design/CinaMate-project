import type { Item } from "../types";
import type { TmdbSagaPart } from "./tmdb";

/**
 * A saga can be walked in three different ways and they genuinely disagree:
 * Tokyo Drift is the third Fast & Furious released and the sixth in the story.
 * Only the release order is a fact TMDB knows; the other two are editorial and
 * come from Claude, which is why they are cached per saga rather than derived.
 */
export type WatchOrder = "uscita" | "cronologico" | "consigliato";

export const WATCH_ORDERS: { id: WatchOrder; label: string; hint: string }[] = [
  { id: "uscita", label: "Uscita", hint: "Nell'ordine in cui sono arrivati in sala" },
  { id: "cronologico", label: "Cronologico", hint: "Nell'ordine in cui accade la storia" },
  { id: "consigliato", label: "Consigliato", hint: "L'ordine che rende meglio alla prima visione" },
];

export interface SagaOrders {
  /** TMDB ids, story order. */
  chronological: number[];
  /** TMDB ids, best first-viewing order. */
  recommended: number[];
  /** One line explaining what makes the two differ, shown under the tabs. */
  note: string;
  computedAt: number;
}

export type PartState = "visto" | "in-visione" | "in-libreria" | "assente";

export interface SagaEntry {
  part: TmdbSagaPart;
  /** Position in the currently selected order, 1-based — the number on screen. */
  number: number;
  item: Item | null;
  state: PartState;
  /** Episode progress for the rare TV entry; `null` for films. */
  pct: number | null;
}

export interface SagaProgress {
  total: number;
  watched: number;
  watching: number;
  owned: number;
  /** Completion over the whole saga, not just over what you own. */
  pct: number;
  /** First entry that is not finished — where "continue" and marathons resume. */
  next: SagaEntry | null;
}

function normalise(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Titles linked to TMDB match by id; hand-typed ones still have to be findable,
 * so the name is the fallback. Both are needed: a library is usually a mix.
 */
export function findLibraryMatch(part: TmdbSagaPart, items: Item[]): Item | null {
  const byId = items.find((i) => i.tmdbId === part.tmdbId && i.tmdbMediaType === "movie");
  if (byId) return byId;
  const target = normalise(part.title);
  return items.find((i) => !i.tmdbId && normalise(i.title) === target) ?? null;
}

function stateOf(item: Item | null): PartState {
  if (!item) return "assente";
  if (item.status === "Visto") return "visto";
  if (item.status === "In visione") return "in-visione";
  return "in-libreria";
}

export function orderParts(parts: TmdbSagaPart[], order: WatchOrder, orders: SagaOrders | undefined): TmdbSagaPart[] {
  const ids = order === "cronologico" ? orders?.chronological : order === "consigliato" ? orders?.recommended : null;
  if (!ids || ids.length === 0) return parts;

  const rank = new Map(ids.map((id, idx) => [id, idx]));
  // Anything Claude did not place keeps its release position, appended after
  // the titles it did — a partial answer still beats falling back entirely.
  return parts
    .slice()
    .sort((a, b) => (rank.get(a.tmdbId) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.tmdbId) ?? Number.MAX_SAFE_INTEGER));
}

export function buildEntries(parts: TmdbSagaPart[], items: Item[]): SagaEntry[] {
  return parts.map((part, idx) => {
    const item = findLibraryMatch(part, items);
    const pct = item && item.episodes ? Math.round(((item.seen || 0) / item.episodes) * 100) : null;
    return { part, number: idx + 1, item, state: stateOf(item), pct };
  });
}

export function sagaProgress(entries: SagaEntry[]): SagaProgress {
  const watched = entries.filter((e) => e.state === "visto").length;
  const watching = entries.filter((e) => e.state === "in-visione").length;
  const owned = entries.filter((e) => e.item !== null).length;
  return {
    total: entries.length,
    watched,
    watching,
    owned,
    pct: entries.length ? Math.round((watched / entries.length) * 100) : 0,
    next: entries.find((e) => e.state !== "visto") ?? null,
  };
}

/**
 * The chapter to offer once the current one is finished: the entry right after
 * it, skipping anything already seen so a rewatch does not re-suggest the past.
 */
export function nextChapterAfter(entries: SagaEntry[], finishedTmdbId: number | null, finishedTitle: string): SagaEntry | null {
  const idx = entries.findIndex(
    (e) => (finishedTmdbId != null && e.part.tmdbId === finishedTmdbId) || normalise(e.part.title) === normalise(finishedTitle),
  );
  if (idx === -1) return null;
  return entries.slice(idx + 1).find((e) => e.state !== "visto") ?? null;
}

export const PART_STATE_META: Record<PartState, { icon: string; label: string; color: string }> = {
  visto: { icon: "✓", label: "Visto", color: "var(--status-done)" },
  "in-visione": { icon: "▶", label: "In visione", color: "var(--status-watching)" },
  "in-libreria": { icon: "◷", label: "In libreria", color: "var(--status-planned)" },
  assente: { icon: "+", label: "Non in libreria", color: "var(--text-faint)" },
};
