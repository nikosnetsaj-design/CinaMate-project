import type { Kind } from "../types";
import { logError } from "./errorLog";

const BASE = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p";

export class MissingTmdbKeyError extends Error {
  constructor() {
    super("Nessuna chiave API TMDB configurata.");
    this.name = "MissingTmdbKeyError";
  }
}

export class TmdbApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "TmdbApiError";
    this.status = status;
  }
}

export interface TmdbSearchResult {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  year: number | null;
  overview: string;
  posterPath: string | null;
  kind: Kind;
  /** Quanto TMDB lo vede cercato in questo momento. Serve a ordinare, non a giudicare. */
  popularity: number;
}

export interface TmdbWatchProvider {
  /** L'id TMDB del servizio: chiave stabile, il nome cambia coi piani ("… with Ads"). */
  id: number;
  name: string;
  logoPath: string | null;
}

export interface TmdbDetails {
  tmdbId: number;
  title: string;
  year: number | null;
  genre: string;
  runtime: number;
  episodes: number | null;
  seasons: number | null;
  overview: string;
  director: string;
  cast: string[];
  similar: string[];
  posterPath: string | null;
  /** L'immagine orizzontale del titolo, quella che sta bene dietro a un testo. */
  backdropPath: string | null;
  trailerUrl: string | null;
  watchProviders: TmdbWatchProvider[];
  /** Saga the title belongs to, `null` when it is standalone. */
  collectionId: number | null;
  collectionName: string | null;
  releaseDate: string | null;
  /** Lead production company. */
  studio: string;
  /** ISO 3166-1 country codes. */
  countries: string[];
  /** TMDB's own 0–10 average. */
  tmdbRating: number | null;
  /** ISO 639-1 codes of the languages spoken in it. */
  audioLangs: string[];
  /** Age rating as the board wrote it — "VM14", "R", "T"… Empty when unrated. */
  certification: string;
}

/** Thrown when a request was deliberately cancelled — never worth reporting. */
export class TmdbAbortError extends Error {
  constructor() {
    super("Richiesta annullata");
    this.name = "TmdbAbortError";
  }
}

/** Quanti tentativi in più dopo il primo, prima di arrendersi. */
const MAX_RETRIES = 3;
/** L'attesa iniziale, che raddoppia a ogni tentativo: 500, 1000, 2000 ms. */
const BASE_RETRY_MS = 500;
/**
 * Il tetto all'attesa. TMDB può chiedere di rientrare fra un minuto: rispettarlo
 * alla lettera vorrebbe dire lasciare una schermata a girare per un minuto, che
 * è peggio del fallimento. Oltre il tetto si preferisce fallire e lasciare che
 * sia un gesto dell'utente a riprovare.
 */
const MAX_RETRY_MS = 8_000;

/**
 * Gli stati che vale la pena ritentare: il traffico (429) e i guasti
 * temporanei del server. Un 401 è una chiave sbagliata e un 404 è una risposta
 * ordinaria — ritentarli sarebbe solo un modo più lento di dare la stessa
 * notizia.
 */
function isTransient(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

function retryDelay(attempt: number, retryAfter: string | null): number {
  // Quando TMDB limita, dice anche per quanto. Se lo dice, quel numero vince su
  // qualsiasi stima nostra: è l'unico che conosce il proprio contatore.
  const stated = Number(retryAfter);
  if (retryAfter && Number.isFinite(stated) && stated >= 0) return Math.min(stated * 1000, MAX_RETRY_MS);
  const backoff = Math.min(BASE_RETRY_MS * 2 ** attempt, MAX_RETRY_MS);
  // Il jitter non è un vezzo: le richieste che vengono fermate insieme sono
  // quelle partite insieme (la rassegna «In arrivo» ne manda una per titolo).
  // Senza una componente casuale ripartirebbero anch'esse insieme, ricreando
  // esattamente la raffica che ha causato il limite.
  return backoff / 2 + Math.random() * (backoff / 2);
}

/** Un'attesa che si interrompe se la richiesta viene annullata nel frattempo. */
function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new TmdbAbortError());
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(new TmdbAbortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function tmdbGet<T>(
  path: string,
  apiKey: string,
  params: Record<string, string> = {},
  signal?: AbortSignal,
): Promise<T> {
  if (!apiKey) throw new MissingTmdbKeyError();
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("language", "it-IT");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  /**
   * Il ciclo esiste per una ragione sola: un 429 non è un difetto del titolo,
   * è il server che chiede di rallentare. Prima veniva trattato come qualsiasi
   * altro rifiuto, e siccome ogni chiamante qui sopra ingoia l'errore per non
   * fermare la propria passata, il limite si traduceva in un buco silenzioso —
   * un titolo che resta senza copertina fino al ricaricamento, una riga «In
   * arrivo» più corta del vero. Ritentare con un'attesa crescente è ciò che
   * trasforma un limite temporaneo in un ritardo invece che in un dato perso.
   */
  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await fetch(url.toString(), { signal });
    } catch (e) {
      // A cancelled request is not a failure: search-as-you-type abandons one on
      // every keystroke, and logging those would fill the error page with noise
      // and show the user a network error for a request nobody was waiting for.
      if (signal?.aborted || (e instanceof DOMException && e.name === "AbortError")) throw new TmdbAbortError();
      // Un errore di rete non si ritenta: quasi sempre è "sei offline", e tre
      // tentativi silenziosi ritarderebbero di secondi una notizia che è già
      // certa. Il traffico è un'altra cosa, e si ritenta più sotto.
      //
      // Logged as well as thrown: much of this runs in the background linker,
      // where the throw is swallowed on purpose so one unmatchable title doesn't
      // stop the pass — and the failure would otherwise leave no trace anywhere.
      logError("tmdb", "Connessione a TMDB non riuscita", path);
      throw new TmdbApiError("Connessione a TMDB non riuscita. Controlla la rete e riprova.");
    }

    if (response.ok) return (await response.json()) as T;

    if (isTransient(response.status) && attempt < MAX_RETRIES) {
      // `wait` propaga l'annullamento: una ricerca abbandonata a metà attesa
      // non deve restare appesa per il backoff di una richiesta che non
      // interessa più a nessuno.
      await wait(retryDelay(attempt, response.headers.get("retry-after")), signal);
      continue;
    }

    // A 404 is an ordinary answer here ("this title isn't on TMDB") rather
    // than a fault, so it stays out of the log — filling the page with those
    // would bury the failures worth reading.
    if (response.status !== 404) logError("tmdb", `HTTP ${response.status}`, path);
    if (response.status === 401) throw new TmdbApiError("Chiave API TMDB non valida.", 401);
    if (response.status === 404) throw new TmdbApiError("Titolo non trovato su TMDB.", 404);
    // Il 429 sopravvissuto ai tentativi merita di dirlo con parole sue: chi
    // legge deve capire che non c'è niente di rotto e che basta aspettare.
    if (response.status === 429)
      throw new TmdbApiError("TMDB sta limitando le richieste. Riprova fra qualche istante.", 429);
    throw new TmdbApiError(`Richiesta TMDB rifiutata (HTTP ${response.status}).`, response.status);
  }
}

export type PosterSize = "w92" | "w154" | "w185" | "w342" | "w500" | "w780";

export function posterUrl(path: string | null | undefined, size: PosterSize = "w342"): string | null {
  return path ? `${IMG_BASE}/${size}${path}` : null;
}

