import { useEffect, useState } from "react";
import { useLibrary } from "../store/useLibrary";
import { useSettings } from "../store/useSettings";
import { findByImdbId, getDetails, searchByType, searchTitles, TmdbApiError } from "./tmdb";
import { pickCandidate } from "./titleMatch";
import type { Item } from "../types";

const DELAY_MS = 300;

/**
 * Quanto aspettare prima di riprovare, quando la passata si ferma perché TMDB
 * sta limitando il traffico. Il client ritenta già da solo con attese
 * crescenti: se nonostante quello arriva ancora un rifiuto, il problema non si
 * risolve in centinaia di millisecondi e insistere subito significherebbe solo
 * bruciare l'intera libreria contro un muro.
 */
const COOLDOWN_MS = 60_000;

/**
 * Distingue "questo titolo non esiste su TMDB" da "ora non si può chiedere".
 * È la distinzione che decide se un titolo va segnato come già tentato: il
 * primo caso è una risposta definitiva, il secondo è un rinvio.
 */
function isTemporary(e: unknown): boolean {
  if (e instanceof TmdbApiError) return e.status === 429 || e.status === undefined || e.status >= 500;
  return false;
}

// Module scope on purpose: this is a background sync against a global store,
// not component state. Keeping the guard outside React means a remount (React
// runs effects twice in development) cannot start a second pass or discard the
// results of the first one.
let running = false;
const attempted = new Set<string>();

export function fillGaps(item: Item, d: Awaited<ReturnType<typeof getDetails>>, mediaType: "movie" | "tv"): Partial<Item> {
  return {
    tmdbId: d.tmdbId,
    tmdbMediaType: mediaType,
    posterPath: d.posterPath,
    backdropPath: d.backdropPath,
    trailerUrl: d.trailerUrl,
    // Only ever fill what is still empty: anything already curated wins.
    genre: item.genre || d.genre,
    runtime: item.runtime || d.runtime,
    overview: item.overview || d.overview,
    director: item.director || d.director,
    cast: item.cast.length ? item.cast : d.cast,
    similar: item.similar.length ? item.similar : d.similar,
    episodes: item.episodes ?? d.episodes,
    // Una serie segnata «Vista» quando il totale degli episodi non si sapeva
    // ancora — arrivata da un voto di IMDb, o scritta a mano senza catalogo —
    // diventa vista tutta nel momento in cui il totale arriva. Prima restava
    // «Vista» con zero episodi su sessanta: due affermazioni contrarie nella
    // stessa scheda, e zero minuti nelle statistiche.
    seen: item.status === "Visto" && item.episodes == null && d.episodes ? Math.max(item.seen || 0, d.episodes) : item.seen,
    seasons: item.seasons ?? d.seasons,
    // Always taken from TMDB: the saga is not something the user curates, and
    // `null` here is the real answer "standalone", not a gap.
    collectionId: d.collectionId,
    collectionName: d.collectionName,
    // Catalogue facts the filters read. Taken from TMDB unconditionally for
    // the same reason as the saga: they are not fields anyone curates by hand,
    // and this pass is what backfills a library that predates them. `quality`
    // is pointedly not here — that one describes the user's own copy.
    studio: d.studio,
    countries: d.countries,
    tmdbRating: d.tmdbRating,
    audioLangs: d.audioLangs,
    // Parental control reads this, so it must never be left at whatever an
    // older record happened to hold: an out-of-date rating on a filter that
    // exists to keep things away from a child is worse than none.
    certification: d.certification,
  };
}

/**
 * Quale scheda di TMDB è questo titolo.
 *
 * Prima era «il primo risultato della ricerca per nome», che è la risposta
 * giusta finché i film con quel nome sono uno solo. «Dune» del 1984 scritto a
 * mano diventava il Dune del 2021, con la sua copertina e il suo regista;
 * peggio, un titolo arrivato da un import col suo anno esatto poteva
 * collegarsi al remake. Adesso, nell'ordine:
 *
 * - un titolo già collegato non cerca niente: sa chi è, e ricercarlo per nome
 *   potrebbe riscrivere un collegamento che avevi confermato tu;
 * - un id IMDb (dagli export di IMDb) è una risposta esatta, via `/find`;
 * - altrimenti la ricerca, e fra i risultati quello del tipo giusto (film o
 *   serie) e dell'anno giusto, entro uno.
 *
 * L'anno vale come vincolo solo quando è un anno passato. L'anno corrente è il
 * valore predefinito del foglio di aggiunta, quindi su un titolo scritto a mano
 * non dice niente: lì, se nessun risultato ha quell'anno, resta il primo, come
 * prima. Un anno passato invece è stato scelto o importato, e un titolo senza
 * copertina — che il pulsante nella scheda può sempre collegare a mano — è
 * meglio della copertina di un altro film.
 */
