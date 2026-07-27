import type { Kind } from "../types";

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
    throw new TmdbApiError("Connessione a TMDB non riuscita. Controlla la rete e riprova.");
  }
  if (!response.ok) {
    if (response.status === 401) throw new TmdbApiError("Chiave API TMDB non valida.", 401);
    if (response.status === 404) throw new TmdbApiError("Titolo non trovato su TMDB.", 404);
    throw new TmdbApiError(`Richiesta TMDB rifiutata (HTTP ${response.status}).`, response.status);
  }
  return (await response.json()) as T;
}

export function posterUrl(path: string | null | undefined, size: "w185" | "w342" | "w500" = "w342"): string | null {
  return path ? `${IMG_BASE}/${size}${path}` : null;
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
    append_to_response: "credits,videos,recommendations",
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
  };
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
