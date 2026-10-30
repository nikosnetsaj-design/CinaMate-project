import { findByImdbId, searchByType, TmdbAbortError, type TmdbCandidate } from "./tmdb";
import { pickCandidate } from "./titleMatch";
import type { ImportedTitle, ImportMatch } from "./importers";

/**
 * Da «The Godfather, 1972» alla scheda di TMDB che quel nome vuol dire.
 *
 * È il passaggio che rende utile un import: senza, un film arrivato da
 * Letterboxd col nome inglese non si riconoscerebbe nel «Il padrino» che hai
 * già, e la libreria si riempirebbe di doppioni in due lingue. L'ordine delle
 * domande va dalla più esatta alla più larga, e ci si ferma alla prima che
 * risponde:
 *
 * 1. un id TMDB nel file (lo scrivono CineMate e gli export per Letterboxd);
 * 2. un id IMDb (`/find`: una risposta, non una ricerca);
 * 3. il titolo cercato *in quell'anno*, fra i film e poi fra le serie;
 * 4. il titolo senza anno, accettato solo se l'anno torna entro uno.
 *
 * Il quarto passo è dove si sbaglierebbe volentieri — il remake ha quasi
 * sempre lo stesso nome — e per questo con l'anno noto la regola è stretta:
 * meglio un titolo che entra senza copertina, e che la passata in sottofondo
 * riprova più tardi, che la copertina di un altro film.
 */

function toMatch(c: TmdbCandidate): ImportMatch {
  return {
    tmdbId: c.tmdbId,
    mediaType: c.mediaType,
    title: c.title,
    year: c.year,
    posterPath: c.posterPath,
    kind: c.kind,
    overview: c.overview,
  };
}

export async function matchImported(t: ImportedTitle, apiKey: string, signal?: AbortSignal): Promise<ImportMatch | null> {
  if (t.tmdbId) {
    return {
      tmdbId: t.tmdbId,
      mediaType: t.mediaType ?? "movie",
      title: t.title,
      year: t.year,
      posterPath: null,
      kind: t.kind ?? (t.mediaType === "tv" ? "serie" : "film"),
    };
  }
  if (t.imdbId) {
    const hit = await findByImdbId(t.imdbId, apiKey, signal);
    if (hit) return toMatch(hit);
  }
  const wanted = { title: t.title, year: t.year };
  const order: ("movie" | "tv")[] = t.mediaType === "tv" ? ["tv", "movie"] : ["movie", "tv"];
  for (const type of order) {
    if (t.year) {
      const sameYear = pickCandidate(await searchByType(t.title, type, apiKey, t.year, signal), wanted, { strictYear: true });
      if (sameYear) return toMatch(sameYear);
    }
    const any = pickCandidate(await searchByType(t.title, type, apiKey, null, signal), wanted, { strictYear: !!t.year });
    if (any) return toMatch(any);
  }
  return null;
}

export interface MatchProgress {
  done: number;
  total: number;
  matched: number;
}

/**
 * Tutti i titoli, quattro alla volta. Il ritmo vero lo tiene il secchio di
 * `tmdb.ts` — dieci richieste al secondo — quindi la concorrenza serve solo a
 * non lasciarlo vuoto mentre una risposta viaggia.
 *
 * `known` sono i titoli già riconosciuti in un giro precedente: un import
 * interrotto (la rete che cade, il foglio chiuso) riparte da dove era, e non
 * dal primo titolo. Un errore che non sia un «non trovato» ferma tutto e
 * risale: TMDB che rifiuta la chiave o la rete assente non sono risposte su
 * un titolo, e trattarle come «non riconosciuto» riempirebbe la libreria di
 * titoli senza copertina per un guasto passeggero.
 */
export async function matchAll(
  titles: ImportedTitle[],
  apiKey: string,
  {
    signal,
    onProgress,
    known = new Map(),
    concurrency = 4,
  }: {
    signal?: AbortSignal;
    onProgress?: (progress: MatchProgress) => void;
    known?: Map<string, ImportMatch | null>;
    concurrency?: number;
  } = {},
): Promise<Map<string, ImportMatch | null>> {
  const results = new Map(known);
  const keys = new Set(titles.map((t) => t.key));
  const todo = titles.filter((t) => !results.has(t.key));
  let cursor = 0;
  let done = titles.length - todo.length;
  let matched = [...results.entries()].filter(([k, v]) => keys.has(k) && v).length;
  onProgress?.({ done, total: titles.length, matched });

  // Un segnale nostro, legato a quello di chi chiama: al primo errore ferma
  // anche gli altri tre lavoratori, che altrimenti continuerebbero a chiedere
  // per conto di un import già fallito.
  const inner = new AbortController();
  const forward = () => inner.abort();
  if (signal?.aborted) inner.abort();
  signal?.addEventListener("abort", forward, { once: true });

  const worker = async () => {
    while (cursor < todo.length) {
      if (inner.signal.aborted) throw new TmdbAbortError();
      const t = todo[cursor++];
      const m = await matchImported(t, apiKey, inner.signal);
      results.set(t.key, m);
      done++;
      if (m) matched++;
      onProgress?.({ done, total: titles.length, matched });
    }
  };

  try {
    await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, todo.length)) }, worker));
  } catch (e) {
    inner.abort();
    // I risultati parziali restano a chi ha chiamato, per ripartire da lì.
    for (const [k, v] of results) known.set(k, v);
    throw e;
  } finally {
    signal?.removeEventListener("abort", forward);
  }
  return results;
}
