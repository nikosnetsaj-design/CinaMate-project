import type { Item } from "../types";
import { posterUrl } from "../lib/tmdb";
import type { MediaContent, SagaEntry } from "./types";

/**
 * Bridge between CineMate's library and the player's content model.
 *
 * CineMate does not host or look up video files, so a title only becomes
 * playable if *you* have given it a source: an HLS manifest among its two
 * personal links (scheda titolo → "Link personali"). Everything else on the
 * shelf stays a diary entry, exactly as before.
 */

// A link is treated as a stream source only when its path ends in .m3u8 /
// .m3u — the manifest extension is unambiguous, so a normal bookmark
// (Letterboxd, a review, a trailer) is never mistaken for a video source.
// Query strings and fragments are ignored: signed CDN URLs almost always
// carry a token after the extension.
export function isHlsUrl(raw: string): boolean {
  try {
    return /\.m3u8?$/i.test(new URL(raw).pathname);
  } catch {
    return false;
  }
}

/** Protocol + host of a URL, or null when it doesn't parse. */
export function originOf(raw: string): string | null {
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

export function streamLinkOf(item: Item): string | null {
  return item.links.find(isHlsUrl) ?? null;
}

export function hasStream(item: Item): boolean {
  return streamLinkOf(item) !== null;
}

// A runtime of 0 (the default for a title added by hand without one) would
// make the marathon bar divide by zero, so fall back to a feature length.
const FALLBACK_RUNTIME_MIN = 100;

function entryOf(content: MediaContent, order: number): SagaEntry {
  return {
    id: content.id,
    order,
    title: content.title,
    durationSec: content.durationSec,
    posterUrl: content.posterUrl,
  };
}

function toMediaContent(item: Item, manifestUrl: string): MediaContent {
  const poster = posterUrl(item.posterPath, "w342") ?? "";
  return {
    id: item.id,
    // Every library title is a single playable asset (one manifest), not one
    // episode of many — the player's per-episode fields stay unused.
    type: "movie",
    title: item.title,
    posterUrl: poster,
    // The backdrop is only ever shown blurred behind the video, so the
    // poster at a larger size is a better source than nothing.
    backdropUrl: posterUrl(item.posterPath, "w500") ?? poster,
    durationSec: (item.runtime || FALLBACK_RUNTIME_MIN) * 60,
    manifestUrl,
    // Audio renditions come from the manifest itself and are discovered by
    // hls.js at load time; subtitles, skip markers and timeline sprites need
    // files CineMate has no way to know about, so they stay empty rather
    // than being faked.
    audioTracks: [],
    subtitleTracks: [],
    skipMarkers: [],
  };
}

/**
 * Every playable title on the shelf, each chained to the next one so
 * autoplay, the "prossimo contenuto" countdown and the end screen have
 * somewhere to go. Order follows the library order the caller passes in.
 */
export function buildPlayerCatalog(items: Item[]): MediaContent[] {
  const catalog = items.flatMap((item) => {
    const manifest = streamLinkOf(item);
    return manifest ? [toMediaContent(item, manifest)] : [];
  });

  return catalog.map((content, i) => {
    const next = catalog[i + 1];
    return next ? { ...content, nextInSaga: entryOf(next, i + 1) } : content;
  });
}
