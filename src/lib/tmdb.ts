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
}

export interface TmdbWatchProvider {
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

async function tmdbGet<T>(path: string, apiKey: string, params: Record<string, string> = {}): Promise<T> {
  if (!apiKey) throw new MissingTmdbKeyError();
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("language", "it-IT");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  let response: Response;
  try {
    response = await fetch(url.toString());
  } catch {
    // Logged as well as thrown: much of this runs in the background linker,
    // where the throw is swallowed on purpose so one unmatchable title doesn't
    // stop the pass — and the failure would otherwise leave no trace anywhere.
    logError("tmdb", "Connessione a TMDB non riuscita", path);
    throw new TmdbApiError("Connessione a TMDB non riuscita. Controlla la rete e riprova.");
  }
  if (!response.ok) {
    // A 404 is an ordinary answer here ("this title isn't on TMDB") rather
    // than a fault, so it stays out of the log — filling the page with those
    // would bury the failures worth reading.
    if (response.status !== 404) logError("tmdb", `HTTP ${response.status}`, path);
    if (response.status === 401) throw new TmdbApiError("Chiave API TMDB non valida.", 401);
    if (response.status === 404) throw new TmdbApiError("Titolo non trovato su TMDB.", 404);
    throw new TmdbApiError(`Richiesta TMDB rifiutata (HTTP ${response.status}).`, response.status);
  }
  return (await response.json()) as T;
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
}

// Minimal genre-id -> Italian name map for the multi-search result list (full
// details fetch below returns proper localized genre names; this is only
// used to guess film/serie/anime/doc for the search preview cards).
const GENRE_NAMES: Record<number, string> = {
  16: "Animazione",
  99: "Documentario",
};

export async function searchTitles(query: string, apiKey: string): Promise<TmdbSearchResult[]> {
  const data = await tmdbGet<{ results: RawMultiSearchResult[] }>("/search/multi", apiKey, {
    query,
    include_adult: "false",
  });
  return data.results
    .filter((r): r is RawMultiSearchResult & { media_type: "movie" | "tv" } => r.media_type === "movie" || r.media_type === "tv")
    .slice(0, 8)
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
      };
    });
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
interface RawProvidersResponse {
  results?: Record<string, { link?: string; flatrate?: { provider_name: string; logo_path: string }[] }>;
}
interface RawDetails {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  overview?: string;
  poster_path?: string | null;
  belongs_to_collection?: { id: number; name: string; poster_path?: string | null } | null;
  genres?: { name: string }[];
  runtime?: number;
  episode_run_time?: number[];
  number_of_episodes?: number;
  number_of_seasons?: number;
  origin_country?: string[];
  created_by?: { name: string }[];
  credits?: { cast?: RawCast[]; crew?: RawCrew[] };
  videos?: { results?: RawVideo[] };
  recommendations?: { results?: { title?: string; name?: string }[] };
  production_companies?: { name: string }[];
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

export interface TmdbWatchInfo {
  providers: TmdbWatchProvider[];
  link: string | null;
}

export async function getWatchProviders(tmdbId: number, mediaType: "movie" | "tv", apiKey: string): Promise<TmdbWatchInfo> {
  const providers = await tmdbGet<RawProvidersResponse>(`/${mediaType}/${tmdbId}/watch/providers`, apiKey).catch(
    () => ({ results: {} }) as RawProvidersResponse,
  );
  const itProviders = providers.results?.IT;
  return {
    providers: (itProviders?.flatrate ?? []).map((p) => ({ name: p.provider_name, logoPath: p.logo_path })),
    link: itProviders?.link ?? null,
  };
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
    trailerUrl: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null,
    watchProviders: watch.providers,
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