export async function resolveTarget(item: Item, apiKey: string): Promise<{ tmdbId: number; mediaType: "movie" | "tv" } | null> {
  if (item.tmdbId && item.tmdbMediaType) return { tmdbId: item.tmdbId, mediaType: item.tmdbMediaType };
  if (item.imdbId) {
    const hit = await findByImdbId(item.imdbId, apiKey);
    if (hit) return hit;
  }
  const year = item.year > 1800 ? item.year : null;
  const strict = year !== null && year < new Date().getFullYear();
  const type: "movie" | "tv" | null =
    item.kind === "serie" || item.kind === "anime" ? "tv" : item.kind === "film" ? "movie" : null;
  const results = await searchTitles(item.title, apiKey);
  const sameType = type ? results.filter((r) => r.mediaType === type) : results;
  const picked = pickCandidate(sameType.length ? sameType : results, { title: item.title, year }, { strictYear: strict });
  if (picked || !year) return picked;
  // La ricerca generale dà otto risultati, ordinati per popolarità: un film
  // del 1960 con il nome di un successo di oggi può non esserci. Una seconda
  // domanda, solo in quell'anno, lo trova.
  const inYear = await searchByType(item.title, type ?? "movie", apiKey, year);
  return pickCandidate(inYear, { title: item.title, year }, { strictYear: true });
}

/**
 * Two kinds of title need this pass: one with no TMDB link at all, and one
 * linked before the filter metadata existed. The second is why `audioLangs`
 * is checked rather than trusting `tmdbId` alone — otherwise a library built
 * before the advanced filters shipped would be permanently invisible to them,
 * with no way to fix it short of re-adding every title by hand.
 *
 * `audioLangs` is the marker because it is the one field TMDB fills in for
 * essentially everything, so its absence means "never fetched" rather than
 * "fetched and genuinely empty" — which is exactly what `studio` would have
 * meant for an independent film with no company credited.
 */
function needsSync(item: Item): boolean {
  return !item.tmdbId || item.audioLangs === undefined;
}

/**
 * Fetches covers and metadata for any title that needs it, so a hand-typed or
 * imported library fills itself in without the user tapping anything. Works
 * through one title at a time to stay polite to the API, and remembers what it
 * already tried so an unmatchable title is not retried in a loop — the manual
 * button in the detail sheet stays as the fallback.
 */
export function useAutoLinkTmdb() {
  const items = useLibrary((s) => s.items);
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const pendingCount = items.filter((i) => needsSync(i) && !attempted.has(i.id)).length;
  // Il contatore serve solo a far ripartire la passata dopo una pausa: senza,
  // fermarsi per un limite di traffico vorrebbe dire fermarsi fino al prossimo
  // cambiamento della libreria, cioè quasi sempre fino al ricaricamento.
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!tmdbApiKey || pendingCount === 0 || running) return;
    running = true;
    let cooldown: number | null = null;

    void (async () => {
      try {
        for (;;) {
          // Re-read the store each round: the list can change while we work.
          const next = useLibrary.getState().items.find((i) => needsSync(i) && !attempted.has(i.id));
          if (!next) break;
          attempted.add(next.id);
          try {
            const target = await resolveTarget(next, tmdbApiKey);
            if (target) {
              const details = await getDetails(target.tmdbId, target.mediaType, tmdbApiKey);
              useLibrary.getState().updateItem(next.id, fillGaps(next, details, target.mediaType));
            }
          } catch (e) {
            if (isTemporary(e)) {
              // Il titolo non ha colpe: torna in coda invece di restare
              // segnato come già tentato, altrimenti un limite passeggero gli
              // costerebbe la copertina fino al ricaricamento. E la passata si
              // ferma qui — se TMDB sta rifiutando, i titoli dopo questo
              // troverebbero lo stesso muro, uno per uno.
              attempted.delete(next.id);
              cooldown = window.setTimeout(() => setRetry((n) => n + 1), COOLDOWN_MS);
              break;
            }
            // Un titolo che TMDB non conosce resta segnato: ritentarlo a ogni
            // giro sarebbe un ciclo senza uscita. Il pulsante manuale nella
            // scheda resta la via di scampo.
          }
          await new Promise((r) => setTimeout(r, DELAY_MS));
        }
      } finally {
        running = false;
      }
    })();

    return () => {
      if (cooldown) clearTimeout(cooldown);
    };
  }, [tmdbApiKey, pendingCount, retry]);
}

/** Lets a fresh key retry titles this session already gave up on. */
export function resetAutoLinkAttempts() {
  attempted.clear();
}
