import { useEffect } from "react";
import { useLibrary } from "../store/useLibrary";
import { useSettings } from "../store/useSettings";
import { getDetails, searchTitles } from "./tmdb";
import type { Item } from "../types";

const DELAY_MS = 300;

// Module scope on purpose: this is a background sync against a global store,
// not component state. Keeping the guard outside React means a remount (React
// runs effects twice in development) cannot start a second pass or discard the
// results of the first one.
let running = false;
const attempted = new Set<string>();

function fillGaps(item: Item, d: Awaited<ReturnType<typeof getDetails>>, mediaType: "movie" | "tv"): Partial<Item> {
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

  useEffect(() => {
    if (!tmdbApiKey || pendingCount === 0 || running) return;
    running = true;

    void (async () => {
      try {
        for (;;) {
          // Re-read the store each round: the list can change while we work.
          const next = useLibrary.getState().items.find((i) => needsSync(i) && !attempted.has(i.id));
          if (!next) break;
          attempted.add(next.id);
          try {
            // An already-linked title skips the search entirely: it knows which
            // TMDB record it is, and re-searching by title could match a
            // different one and quietly rewrite a link the user had confirmed.
            const target =
              next.tmdbId && next.tmdbMediaType
                ? { tmdbId: next.tmdbId, mediaType: next.tmdbMediaType }
                : (await searchTitles(next.title, tmdbApiKey))[0];
            if (target) {
              const details = await getDetails(target.tmdbId, target.mediaType, tmdbApiKey);
              useLibrary.getState().updateItem(next.id, fillGaps(next, details, target.mediaType));
            }
          } catch {
            // Offline, rate limited or an unmatchable title: skip it rather
            // than spinning. A reload retries everything still unlinked.
          }
          await new Promise((r) => setTimeout(r, DELAY_MS));
        }
      } finally {
        running = false;
      }
    })();
  }, [tmdbApiKey, pendingCount]);
}

/** Lets a fresh key retry titles this session already gave up on. */
export function resetAutoLinkAttempts() {
  attempted.clear();
}