/**
 * The widths TMDB actually serves, as a `srcset`.
 *
 * TMDB re-encodes each width separately, so this is real compression rather
 * than the browser scaling one large file down: a poster shown 96px wide on a
 * 1× screen fetches ~6 KB instead of the ~40 KB of the w342 everything used to
 * get. Descriptors are widths (`w`), not `1x/2x`, so the browser can weigh
 * pixel density *and* layout size together — the same card is 96px on a phone
 * grid and 190px on a desktop one, and a density-only set can't express that.
 */
const POSTER_WIDTHS: Record<PosterSize, number> = {
  w92: 92,
  w154: 154,
  w185: 185,
  w342: 342,
  w500: 500,
  w780: 780,
};

export function posterSrcSet(path: string | null | undefined, sizes: PosterSize[]): string | undefined {
  if (!path) return undefined;
  return sizes.map((size) => `${IMG_BASE}/${size}${path} ${POSTER_WIDTHS[size]}w`).join(", ");
}

/**
 * L'immagine orizzontale del titolo, in due larghezze.
 *
 * Serve dietro all'intestazione della scheda, dove una locandina verticale non
 * ci sta: ritagliata per riempire una fascia bassa e larga mostrerebbe un
 * primo piano di mento. Le larghezze sono due sole perché la fascia è alta
 * poche centinaia di pixel e sopra `w780` non si vedrebbe la differenza, mentre
 * su una connessione lenta si sentirebbe.
 */
const BACKDROP_WIDTHS = { w780: 780, w1280: 1280 } as const;
export type BackdropSize = keyof typeof BACKDROP_WIDTHS;

export function backdropUrl(path: string | null | undefined, size: BackdropSize = "w780"): string | null {
  return path ? `${IMG_BASE}/${size}${path}` : null;
}

export function backdropSrcSet(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  return (Object.keys(BACKDROP_WIDTHS) as BackdropSize[])
    .map((size) => `${IMG_BASE}/${size}${path} ${BACKDROP_WIDTHS[size]}w`)
    .join(", ");
}

function guessKind(mediaType: "movie" | "tv", genreNames: string[], originCountry: string[] = []): Kind {
  if (mediaType === "movie") return genreNames.includes("Documentario") || genreNames.includes("Documentary") ? "doc" : "film";
  const isAnimation = genreNames.includes("Animazione") || genreNames.includes("Animation");
  if (isAnimation && originCountry.includes("JP")) return "anime";
  if (genreNames.includes("Documentario") || genreNames.includes("Documentary")) return "doc";
  return "serie";
}

interface RawMultiSearchResult {
  id: number;
  media_type: "movie" | "tv" | "person";
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  overview?: string;
  poster_path?: string | null;
  genre_ids?: number[];
  origin_country?: string[];
  popularity?: number;
}

// Minimal genre-id -> Italian name map for the multi-search result list (full
// details fetch below returns proper localized genre names; this is only
// used to guess film/serie/anime/doc for the search preview cards).
const GENRE_NAMES: Record<number, string> = {
  16: "Animazione",
  99: "Documentario",
};

