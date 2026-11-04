import { findByExternalId, searchByKind, searchTitles, type TmdbSearchResult } from "./tmdb";
import { foldTitle, type ImportedEntry } from "./importers";

/**
 * Trovare sul catalogo i titoli di un'altra app.
 *
 * Tre gradi di certezza, e solo il primo entra senza chiedere:
 *
 * - **sicuro** — il file porta l'id TMDB (Trakt), o un id che TMDB traduce
 *   esattamente (IMDb, TheTVDB); oppure la ricerca trova un titolo solo con
 *   lo stesso nome, originale o italiano, e l'anno entro uno di scarto (le
 *   date d'uscita cambiano da un paese all'altro);
 * - **da verificare** — ci sono candidati, ma nessuno è quello per forza: due
 *   film con lo stesso nome, un titolo tradotto diverso. Li sceglie chi
 *   importa, con il più probabile già indicato;
 * - **non trovato** — il catalogo non risponde niente.
 */

export type MatchState = "sure" | "doubt" | "missing";

export interface Match {
  entry: ImportedEntry;
  state: MatchState;
  /** Il titolo scelto: quello certo, o il più probabile fra i candidati. */
  pick: TmdbSearchResult | null;
  candidates: TmdbSearchResult[];
  /** La ricerca non è arrivata in fondo (rete, chiave): «non trovato» per ora. */
  failed?: boolean;
}

function sameName(r: TmdbSearchResult, e: ImportedEntry): boolean {
  const want = foldTitle(e.title);
  return foldTitle(r.title) === want || (!!r.originalTitle && foldTitle(r.originalTitle) === want);
}

function yearGap(r: TmdbSearchResult, e: ImportedEntry): number {
  if (e.year === null) return 0;
  if (r.year === null) return 99;
  return Math.abs(r.year - e.year);
}

/** Il giudizio su una lista di risultati, senza rete: è la parte da provare. */
export function judge(entry: ImportedEntry, results: TmdbSearchResult[]): Match {
  const named = results.filter((r) => sameName(r, entry));
  const close = named.filter((r) => yearGap(r, entry) <= 1);
  if (close.length === 1) return { entry, state: "sure", pick: close[0], candidates: close };
  if (close.length > 1) {
    const exact = close.filter((r) => yearGap(r, entry) === 0);
    if (exact.length === 1) return { entry, state: "sure", pick: exact[0], candidates: close };
  }
  if (results.length === 0) return { entry, state: "missing", pick: null, candidates: [] };

  // Nessuno è certo: in testa i più somiglianti, e l'anno pesa più del nome —
  // un «Parasite» del 2019 tradotto diversamente è più probabile di un
  // «Parasite» del 1982. Per il resto l'ordine di TMDB, il più cercato prima.
  const score = (r: TmdbSearchResult) => (yearGap(r, entry) <= 1 ? 0 : 2) + (sameName(r, entry) ? 0 : 1);
  const candidates = results
    .map((r, i) => ({ r, i }))
    .sort((a, b) => score(a.r) - score(b.r) || a.i - b.i)
    .map(({ r }) => r)
    .slice(0, 4);
  return { entry, state: "doubt", pick: candidates[0], candidates };
}

function known(entry: ImportedEntry): TmdbSearchResult | null {
  if (!entry.ids.tmdb || !entry.mediaType) return null;
  return {
    tmdbId: entry.ids.tmdb,
    mediaType: entry.mediaType,
    title: entry.title,
    year: entry.year,
    overview: "",
    posterPath: null,
    kind: entry.mediaType === "tv" ? "serie" : "film",
    popularity: 0,
  };
}

function uniqueById(list: TmdbSearchResult[]): TmdbSearchResult[] {
  const seen = new Set<string>();
  return list.filter((r) => {
    const key = `${r.mediaType}:${r.tmdbId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function matchEntry(entry: ImportedEntry, apiKey: string): Promise<Match> {
  const direct = known(entry);
  if (direct) return { entry, state: "sure", pick: direct, candidates: [direct] };

  for (const [id, source] of [
    [entry.ids.imdb, "imdb_id"],
    [entry.ids.tvdb, "tvdb_id"],
  ] as const) {
    if (!id) continue;
    const found = await findByExternalId(id, source, apiKey);
    // L'id dice quale titolo, il file dice se è un film o una serie: se non
    // coincidono l'id è di qualcos'altro (un episodio), e si passa al nome.
    if (found && (!entry.mediaType || found.mediaType === entry.mediaType)) {
      return { entry, state: "sure", pick: found, candidates: [found] };
    }
  }

  if (!entry.mediaType) return judge(entry, await searchTitles(entry.title, apiKey));

  const withYear = await searchByKind(entry.title, entry.mediaType, entry.year, apiKey);
  const first = judge(entry, withYear);
  if (first.state === "sure" || entry.year === null) return first;
  // L'anno del file e quello di TMDB possono non coincidere (un festival, una
  // prima uscita in un altro paese): una seconda ricerca senza anno, e il
  // giudizio rifatto su tutto.
  const without = await searchByKind(entry.title, entry.mediaType, null, apiKey);
  return judge(entry, uniqueById([...withYear, ...without]));
}

/**
 * Tutti i titoli, quattro alla volta: il client TMDB ha già il suo limitatore
 * di traffico, qui serve solo a non aspettare una risposta per volta. Un errore
 * su un titolo non ferma gli altri: quel titolo finisce fra i non trovati,
 * segnato, e si può ritentare.
 */
export async function matchAll(
  entries: ImportedEntry[],
  apiKey: string,
  onProgress: (done: number) => void,
  signal?: AbortSignal,
): Promise<Match[]> {
  const out: Match[] = new Array(entries.length);
  let next = 0;
  let done = 0;
  async function worker() {
    while (next < entries.length) {
      if (signal?.aborted) return;
      const i = next++;
      try {
        out[i] = await matchEntry(entries[i], apiKey);
      } catch {
        out[i] = { entry: entries[i], state: "missing", pick: null, candidates: [], failed: true };
      }
      onProgress(++done);
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, entries.length) }, worker));
  return out.filter(Boolean);
}
