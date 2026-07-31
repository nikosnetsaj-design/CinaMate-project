import { getDetails } from "./tmdb";
import { PLATFORMS, type Kind } from "../types";
import type { ItemDraft } from "./draft";

/**
 * Turns a TMDB record into a pre-filled draft for the add sheet. Shared by
 * every surface that can put a catalogue title into the library — Scopri, the
 * saga list, the universe timeline, a person's filmography — so a title added
 * from any of them arrives with exactly the same fields.
 */
export async function draftFromTmdb(
  tmdbId: number,
  mediaType: "movie" | "tv",
  kind: Kind,
  apiKey: string,
  fallbacks: { title?: string; year?: number | null; posterPath?: string | null } = {},
): Promise<Partial<ItemDraft>> {
  const d = await getDetails(tmdbId, mediaType, apiKey);
  const firstProvider = d.watchProviders[0]?.name ?? "";

  return {
    title: d.title || fallbacks.title || "",
    kind,
    year: d.year ?? fallbacks.year ?? new Date().getFullYear(),
    genre: d.genre,
    runtime: d.runtime,
    episodes: d.episodes,
    seasons: d.seasons,
    overview: d.overview,
    director: d.director,
    cast: d.cast,
    similar: d.similar,
    // Only adopt the provider when it is one the app knows how to label;
    // anything else would print a service name the filters cannot match.
    platform: (PLATFORMS as readonly string[]).includes(firstProvider)
      ? (firstProvider as (typeof PLATFORMS)[number])
      : "Altro",
    tmdbId: d.tmdbId,
    tmdbMediaType: mediaType,
    posterPath: d.posterPath ?? fallbacks.posterPath ?? null,
    trailerUrl: d.trailerUrl,
    collectionId: d.collectionId,
    collectionName: d.collectionName,
    studio: d.studio,
    countries: d.countries,
    tmdbRating: d.tmdbRating,
    audioLangs: d.audioLangs,
  };
}