function foldTitle(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

/**
 * Quanto un titolo risponde davvero a quello che è stato scritto: 0 è "è
 * esattamente quello", 4 è "contiene quelle lettere da qualche parte".
 *
 * `/search/multi` fa corrispondenza per sottostringa, quindi cercando «Ns»
 * torna *Ded@ns*, *Käpt'ns Dinner* e una serie olandese del 1981 — tutti
 * legittimi per TMDB e nessuno di questi è la risposta. Ordinare prima per
 * corrispondenza e poi per popolarità rimette in cima ciò che si stava
 * cercando senza buttare via niente.
 */
function titleRank(title: string, query: string): number {
  const t = foldTitle(title);
  const q = foldTitle(query);
  if (!q) return 4;
  if (t === q) return 0;
  if (t.startsWith(q)) return 1;
  // Una parola che comincia così: «guerre» trova «Guerre stellari», e non solo
  // i titoli che cominciano con quella parola.
  if (t.split(/[\s:—–-]+/).some((word) => word.startsWith(q))) return 2;
  if (t.includes(q)) return 3;
  return 4;
}

export async function searchTitles(
  query: string,
  apiKey: string,
  signal?: AbortSignal,
  /**
   * Quanti risultati tenere. Otto bastano a un elenco a discesa e non bastano a
   * una griglia a tutta pagina, che è il motivo per cui questo parametro esiste
   * invece di un numero fisso.
   */
  limit = 8,
): Promise<TmdbSearchResult[]> {
  const data = await tmdbGet<{ results: RawMultiSearchResult[] }>(
    "/search/multi",
    apiKey,
    { query, include_adult: "false" },
    signal,
  );
  const mapped = data.results
    .filter((r): r is RawMultiSearchResult & { media_type: "movie" | "tv" } => r.media_type === "movie" || r.media_type === "tv")
    .map((r) => {
      const genreNames = (r.genre_ids ?? []).map((id) => GENRE_NAMES[id]).filter((n): n is string => !!n);
      const dateStr = r.release_date || r.first_air_date;
      return {
        tmdbId: r.id,
        mediaType: r.media_type,
        title: r.title || r.name || "",
        year: dateStr ? Number(dateStr.slice(0, 4)) : null,
        overview: r.overview || "",
        posterPath: r.poster_path ?? null,
        kind: guessKind(r.media_type, genreNames, r.origin_country),
        popularity: r.popularity ?? 0,
      };
    })
    .filter((r) => r.title);

  /*
   * Un titolo senza locandina è quasi sempre una scheda abbozzata che nessuno
   * ha mai completato, e in una griglia occupa il posto di qualcosa di vero.
   * Sparisce solo se resta abbastanza da mostrare: per un film oscuro davvero
   * cercato, la scheda spoglia è comunque la risposta giusta.
   */
  const withPoster = mapped.filter((r) => r.posterPath);
  const pool = withPoster.length >= Math.min(6, limit) ? withPoster : mapped;

  return pool
    .map((r) => ({ r, rank: titleRank(r.title, query) }))
    .sort((a, b) => a.rank - b.rank || b.r.popularity - a.r.popularity)
    .slice(0, limit)
    .map((entry) => entry.r);
}

interface RawVideo {
  type: string;
  site: string;
  key: string;
  official?: boolean;
}
interface RawCrew {
  job: string;
  name: string;
}
interface RawCast {
  name: string;
}
interface RawProviderEntry {
  provider_id: number;
  provider_name: string;
  logo_path?: string | null;
  display_priority?: number;
}
interface RawProvidersResponse {
  results?: Record<
    string,
    {
      link?: string;
      flatrate?: RawProviderEntry[];
      free?: RawProviderEntry[];
      ads?: RawProviderEntry[];
      rent?: RawProviderEntry[];
      buy?: RawProviderEntry[];
    }
  >;
}
interface RawDetails {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  belongs_to_collection?: { id: number; name: string; poster_path?: string | null } | null;
  genres?: { name: string }[];
  runtime?: number;
  episode_run_time?: number[];
  number_of_episodes?: number;
  number_of_seasons?: number;
  origin_country?: string[];
  created_by?: { id?: number; name: string; profile_path?: string | null }[];
  credits?: { cast?: RawCast[]; crew?: RawCrew[] };
  videos?: { results?: RawVideo[] };
  recommendations?: { results?: { title?: string; name?: string }[] };
  production_companies?: { id?: number; name: string; logo_path?: string | null; origin_country?: string }[];
  production_countries?: { iso_3166_1: string }[];
  spoken_languages?: { iso_639_1: string }[];
  vote_average?: number;
  // Films and series carry their age rating under different keys, and the
  // film one nests a second level deep because a country can have several
  // dated releases (theatrical, then physical) each with its own rating.
  release_dates?: { results?: { iso_3166_1: string; release_dates?: { certification?: string }[] }[] };
  content_ratings?: { results?: { iso_3166_1: string; rating?: string }[] };
}

/**
 * The age rating, preferring the Italian board and falling back to the US one.
 *
 * Both are kept rather than normalising to a number here: "VM14" and "R" are
 * not the same judgement by the same body, and flattening them at fetch time
 * would throw away which system said it. lib/parental does the mapping, where
 * the ambiguity can be stated.
 */
function readCertification(details: RawDetails, mediaType: "movie" | "tv"): string {
  if (mediaType === "movie") {
    const results = details.release_dates?.results ?? [];
    for (const country of ["IT", "US"]) {
      const entry = results.find((r) => r.iso_3166_1 === country);
      const cert = entry?.release_dates?.map((d) => d.certification).find((c) => c && c.trim());
      if (cert) return cert.trim();
    }
    return "";
  }
  const ratings = details.content_ratings?.results ?? [];
  for (const country of ["IT", "US"]) {
    const rating = ratings.find((r) => r.iso_3166_1 === country)?.rating;
    if (rating && rating.trim()) return rating.trim();
  }
  return "";
}

/**
 * Dove si guarda un titolo in Italia, diviso per come ci si arriva.
 *
 * Le tre file sono separate perché rispondono a domande diverse: «ce l'ho già
 * nell'abbonamento» non è «costa 4,99 a noleggio», e appiattirle in un unico
 * elenco — com'era prima — faceva sembrare compreso qualcosa che va pagato a
 * parte. `free` sta a sé e non dentro `streaming` per lo stesso motivo:
 * RaiPlay senza abbonamento è un'informazione, non un dettaglio.
 */
export interface TmdbWatchInfo {
  /** In abbonamento (`flatrate`). */
  streaming: TmdbWatchProvider[];
  /** Gratis, con o senza pubblicità. */
  free: TmdbWatchProvider[];
  rent: TmdbWatchProvider[];
  buy: TmdbWatchProvider[];
  /** La pagina JustWatch del titolo, quando c'è. */
  link: string | null;
}

/** L'icona quadrata del servizio, quella che si riconosce senza leggere. */
export function providerLogoUrl(path: string | null | undefined, size: "w45" | "w92" | "w154" = "w92"): string | null {
  return path ? `${IMG_BASE}/${size}${path}` : null;
}

function toProviders(raw: RawProviderEntry[] | undefined): TmdbWatchProvider[] {
  return (raw ?? [])
    // `display_priority` è l'ordine in cui JustWatch mette i servizi per il
    // paese: rispettarlo vuol dire mostrare per primo quello che quasi tutti
    // hanno, invece dell'ordine casuale in cui arriva il JSON.
    .slice()
    .sort((a, b) => (a.display_priority ?? 99) - (b.display_priority ?? 99))
    .map((p) => ({ id: p.provider_id, name: p.provider_name, logoPath: p.logo_path ?? null }));
}

/**
 * La disponibilità cambia al massimo una volta al giorno, mentre la scheda si
 * riapre di continuo: senza cache ogni apertura era una chiamata in rete per
 * riavere la stessa risposta.
 */
const watchCache = new Map<string, { at: number; info: TmdbWatchInfo }>();
const WATCH_TTL_MS = 6 * 60 * 60 * 1000;

export async function getWatchProviders(tmdbId: number, mediaType: "movie" | "tv", apiKey: string): Promise<TmdbWatchInfo> {
  const key = `${mediaType}:${tmdbId}`;
  const hit = watchCache.get(key);
  if (hit && Date.now() - hit.at < WATCH_TTL_MS) return hit.info;

  const providers = await tmdbGet<RawProvidersResponse>(`/${mediaType}/${tmdbId}/watch/providers`, apiKey).catch(
    () => ({ results: {} }) as RawProvidersResponse,
  );
  const it = providers.results?.IT;
  const info: TmdbWatchInfo = {
    streaming: toProviders(it?.flatrate),
    free: toProviders([...(it?.free ?? []), ...(it?.ads ?? [])]),
    rent: toProviders(it?.rent),
    buy: toProviders(it?.buy),
    link: it?.link ?? null,
  };
  watchCache.set(key, { at: Date.now(), info });
  return info;
}

export async function getDetails(tmdbId: number, mediaType: "movie" | "tv", apiKey: string): Promise<TmdbDetails> {
  const details = await tmdbGet<RawDetails>(`/${mediaType}/${tmdbId}`, apiKey, {
    append_to_response:
      mediaType === "movie"
        ? "credits,videos,recommendations,release_dates"
        : "credits,videos,recommendations,content_ratings",
  });
  const watch = await getWatchProviders(tmdbId, mediaType, apiKey);

  const genreNames = (details.genres ?? []).map((g) => g.name);
  const dateStr = details.release_date || details.first_air_date;
  const director =
    mediaType === "movie"
      ? details.credits?.crew?.find((c) => c.job === "Director")?.name || ""
      : (details.created_by ?? []).map((c) => c.name).join(", ");

  const trailer = (details.videos?.results ?? []).find(
    (v) => v.site === "YouTube" && v.type === "Trailer" && v.official,
  ) || (details.videos?.results ?? []).find((v) => v.site === "YouTube" && v.type === "Trailer");

  return {
    tmdbId: details.id,
    title: details.title || details.name || "",
    year: dateStr ? Number(dateStr.slice(0, 4)) : null,
    genre: genreNames[0] ?? "",
    runtime: mediaType === "movie" ? details.runtime ?? 0 : details.episode_run_time?.[0] ?? 0,
    episodes: mediaType === "tv" ? details.number_of_episodes ?? null : null,
    seasons: mediaType === "tv" ? details.number_of_seasons ?? null : null,
    overview: details.overview || "",
    director,
    cast: (details.credits?.cast ?? []).slice(0, 5).map((c) => c.name),
    similar: (details.recommendations?.results ?? [])
      .slice(0, 3)
      .map((r) => r.title || r.name || "")
      .filter(Boolean),
    posterPath: details.poster_path ?? null,
    backdropPath: details.backdrop_path ?? null,
    trailerUrl: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null,
    // Solo l'abbonamento: questo campo finisce nella piattaforma del titolo in
    // libreria, e "l'ho noleggiato una volta" non è la piattaforma su cui sta.
    watchProviders: watch.streaming,
    // TV shows have no collection on TMDB, so `null` there is a real answer
    // ("standalone"), not a gap waiting to be filled.
    collectionId: details.belongs_to_collection?.id ?? null,
    collectionName: details.belongs_to_collection?.name ?? null,
    releaseDate: dateStr ?? null,
    // The first company is the one people mean by "studio". TMDB lists every
    // co-producer and financing vehicle after it, which is accurate and
    // useless as a filter — nobody looks for a film by its tax-credit partner.
    studio: details.production_companies?.[0]?.name ?? "",
    // `origin_country` is the fallback because TV records carry that but
    // frequently leave production_countries empty.
    countries:
      details.production_countries?.map((c) => c.iso_3166_1).filter(Boolean) ??
      details.origin_country ??
      [],
    tmdbRating: typeof details.vote_average === "number" && details.vote_average > 0 ? details.vote_average : null,
    audioLangs: details.spoken_languages?.map((l) => l.iso_639_1).filter(Boolean) ?? [],
    certification: readCertification(details, mediaType),
  };
}

// ---------------------------------------------------------------------------
// Discover — the structured search behind natural-language queries.
//
// The genre table is inlined rather than fetched. TMDB's genre ids are a fixed,
// published list that has not changed in years, and the alternative costs a
// round trip *before* the search can even be composed — on a page whose whole
// promise is answering a typed sentence quickly.
// ---------------------------------------------------------------------------

export const MOVIE_GENRES: Record<number, string> = {
  28: "Azione",
  12: "Avventura",
  16: "Animazione",
  35: "Commedia",
  80: "Crime",
  99: "Documentario",
  18: "Drammatico",
  10751: "Famiglia",
  14: "Fantasy",
  36: "Storia",
  27: "Horror",
  10402: "Musica",
  9648: "Mistero",
  10749: "Romantico",
  878: "Fantascienza",
  10770: "Film TV",
  53: "Thriller",
  10752: "Guerra",
  37: "Western",
};

export const TV_GENRES: Record<number, string> = {
  10759: "Action & Adventure",
  16: "Animazione",
  35: "Commedia",
  80: "Crime",
  99: "Documentario",
  18: "Drammatico",
  10751: "Famiglia",
  10762: "Kids",
  9648: "Mistero",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics",
  37: "Western",
};

export interface DiscoverQuery {
  mediaType: "movie" | "tv";
  genreIds: number[];
  yearFrom?: number;
  yearTo?: number;
  runtimeMin?: number;
  runtimeMax?: number;
  voteMin?: number;
  /** A person's name to narrow by — resolved to a TMDB id before searching. */
  person?: string;
  /** Free text handed to TMDB's keyword index. */
  keywords?: string;
  sortBy?: "popularity.desc" | "vote_average.desc" | "primary_release_date.desc";
}

async function resolvePersonId(name: string, apiKey: string): Promise<number | null> {
  try {
    const data = await tmdbGet<{ results?: { id: number }[] }>("/search/person", apiKey, { query: name });
    return data.results?.[0]?.id ?? null;
  } catch {
    // A name TMDB doesn't know shouldn't sink the whole search — the rest of
    // the filters still describe something worth showing.
    return null;
  }
}

async function resolveKeywordId(text: string, apiKey: string): Promise<number | null> {
  try {
    const data = await tmdbGet<{ results?: { id: number }[] }>("/search/keyword", apiKey, { query: text });
    return data.results?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

export async function discoverTitles(query: DiscoverQuery, apiKey: string): Promise<TmdbSearchResult[]> {
  const isTv = query.mediaType === "tv";
  const params: Record<string, string> = {
    include_adult: "false",
    sort_by: query.sortBy ?? "popularity.desc",
    // Without a vote floor, sorting by rating returns films with a single
    // 10/10 vote — technically the highest rated, and useless as an answer.
    "vote_count.gte": query.sortBy === "vote_average.desc" ? "200" : "50",
    page: "1",
  };

  if (query.genreIds.length) params.with_genres = query.genreIds.join(",");
  if (query.voteMin !== undefined) params["vote_average.gte"] = String(query.voteMin);
  if (query.runtimeMin !== undefined) params["with_runtime.gte"] = String(query.runtimeMin);
  if (query.runtimeMax !== undefined) params["with_runtime.lte"] = String(query.runtimeMax);

  // Films and series use different date parameters; TMDB rejects the wrong one.
  const fromKey = isTv ? "first_air_date.gte" : "primary_release_date.gte";
  const toKey = isTv ? "first_air_date.lte" : "primary_release_date.lte";
  if (query.yearFrom !== undefined) params[fromKey] = `${query.yearFrom}-01-01`;
  if (query.yearTo !== undefined) params[toKey] = `${query.yearTo}-12-31`;

  if (query.person) {
    const personId = await resolvePersonId(query.person, apiKey);
    // `with_people` covers cast and crew together, so "un film di Villeneuve"
    // and "un film con Gosling" both land without having to know which is which.
    if (personId) params[isTv ? "with_people" : "with_people"] = String(personId);
  }

  if (query.keywords) {
    const keywordId = await resolveKeywordId(query.keywords, apiKey);
    if (keywordId) params.with_keywords = String(keywordId);
  }

  const data = await tmdbGet<{ results: RawMultiSearchResult[] }>(
    isTv ? "/discover/tv" : "/discover/movie",
    apiKey,
    params,
  );

  return data.results.slice(0, 20).map((r) => {
    const genreNames = (r.genre_ids ?? []).map((id) => GENRE_NAMES[id]).filter((n): n is string => !!n);
    const dateStr = r.release_date || r.first_air_date;
    return {
      tmdbId: r.id,
      mediaType: query.mediaType,
      title: r.title || r.name || "",
      year: dateStr ? Number(dateStr.slice(0, 4)) : null,
      overview: r.overview || "",
      posterPath: r.poster_path ?? null,
      kind: guessKind(query.mediaType, genreNames, r.origin_country),
      popularity: r.popularity ?? 0,
    };
  });
}

/**
 * The English synopsis, for when the Italian one doesn't exist.
 *
 * `language=it-IT` returns an *empty* overview rather than falling back, so a
 * title nobody has translated shows a blank card. Fetching the original is the
 * only way to have anything to translate at all.
 */
export async function getOverviewInEnglish(
  tmdbId: number,
  mediaType: "movie" | "tv",
  apiKey: string,
): Promise<string> {
  const details = await tmdbGet<{ overview?: string }>(`/${mediaType}/${tmdbId}`, apiKey, {
    language: "en-US",
  });
  return details.overview?.trim() ?? "";
}

export type DiscoverFeed = "trending" | "cinema" | "upcoming" | "top" | "trendingTv";

const FEED_PATH: Record<DiscoverFeed, string> = {
  trending: "/trending/movie/week",
  cinema: "/movie/now_playing",
  upcoming: "/movie/upcoming",
  top: "/movie/top_rated",
  trendingTv: "/trending/tv/week",
};

// Catalogue rows change at most daily; a session should never fetch one twice.
const feedCache = new Map<DiscoverFeed, { at: number; rows: TmdbSearchResult[] }>();
const FEED_TTL_MS = 3 * 60 * 60 * 1000;

export async function getFeed(feed: DiscoverFeed, apiKey: string): Promise<TmdbSearchResult[]> {
  const hit = feedCache.get(feed);
  if (hit && Date.now() - hit.at < FEED_TTL_MS) return hit.rows;

  const isTv = feed === "trendingTv";
  const params: Record<string, string> = { page: "1" };
  if (feed === "cinema" || feed === "upcoming") params.region = "IT";
  const data = await tmdbGet<{ results: RawMultiSearchResult[] }>(FEED_PATH[feed], apiKey, params);

  const rows = data.results
    .slice(0, 20)
    .map((r) => {
      const mediaType: "movie" | "tv" = r.media_type === "tv" || isTv ? "tv" : "movie";
      const genreNames = (r.genre_ids ?? []).map((id) => GENRE_NAMES[id]).filter((n): n is string => !!n);
      const dateStr = r.release_date || r.first_air_date;
      return {
        tmdbId: r.id,
        mediaType,
        title: r.title || r.name || "",
        year: dateStr ? Number(dateStr.slice(0, 4)) : null,
        overview: r.overview || "",
        posterPath: r.poster_path ?? null,
        kind: guessKind(mediaType, genreNames, r.origin_country),
        popularity: r.popularity ?? 0,
      };
    })
    .filter((r) => r.title);

  feedCache.set(feed, { at: Date.now(), rows });
  return rows;
}

export interface TmdbUpcomingEpisode {
  airDate: string | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
}

interface RawTvMinimal {
  next_episode_to_air?: { air_date: string; season_number: number; episode_number: number } | null;
}

export async function getNextEpisode(tmdbId: number, apiKey: string): Promise<TmdbUpcomingEpisode> {
  const data = await tmdbGet<RawTvMinimal>(`/tv/${tmdbId}`, apiKey);
  const next = data.next_episode_to_air;
  return next
    ? { airDate: next.air_date, seasonNumber: next.season_number, episodeNumber: next.episode_number }
    : { airDate: null, seasonNumber: null, episodeNumber: null };
}

export interface TmdbPersonHit {
  id: number;
  name: string;
  profilePath: string | null;
  /** "Recitazione", "Regia" — il mestiere per cui TMDB la conosce. */
  department: string;
  /** I due o tre titoli per cui è conosciuta: è così che si riconosce un nome. */
  knownFor: string[];
}

interface RawPersonHit {
  id: number;
  name?: string;
  profile_path?: string | null;
  known_for_department?: string;
  known_for?: { title?: string; name?: string }[];
}

const DEPARTMENTS: Record<string, string> = {
  Acting: "Recitazione",
  Directing: "Regia",
  Writing: "Sceneggiatura",
  Production: "Produzione",
  Sound: "Musica e suono",
  Camera: "Fotografia",
};

/** Le persone che corrispondono a un nome, per la scheda Persone della ricerca. */
export async function searchPeople(
  query: string,
  apiKey: string,
  signal?: AbortSignal,
  limit = 18,
): Promise<TmdbPersonHit[]> {
  const data = await tmdbGet<{ results?: RawPersonHit[] }>(
    "/search/person",
    apiKey,
    { query, include_adult: "false" },
    signal,
  );
  return (data.results ?? []).slice(0, limit).map((r) => ({
    id: r.id,
    name: r.name?.trim() ?? "",
    profilePath: r.profile_path ?? null,
    department: DEPARTMENTS[r.known_for_department ?? ""] ?? r.known_for_department ?? "",
    knownFor: (r.known_for ?? []).map((k) => k.title || k.name || "").filter(Boolean).slice(0, 3),
  }));
}

/* ------------------------------------------------------------------ */
/* Cast con foto e personaggio                                         */
/* ------------------------------------------------------------------ */

export interface TmdbCastMember {
  id: number;
  name: string;
  /** Chi interpreta. Vuoto per chi compare come sé stesso o nei documentari. */
  character: string;
  profilePath: string | null;
}

interface RawCastMember {
  id: number;
  name?: string;
  character?: string;
  profile_path?: string | null;
  order?: number;
}

/**
 * Il cast con le facce, non solo con i nomi.
 *
 * La libreria salva `cast` come cinque stringhe, che bastano per cercare e non
 * bastano per riconoscere: metà delle volte un attore lo si ricorda in faccia e
 * per il personaggio, non per il nome anagrafico. Sta a parte da `getDetails`
 * perché serve solo alla scheda aperta, e tenerlo lì avrebbe appesantito ogni
 * collegamento automatico fatto in sottofondo.
 */
const creditsCache = new Map<string, TmdbCastMember[]>();

export async function getCast(
  tmdbId: number,
  mediaType: "movie" | "tv",
  apiKey: string,
  limit = 12,
): Promise<TmdbCastMember[]> {
  const key = `${mediaType}:${tmdbId}`;
  const hit = creditsCache.get(key);
  if (hit) return hit.slice(0, limit);

  const path = mediaType === "movie" ? `/movie/${tmdbId}/credits` : `/tv/${tmdbId}/aggregate_credits`;
  const data = await tmdbGet<{ cast?: (RawCastMember & { roles?: { character?: string }[] })[] }>(path, apiKey);
  const cast = (data.cast ?? [])
    .slice(0, 24)
    .map((c) => ({
      id: c.id,
      name: c.name?.trim() ?? "",
      // Le serie rispondono con `roles[]` (un attore può avere più personaggi
      // nell'arco di sette stagioni); i film con `character`. Prendo il primo,
      // che è quello per cui la persona è conosciuta in quel titolo.
      character: (c.roles?.[0]?.character || c.character || "").trim(),
      profilePath: c.profile_path ?? null,
    }))
    .filter((c) => c.name);

  creditsCache.set(key, cast);
  return cast.slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* Logo del titolo                                                     */
/* ------------------------------------------------------------------ */

/**
 * Il "title treatment": il logo del titolo disegnato, quello che sulle app di
 * streaming sta al posto del nome scritto in cima alla vetrina.
 *
 * Vale la pena andarlo a prendere perché è metà dell'effetto: «Cent'anni di
 * solitudine» composto nel lettering della serie *è* la locandina, mentre lo
 * stesso testo nel font dell'app è una didascalia. Quando non c'è — e per molti
 * titoli non c'è — resta il titolo scritto, che è sempre stata la resa
 * predefinita.
 *
 * Italiano prima, inglese poi, senza lingua per ultimo: un logo inglese su un
 * titolo italiano è comunque il logo giusto, un logo giapponese quasi mai.
 */
const logoCache = new Map<string, string | null>();

export async function getTitleLogo(
  tmdbId: number,
  mediaType: "movie" | "tv",
  apiKey: string,
): Promise<string | null> {
  const key = `${mediaType}:${tmdbId}`;
  const hit = logoCache.get(key);
  if (hit !== undefined) return hit;

  try {
    const data = await tmdbGet<{ logos?: { file_path: string; iso_639_1: string | null }[] }>(
      `/${mediaType}/${tmdbId}/images`,
      apiKey,
      { include_image_language: "it,en,null" },
    );
    const logos = data.logos ?? [];
    const pick =
      logos.find((l) => l.iso_639_1 === "it") ??
      logos.find((l) => l.iso_639_1 === "en") ??
      logos.find((l) => l.iso_639_1 === null) ??
      null;
    // I `.svg` di TMDB non hanno dimensioni intrinseche e il ridimensionatore
    // non li serve nelle larghezze `w…`: si prende il PNG, che c'è quasi sempre.
    const path = pick && !pick.file_path.endsWith(".svg") ? `${IMG_BASE}/w500${pick.file_path}` : null;
    logoCache.set(key, path);
    return path;
  } catch {
    logoCache.set(key, null);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Stagioni ed episodi                                                 */
/* ------------------------------------------------------------------ */

export interface TmdbEpisode {
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  overview: string;
  /** Il fotogramma dell'episodio, 16:9. Assente per gli episodi non ancora usciti. */
  stillPath: string | null;
  runtime: number | null;
  /** La media di TMDB, 0–10. Null quando nessuno l'ha ancora votato. */
  rating: number | null;
  airDate: string | null;
}

interface RawEpisode {
  season_number?: number;
  episode_number?: number;
  name?: string;
  overview?: string;
  still_path?: string | null;
  runtime?: number | null;
  vote_average?: number;
  air_date?: string | null;
}

/**
 * Le miniature degli episodi. Due larghezze sole: la scheda le mostra alte
 * poco più di sessanta pixel su un telefono, e oltre `w300` si paga peso che
 * nessuno vede.
 */
export type StillSize = "w185" | "w300";

export function stillUrl(path: string | null | undefined, size: StillSize = "w300"): string | null {
  return path ? `${IMG_BASE}/${size}${path}` : null;
}

/**
 * Una stagione cambia di rado — un episodio a settimana nel caso più veloce —
 * mentre la scheda si riapre di continuo. Sei ore è la stessa finestra usata
 * per le date di uscita, e vale la pena tenerla: senza, ogni passaggio fra le
 * pastiglie delle stagioni sarebbe una chiamata in rete.
 */
const seasonCache = new Map<string, { at: number; episodes: TmdbEpisode[] }>();
const SEASON_TTL_MS = 6 * 60 * 60 * 1000;

export async function getSeason(
  tvId: number,
  seasonNumber: number,
  apiKey: string,
): Promise<TmdbEpisode[]> {
  const key = `${tvId}:${seasonNumber}`;
  const hit = seasonCache.get(key);
  if (hit && Date.now() - hit.at < SEASON_TTL_MS) return hit.episodes;

  const data = await tmdbGet<{ episodes?: RawEpisode[] }>(`/tv/${tvId}/season/${seasonNumber}`, apiKey);
  const episodes = (data.episodes ?? []).map((e, i) => ({
    seasonNumber: e.season_number ?? seasonNumber,
    episodeNumber: e.episode_number ?? i + 1,
    title: e.name?.trim() || `Episodio ${e.episode_number ?? i + 1}`,
    overview: e.overview?.trim() ?? "",
    stillPath: e.still_path ?? null,
    runtime: e.runtime && e.runtime > 0 ? e.runtime : null,
    // Zero su TMDB vuol dire "nessuno ha votato", non "voto zero": mostrarlo
    // come 0.0 direbbe una cosa falsa di ogni episodio appena uscito.
    rating: e.vote_average && e.vote_average > 0 ? e.vote_average : null,
    airDate: e.air_date || null,
  }));

  seasonCache.set(key, { at: Date.now(), episodes });
  return episodes;
}

/* ------------------------------------------------------------------ */
/* Saghe — TMDB collections                                            */
/* ------------------------------------------------------------------ */

export interface TmdbSagaPart {
  tmdbId: number;
  title: string;
  releaseDate: string | null;
  year: number | null;
  overview: string;
  posterPath: string | null;
}

export interface TmdbSaga {
  id: number;
  name: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  parts: TmdbSagaPart[];
}

interface RawCollection {
  id: number;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  parts?: {
    id: number;
    title?: string;
    name?: string;
    release_date?: string;
    overview?: string;
    poster_path?: string | null;
  }[];
}

/**
 * TMDB names collections "X Collection" / "X - Collezione", which reads as
 * noise once the word "saga" is already in the interface around it.
 */
export function cleanSagaName(name: string): string {
  return name
    .replace(/\s*[-–—]?\s*(collezione|collection|saga|serie di film)\s*$/i, "")
    .trim() || name;
}

const collectionCache = new Map<number, TmdbSaga>();

export async function getSaga(collectionId: number, apiKey: string): Promise<TmdbSaga> {
  const hit = collectionCache.get(collectionId);
  if (hit) return hit;

  const raw = await tmdbGet<RawCollection>(`/collection/${collectionId}`, apiKey);
  const parts = (raw.parts ?? [])
    .map((p) => {
      const date = p.release_date || null;
      return {
        tmdbId: p.id,
        title: p.title || p.name || "",
        releaseDate: date && date.length >= 4 ? date : null,
        year: date && date.length >= 4 ? Number(date.slice(0, 4)) : null,
        overview: p.overview || "",
        posterPath: p.poster_path ?? null,
      };
    })
    .filter((p) => p.title)
    // Unreleased entries carry no date and would otherwise sort to the front.
    .sort((a, b) => (a.releaseDate ?? "9999").localeCompare(b.releaseDate ?? "9999"));

  const saga: TmdbSaga = {
    id: raw.id,
    name: cleanSagaName(raw.name ?? ""),
    overview: raw.overview ?? "",
    posterPath: raw.poster_path ?? null,
    backdropPath: raw.backdrop_path ?? null,
    parts,
  };
  collectionCache.set(collectionId, saga);
  return saga;
}

/* ------------------------------------------------------------------ */
/* Persone — attori e registi                                          */
/* ------------------------------------------------------------------ */

export interface TmdbPersonCredit {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  year: number | null;
  posterPath: string | null;
  /** Character played, or the crew job for a director credit. */
  role: string;
  kind: Kind;
  popularity: number;
}

export interface TmdbPerson {
  id: number;
  name: string;
  biography: string;
  profilePath: string | null;
  knownFor: string;
  birthday: string | null;
  placeOfBirth: string | null;
  actingCredits: TmdbPersonCredit[];
  directingCredits: TmdbPersonCredit[];
}

interface RawPersonCredit {
  id: number;
  media_type?: "movie" | "tv";
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  character?: string;
  job?: string;
  genre_ids?: number[];
  origin_country?: string[];
  popularity?: number;
}

interface RawPerson {
  id: number;
  name?: string;
  biography?: string;
  profile_path?: string | null;
  known_for_department?: string;
  birthday?: string | null;
  place_of_birth?: string | null;
  combined_credits?: { cast?: RawPersonCredit[]; crew?: RawPersonCredit[] };
}

const DEPARTMENT_LABELS: Record<string, string> = {
  Acting: "Interpretazione",
  Directing: "Regia",
  Writing: "Sceneggiatura",
  Production: "Produzione",
  Sound: "Musiche e suono",
  Camera: "Fotografia",
};

function toPersonCredit(raw: RawPersonCredit, role: string): TmdbPersonCredit | null {
  const mediaType = raw.media_type === "tv" ? "tv" : raw.media_type === "movie" ? "movie" : null;
  if (!mediaType) return null;
  const title = raw.title || raw.name || "";
  if (!title) return null;
  const dateStr = raw.release_date || raw.first_air_date;
  const genreNames = (raw.genre_ids ?? []).map((id) => GENRE_NAMES[id]).filter((n): n is string => !!n);
  return {
    tmdbId: raw.id,
    mediaType,
    title,
    year: dateStr && dateStr.length >= 4 ? Number(dateStr.slice(0, 4)) : null,
    posterPath: raw.poster_path ?? null,
    role,
    kind: guessKind(mediaType, genreNames, raw.origin_country),
    popularity: raw.popularity ?? 0,
  };
}

/** Newest first, undated (announced) titles last rather than first. */
function byRecency(a: TmdbPersonCredit, b: TmdbPersonCredit): number {
  return (b.year ?? 0) - (a.year ?? 0);
}

const personIdCache = new Map<string, number | null>();
const personCache = new Map<number, TmdbPerson>();

/** Resolves a name to a TMDB person id — the library stores names, not ids. */
export async function findPersonId(name: string, apiKey: string): Promise<number | null> {
  const key = name.trim().toLowerCase();
  if (!key) return null;
  if (personIdCache.has(key)) return personIdCache.get(key) ?? null;

  const data = await tmdbGet<{ results: { id: number; name: string; popularity?: number }[] }>(
    "/search/person",
    apiKey,
    { query: name, include_adult: "false" },
  );
  const exact = data.results.find((r) => r.name.trim().toLowerCase() === key);
  const id = (exact ?? data.results[0])?.id ?? null;
  personIdCache.set(key, id);
  return id;
}

export async function getPerson(personId: number, apiKey: string): Promise<TmdbPerson> {
  const hit = personCache.get(personId);
  if (hit) return hit;

  const raw = await tmdbGet<RawPerson>(`/person/${personId}`, apiKey, {
    append_to_response: "combined_credits",
  });

  const acting = (raw.combined_credits?.cast ?? [])
    .map((c) => toPersonCredit(c, c.character || ""))
    .filter((c): c is TmdbPersonCredit => c !== null)
    .sort(byRecency);

  const directing = (raw.combined_credits?.crew ?? [])
    .filter((c) => c.job === "Director")
    .map((c) => toPersonCredit(c, "Regia"))
    .filter((c): c is TmdbPersonCredit => c !== null)
    .sort(byRecency);

  // The same film can appear twice in a crew list (director + producer, say).
  const seen = new Set<number>();
  const uniqueDirecting = directing.filter((c) => !seen.has(c.tmdbId) && seen.add(c.tmdbId));

  const person: TmdbPerson = {
    id: raw.id,
    name: raw.name ?? "",
    biography: raw.biography ?? "",
    profilePath: raw.profile_path ?? null,
    knownFor: DEPARTMENT_LABELS[raw.known_for_department ?? ""] ?? raw.known_for_department ?? "",
    birthday: raw.birthday ?? null,
    placeOfBirth: raw.place_of_birth ?? null,
    actingCredits: acting,
    directingCredits: uniqueDirecting,
  };
  personCache.set(personId, person);
  return person;
}

export function profileUrl(path: string | null | undefined, size: "w185" | "h632" = "w185"): string | null {
  return path ? `${IMG_BASE}/${size}${path}` : null;
}

/* ------------------------------------------------------------------ */
/* Universi — costruiti dalle keyword TMDB                             */
/* ------------------------------------------------------------------ */

const keywordIdCache = new Map<string, number | null>();

/**
 * Universes are not a TMDB entity: what ties the MCU together is a keyword
 * applied to every film. Resolving the keyword at runtime keeps the app from
 * shipping a hardcoded list of ids that silently rots as films are added.
 */
export async function findKeywordId(query: string, apiKey: string): Promise<number | null> {
  const key = query.trim().toLowerCase();
  if (keywordIdCache.has(key)) return keywordIdCache.get(key) ?? null;

  const data = await tmdbGet<{ results: { id: number; name: string }[] }>("/search/keyword", apiKey, { query });
  const exact = data.results.find((r) => r.name.trim().toLowerCase() === key);
  const id = (exact ?? data.results[0])?.id ?? null;
  keywordIdCache.set(key, id);
  return id;
}

export async function getKeywordMovies(keywordId: number, apiKey: string): Promise<TmdbSagaPart[]> {
  const pages = await Promise.all(
    [1, 2].map((page) =>
      tmdbGet<{ results: RawMultiSearchResult[] }>("/discover/movie", apiKey, {
        with_keywords: String(keywordId),
        sort_by: "primary_release_date.asc",
        include_adult: "false",
        page: String(page),
      }).catch(() => ({ results: [] as RawMultiSearchResult[] })),
    ),
  );

  const seen = new Set<number>();
  return pages
    .flatMap((p) => p.results)
    .filter((r) => !seen.has(r.id) && seen.add(r.id))
    .map((r) => {
      const date = r.release_date || null;
      return {
        tmdbId: r.id,
        title: r.title || r.name || "",
        releaseDate: date && date.length >= 4 ? date : null,
        year: date && date.length >= 4 ? Number(date.slice(0, 4)) : null,
        overview: r.overview || "",
        posterPath: r.poster_path ?? null,
      };
    })
    .filter((p) => p.title && p.releaseDate)
    .sort((a, b) => (a.releaseDate ?? "9999").localeCompare(b.releaseDate ?? "9999"));
}

/* ------------------------------------------------------------------ */
/* Il resto della scheda — troupe, soldi, studi, immagini, correlati    */
/* ------------------------------------------------------------------ */

/** Una persona della troupe: il mestiere in italiano, la faccia quando c'è. */
export interface TmdbCrewCredit {
  id: number;
  name: string;
  /** "Regia", "Sceneggiatura", "Musiche" — già tradotto. */
  job: string;
  profilePath: string | null;
}

export interface TmdbCompany {
  id: number;
  name: string;
  logoPath: string | null;
  /** Codice ISO del paese della casa di produzione, quando TMDB lo sa. */
  country: string;
}

export interface TmdbVideo {
  key: string;
  name: string;
  /** "Trailer", "Teaser", "Dietro le quinte"… già in italiano. */
  kind: string;
  language: string;
}

export interface TmdbTitleExtras {
  /** La frase della locandina. Vuota per la maggior parte dei titoli. */
  tagline: string;
  homepage: string | null;
  /** Il titolo originale, mostrato solo quando è diverso da quello italiano. */
  originalTitle: string;
  /** In dollari. `0` vuol dire "TMDB non lo sa", non "è costato zero". */
  budget: number;
  revenue: number;
  /** Quante persone hanno votato su TMDB: dà il peso alla media. */
  voteCount: number;
  crew: TmdbCrewCredit[];
  companies: TmdbCompany[];
  videos: TmdbVideo[];
  /** Percorsi delle locandine alternative, italiane per prime. */
  posters: string[];
  backdrops: string[];
  related: TmdbSearchResult[];
}

interface RawImage {
  file_path: string;
  iso_639_1?: string | null;
  vote_average?: number;
}

interface RawExtras extends RawDetails {
  tagline?: string;
  homepage?: string | null;
  original_title?: string;
  original_name?: string;
  budget?: number;
  revenue?: number;
  vote_count?: number;
  images?: { posters?: RawImage[]; backdrops?: RawImage[] };
  credits?: { cast?: RawCast[]; crew?: (RawCrew & { id: number; profile_path?: string | null; department?: string })[] };
  videos?: { results?: (RawVideo & { name?: string; iso_639_1?: string })[] };
  recommendations?: { results?: RawMultiSearchResult[] };
}

/**
 * I mestieri che vale la pena nominare, nell'ordine in cui contano.
 *
 * TMDB elenca duecento persone per un film, dal regista al secondo assistente
 * al catering: mostrarle tutte non è generosità, è nascondere le quattro che
 * uno cerca davvero. Le altre restano su TMDB, che è il posto giusto per loro.
 */
const KEY_JOBS: Record<string, string> = {
  Director: "Regia",
  Screenplay: "Sceneggiatura",
  Writer: "Sceneggiatura",
  Story: "Soggetto",
  "Original Music Composer": "Musiche",
  "Director of Photography": "Fotografia",
  Producer: "Produzione",
  "Executive Producer": "Produzione esecutiva",
};
const JOB_ORDER = Object.keys(KEY_JOBS);

const VIDEO_KINDS: Record<string, string> = {
  Trailer: "Trailer",
  Teaser: "Teaser",
  Clip: "Scena",
  Featurette: "Speciale",
  "Behind the Scenes": "Dietro le quinte",
  Bloopers: "Papere",
};

/** L'anteprima di un video YouTube, senza chiamare YouTube. */
export function youtubeThumb(key: string): string {
  return `https://i.ytimg.com/vi/${key}/mqdefault.jpg`;
}

export function youtubeWatchUrl(key: string): string {
  return `https://www.youtube.com/watch?v=${key}`;
}

/** Italiano, poi inglese, poi le immagini senza scritte. */
function sortImages(images: RawImage[] | undefined, limit: number): string[] {
  const rank = (lang: string | null | undefined) => (lang === "it" ? 0 : lang === "en" ? 1 : 2);
  return (images ?? [])
    .slice()
    .sort((a, b) => rank(a.iso_639_1) - rank(b.iso_639_1) || (b.vote_average ?? 0) - (a.vote_average ?? 0))
    .slice(0, limit)
    .map((i) => i.file_path);
}

/**
 * Tutto quello che serve alla scheda aperta e a nient'altro.
 *
 * Sta fuori da `getDetails` di proposito: quella la chiama anche il collegatore
 * automatico in sottofondo, per ogni titolo della libreria, e appendergli
 * immagini e correlati avrebbe fatto pagare a ogni avvio dei dati che si
 * guardano solo aprendo una scheda. Una sola richiesta, però: `append_to_response`
 * fa fare a TMDB il lavoro di cinque chiamate.
 */
const extrasCache = new Map<string, Promise<TmdbTitleExtras>>();

export function getTitleExtras(tmdbId: number, mediaType: "movie" | "tv", apiKey: string): Promise<TmdbTitleExtras> {
  const key = `${mediaType}:${tmdbId}`;
  const hit = extrasCache.get(key);
  if (hit) return hit;

  // La promessa va in cache prima di essere attesa: la scheda monta quattro
  // riquadri che chiedono la stessa cosa nello stesso istante, e senza questo
  // partirebbero quattro richieste identiche.
  const promise = (async (): Promise<TmdbTitleExtras> => {
    const raw = await tmdbGet<RawExtras>(`/${mediaType}/${tmdbId}`, apiKey, {
      append_to_response: "credits,images,videos,recommendations",
      // Senza questi due, `language=it-IT` restituisce solo il materiale
      // italiano — che per tre titoli su quattro vuol dire niente.
      include_image_language: "it,en,null",
      include_video_language: "it,en",
    });

    const crewRaw = raw.credits?.crew ?? [];
    const seenPeople = new Set<number>();
    const crew: TmdbCrewCredit[] = crewRaw
      .filter((c) => c.job in KEY_JOBS)
      .sort((a, b) => JOB_ORDER.indexOf(a.job) - JOB_ORDER.indexOf(b.job))
      .filter((c) => !seenPeople.has(c.id) && seenPeople.add(c.id))
      .slice(0, 6)
      .map((c) => ({ id: c.id, name: c.name, job: KEY_JOBS[c.job], profilePath: c.profile_path ?? null }));

    // Le serie non hanno un regista: hanno chi le ha ideate, e TMDB lo tiene
    // in un campo tutto suo. Va in testa, perché è il nome che si cerca.
    const creators: TmdbCrewCredit[] = (raw.created_by ?? []).map((c, i) => ({
      id: c.id ?? -1 - i,
      name: c.name,
      job: "Ideata da",
      profilePath: c.profile_path ?? null,
    }));

    const relatedSeen = new Set<number>();
    const related = (raw.recommendations?.results ?? [])
      .filter((r) => !relatedSeen.has(r.id) && relatedSeen.add(r.id))
      .map((r) => {
        const type: "movie" | "tv" = r.media_type === "tv" || r.media_type === "movie" ? r.media_type : mediaType;
        const genreNames = (r.genre_ids ?? []).map((id) => GENRE_NAMES[id]).filter((n): n is string => !!n);
        const dateStr = r.release_date || r.first_air_date;
        return {
          tmdbId: r.id,
          mediaType: type,
          title: r.title || r.name || "",
          year: dateStr && dateStr.length >= 4 ? Number(dateStr.slice(0, 4)) : null,
          overview: r.overview || "",
          posterPath: r.poster_path ?? null,
          kind: guessKind(type, genreNames, r.origin_country),
          popularity: r.popularity ?? 0,
        };
      })
      .filter((r) => r.title && r.posterPath)
      .slice(0, 20);

    const videos = (raw.videos?.results ?? [])
      .filter((v) => v.site === "YouTube" && v.key)
      // I trailer per primi, poi il resto: chi apre "Video" cerca quello.
      .sort((a, b) => (a.type === "Trailer" ? -1 : 0) - (b.type === "Trailer" ? -1 : 0))
      .slice(0, 12)
      .map((v) => ({
        key: v.key,
        name: v.name?.trim() || VIDEO_KINDS[v.type] || "Video",
        kind: VIDEO_KINDS[v.type] ?? v.type,
        language: v.iso_639_1 ?? "",
      }));

    return {
      tagline: raw.tagline?.trim() ?? "",
      homepage: raw.homepage?.trim() || null,
      originalTitle: (raw.original_title || raw.original_name || "").trim(),
      budget: raw.budget ?? 0,
      revenue: raw.revenue ?? 0,
      voteCount: raw.vote_count ?? 0,
      crew: [...creators, ...crew],
      companies: (raw.production_companies ?? []).map((c) => ({
        id: c.id ?? 0,
        name: c.name,
        logoPath: c.logo_path ?? null,
        country: c.origin_country ?? "",
      })),
      videos,
      posters: sortImages(raw.images?.posters, 16),
      backdrops: sortImages(raw.images?.backdrops, 16),
      related,
    };
  })();

  extrasCache.set(key, promise);
  // Una richiesta fallita non deve restare in cache come fallimento eterno: la
  // scheda riaperta fra un minuto deve poter riprovare.
  promise.catch(() => extrasCache.delete(key));
  return promise;
}

/**
 * Butta via tutto quello che è stato tenuto da parte da TMDB.
 *
 * Le cache di questo file valgono da sei ore a tutta la sessione, e questo è
 * giusto per una locandina e sbagliato per un episodio uscito stamattina.
 * «Aggiorna contenuti» è il modo di dire "quello che hai in mano è vecchio,
 * richiedilo": senza, l'unica via era chiudere e riaprire l'app — e con una
 * app installata sul telefono nemmeno quella basta sempre.
 *
 * Non tocca la libreria: quella è tua e non si ricarica da nessuna parte.
 */
export function clearTmdbCaches(): void {
  feedCache.clear();
  seasonCache.clear();
  watchCache.clear();
  extrasCache.clear();
  creditsCache.clear();
  logoCache.clear();
  collectionCache.clear();
  personCache.clear();
  personIdCache.clear();
  keywordIdCache.clear();
  releaseDateCache.clear();
}

/* ------------------------------------------------------------------ */
/* Date di uscita — per il calendario                                  */
/* ------------------------------------------------------------------ */

const releaseDateCache = new Map<string, { date: string | null; at: number }>();
const RELEASE_TTL_MS = 6 * 60 * 60 * 1000;

export async function getReleaseDate(
  tmdbId: number,
  mediaType: "movie" | "tv",
  apiKey: string,
): Promise<string | null> {
  const key = `${mediaType}:${tmdbId}`;
  const hit = releaseDateCache.get(key);
  if (hit && Date.now() - hit.at < RELEASE_TTL_MS) return hit.date;

  const raw = await tmdbGet<RawDetails>(`/${mediaType}/${tmdbId}`, apiKey);
  const date = raw.release_date || raw.first_air_date || null;
  releaseDateCache.set(key, { date, at: Date.now() });
  return date;
}
