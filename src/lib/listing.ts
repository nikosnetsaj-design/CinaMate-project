import type { Item, Kind } from "../types";
import { applyFilters, type Filters, type SourceLookup } from "./filters";
import { matchQuality } from "./search";
import { t } from "./i18n";

/**
 * Come si ordina e si interroga uno scaffale. Sta qui e non nella pagina
 * Libreria perché le liste intelligenti fanno la stessa cosa: una lista
 * intelligente *è* una ricerca della Libreria salvata con un nome.
 */
export type Sort = "recenti" | "voto" | "titolo" | "anno";

export const SORTS: { id: Sort; label: string }[] = [
  { id: "recenti", label: t("sort.recent") },
  { id: "voto", label: t("sort.vote") },
  { id: "titolo", label: t("sort.title") },
  { id: "anno", label: t("sort.year") },
];

export function isSort(value: unknown): value is Sort {
  return SORTS.some((s) => s.id === value);
}

export interface ShelfQuery {
  filters: Filters;
  /** Il testo della ricerca, se la lista nasce da una ricerca. */
  q?: string;
  sort: Sort;
}

/**
 * I titoli che rispondono a una ricerca, ordinati. Le corrispondenze esatte
 * passano sempre davanti a quelle approssimate, qualunque sia l'ordinamento:
 * una correzione di battitura che seppellisse il titolo scritto davvero sotto
 * tre somiglianze sarebbe peggio di nessuna correzione.
 */
export function runQuery(
  items: Item[],
  query: ShelfQuery,
  lookupSource?: SourceLookup,
): { list: Item[]; onlyFuzzy: boolean } {
  const q = query.q ?? "";
  const scored = applyFilters(items, query.filters, lookupSource)
    .map((item) => ({ item, quality: matchQuality(item, q) }))
    .filter((entry) => entry.quality !== "none");

  const sorted = scored.sort((a, b) => {
    const rank = (a.quality === "exact" ? 0 : 1) - (b.quality === "exact" ? 0 : 1);
    if (rank !== 0) return rank;
    return compareBy(query.sort, a.item, b.item);
  });

  return {
    list: sorted.map((entry) => entry.item),
    onlyFuzzy: sorted.length > 0 && sorted.every((entry) => entry.quality === "fuzzy"),
  };
}

export function compareBy(sort: Sort, a: Item, b: Item): number {
  if (sort === "voto") return (b.vote ?? 0) - (a.vote ?? 0);
  if (sort === "titolo") return a.title.localeCompare(b.title);
  if (sort === "anno") return b.year - a.year;
  return b.added.localeCompare(a.added);
}

const KIND_NAMES: Record<Kind, string> = { film: "Film", serie: "Serie TV", anime: "Anime", doc: "Documentari" };

/**
 * Una ricerca salvata detta a parole, una pastiglia per condizione: è ciò che
 * una lista intelligente mostra sotto il nome, perché «si aggiorna da sola»
 * senza dire *come* sarebbe una scatola nera.
 */
export function describeQuery(query: ShelfQuery): string[] {
  const f = query.filters;
  const out: string[] = [];
  if (query.q?.trim()) out.push(`«${query.q.trim()}»`);
  if (f.kind) out.push(KIND_NAMES[f.kind]);
  if (f.status) out.push(f.status);
  if (f.genre) out.push(f.genre);
  if (f.studio) out.push(f.studio);
  if (f.country) out.push(f.country);
  if (f.audioLang) out.push(`audio ${f.audioLang}`);
  if (f.quality) out.push(f.quality);
  if (f.hasSubtitles) out.push("con sottotitoli");
  if (f.yearFrom !== undefined && f.yearTo !== undefined) out.push(`${f.yearFrom}–${f.yearTo}`);
  else if (f.yearFrom !== undefined) out.push(`dal ${f.yearFrom}`);
  else if (f.yearTo !== undefined) out.push(`fino al ${f.yearTo}`);
  if (f.runtimeMin !== undefined) out.push(`oltre ${f.runtimeMin} min`);
  if (f.runtimeMax !== undefined) out.push(`sotto ${f.runtimeMax} min`);
  if (f.voteMin !== undefined) out.push(`tuo voto ≥ ${f.voteMin}`);
  if (f.tmdbRatingMin !== undefined) out.push(`TMDB ≥ ${f.tmdbRatingMin}`);
  return out;
}
