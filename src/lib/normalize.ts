import { PLATFORMS, QUALITIES, type HistoryEntry, type Item, type Kind, type Status } from "../types";
import { STATUSES } from "./status";
import { localDay, repairUtcDay } from "./day";

/**
 * Un record della libreria, reso sicuro da mostrare.
 *
 * Prima un titolo valeva se aveva `id` e `title` di tipo stringa, e tutto il
 * resto si dava per buono. Un backup scritto a mano, uno di una versione molto
 * vecchia o un file prodotto da un altro programma potevano quindi entrare con
 * `cast` assente — e la scheda del titolo, che fa `item.cast.length`, si
 * rompeva all'apertura con la pagina bianca. Qui ogni campo che l'interfaccia
 * legge senza controllare viene riportato al suo tipo, con il valore che
 * l'app userebbe per un titolo appena creato.
 *
 * Quello che il record porta in più resta com'è: un campo che questa versione
 * non conosce non è un errore, è un dato di una versione più nuova, e
 * buttarlo via vorrebbe dire perderlo al prossimo salvataggio.
 */

const KINDS: readonly Kind[] = ["film", "serie", "anime", "doc"];

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function positiveOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeItem(value: unknown): Item | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const title = str(v.title).trim();
  if (!title) return null;

  const id = str(v.id) || newId();
  const episodes = positiveOrNull(v.episodes);
  const seen = Math.max(0, Math.round(num(v.seen)));
  const vote = typeof v.vote === "number" && Number.isFinite(v.vote) ? Math.min(10, Math.max(1, Math.round(v.vote))) : null;
  const added = typeof v.added === "string" && DAY.test(v.added) ? repairUtcDay(v.added, id) : localDay();

  const item: Item = {
    ...(v as Partial<Item>),
    id,
    title,
    kind: KINDS.includes(v.kind as Kind) ? (v.kind as Kind) : "film",
    year: Math.max(0, Math.round(num(v.year))),
    genre: str(v.genre),
    status: STATUSES.includes(v.status as Status) ? (v.status as Status) : "Da vedere",
    vote,
    platform: (PLATFORMS as readonly string[]).includes(v.platform as string) ? (v.platform as Item["platform"]) : "Altro",
    runtime: Math.max(0, Math.round(num(v.runtime))),
    episodes,
    // Un contatore oltre il totale farebbe una barra al 140%.
    seen: episodes ? Math.min(seen, episodes) : seen,
    seasons: positiveOrNull(v.seasons),
    fav: v.fav === true,
    rewatch: Math.max(0, Math.round(num(v.rewatch))),
    overview: str(v.overview),
    director: str(v.director),
    cast: strings(v.cast),
    similar: strings(v.similar),
    notes: str(v.notes),
    added,
    tmdbId: positiveOrNull(v.tmdbId),
    tmdbMediaType: v.tmdbMediaType === "movie" || v.tmdbMediaType === "tv" ? v.tmdbMediaType : null,
    posterPath: stringOrNull(v.posterPath),
    trailerUrl: stringOrNull(v.trailerUrl),
    links: strings(v.links),
  };

  /*
   * I campi facoltativi: assenti hanno un significato preciso — «non ancora
   * chiesto a TMDB» — e la passata di collegamento li riempie proprio perché
   * mancano. Uno presente ma del tipo sbagliato vale quanto uno assente, e
   * va tolto: lasciato lì, `countries: "US"` arriverebbe ai filtri come una
   * stringa dove si aspettano un elenco.
   */
  const optional: Record<string, (x: unknown) => boolean> = {
    backdropPath: (x) => x === null || typeof x === "string",
    collectionId: (x) => x === null || (typeof x === "number" && Number.isFinite(x)),
    collectionName: (x) => x === null || typeof x === "string",
    studio: (x) => typeof x === "string",
    countries: (x) => Array.isArray(x) && x.every((c) => typeof c === "string"),
    tmdbRating: (x) => x === null || (typeof x === "number" && Number.isFinite(x)),
    audioLangs: (x) => Array.isArray(x) && x.every((c) => typeof c === "string"),
    certification: (x) => typeof x === "string",
    contentWarnings: (x) => typeof x === "string",
    quality: (x) => x === null || (typeof x === "string" && (QUALITIES as readonly string[]).includes(x)),
    imdbId: (x) => x === null || (typeof x === "string" && /^tt\d+$/.test(x)),
  };
  const record = item as unknown as Record<string, unknown>;
  for (const [key, valid] of Object.entries(optional)) {
    if (key in record && record[key] !== undefined && !valid(record[key])) delete record[key];
  }
  return item;
}

const ACTIONS: readonly HistoryEntry["action"][] = ["watched", "episode", "rewatch"];

/**
 * Una voce del diario. Senza `itemId` o senza una data leggibile non è una
 * voce — non si sa di cosa né quando — e viene scartata; tutto il resto ha un
 * valore ragionevole. La data passa da `repairUtcDay`: vedi `lib/day`.
 */
export function normalizeHistoryEntry(value: unknown): HistoryEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const itemId = str(v.itemId);
  const rawDate = str(v.date).slice(0, 10);
  if (!itemId || !DAY.test(rawDate)) return null;
  const id = str(v.id) || newId();
  const count = typeof v.count === "number" && Number.isFinite(v.count) && v.count >= 1 ? Math.round(v.count) : undefined;
  const entry: HistoryEntry = {
    ...(v as Partial<HistoryEntry>),
    id,
    itemId,
    title: str(v.title),
    kind: KINDS.includes(v.kind as Kind) ? (v.kind as Kind) : "film",
    date: repairUtcDay(rawDate, id),
    action: ACTIONS.includes(v.action as HistoryEntry["action"]) ? (v.action as HistoryEntry["action"]) : "watched",
  };
  // Un conteggio illeggibile si legge come `1`, che è il significato di «assente».
  if (count === undefined) delete entry.count;
  else entry.count = count;
  return entry;
}

/** Il risultato di una lettura che non butta via tutto per un record storto. */
export interface Salvaged<T> {
  records: T[];
  /** Quanti elementi non erano record leggibili. */
  skipped: number;
}

export function salvage<T>(values: unknown[], normalize: (value: unknown) => T | null): Salvaged<T> {
  const records: T[] = [];
  let skipped = 0;
  for (const value of values) {
    const record = normalize(value);
    if (record) records.push(record);
    else skipped++;
  }
  return { records, skipped };
}
