import type { Item } from "../types";
import { posterUrl } from "../lib/tmdb";
import { orderParts, findLibraryMatch } from "../lib/sagas";
import type { SagaOrders, WatchOrder } from "../lib/sagas";
import type { TmdbSaga } from "../lib/tmdb";
import { EMPTY_SOURCE } from "../store/usePlayerSources";
import type { PlayerSource } from "../store/usePlayerSources";
import type { MediaContent, SagaEntry, SubtitleTrack, SkipMarker } from "./types";

/**
 * Bridge between CineMate's library and the player's content model.
 *
 * CineMate does not host or look up video files, so a title only becomes
 * playable if *you* have given it a source: an HLS manifest, either among its
 * two personal links (scheda titolo → "Link personali") or in the player's own
 * per-title source panel. Everything else on the shelf stays a diary entry.
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

export type SourceLookup = (itemId: string) => PlayerSource;

/**
 * The manifest for a title, from the player's source panel first and the
 * personal links second. The panel wins so a title can carry a source without
 * spending one of its two link slots on it.
 */
export function streamUrlOf(item: Item, lookup: SourceLookup): string | null {
  const configured = lookup(item.id).manifestUrl?.trim();
  if (configured) return configured;
  return item.links.find(isHlsUrl) ?? null;
}

export function hasStream(item: Item, lookup: SourceLookup): boolean {
  return streamUrlOf(item, lookup) !== null;
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

function subtitleTracksOf(source: PlayerSource): SubtitleTrack[] {
  return source.subtitles.map((s) => ({
    id: s.id,
    language: s.language,
    label: s.label,
    url: s.url,
  }));
}

function markersOf(source: PlayerSource): SkipMarker[] {
  // A marker whose end is at or before its start would make the skip button
  // flicker on and immediately off; drop it rather than render that.
  return source.markers.filter((m) => m.endSec > m.startSec);
}

function toMediaContent(item: Item, manifestUrl: string, source: PlayerSource): MediaContent {
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
    // Audio renditions are declared by the manifest itself and hls.js finds
    // them at load time. Subtitles, skip markers and the timeline sprite need
    // files no catalogue knows about, so they come from the source panel.
    audioTracks: [],
    subtitleTracks: subtitleTracksOf(source),
    skipMarkers: markersOf(source),
    thumbnailSprite: source.sprite,
  };
}

/** Context needed to chain playable titles in their saga's viewing order. */
export interface SagaContext {
  sagas: Record<string, TmdbSaga>;
  orders: Record<string, SagaOrders>;
  preferredOrder: Record<string, WatchOrder>;
}

/**
 * The order to chain playable titles in. Titles that belong to a saga follow
 * that saga's chosen viewing order — the same order the Saghe page shows, so
 * "prossimo contenuto" never contradicts it. Anything standalone keeps the
 * order it was passed in.
 */
function sagaAwareOrder(items: Item[], saga: SagaContext | null): Item[] {
  if (!saga) return items;

  const byCollection = new Map<number, Item[]>();
  const standalone: Item[] = [];
  for (const item of items) {
    if (item.collectionId == null) standalone.push(item);
    else {
      const bucket = byCollection.get(item.collectionId);
      if (bucket) bucket.push(item);
      else byCollection.set(item.collectionId, [item]);
    }
  }

  const ordered: Item[] = [];
  for (const [collectionId, members] of byCollection) {
    const cached = saga.sagas[String(collectionId)];
    if (!cached) {
      ordered.push(...members);
      continue;
    }
    const key = `saga:${collectionId}`;
    const parts = orderParts(cached.parts, saga.preferredOrder[key] ?? "uscita", saga.orders[key]);
    // Walk the saga in its viewing order and pick up the members as they come.
    const remaining = new Set(members);
    for (const part of parts) {
      const match = findLibraryMatch(part, members);
      if (match && remaining.delete(match)) ordered.push(match);
    }
    // A member TMDB no longer lists (or that the order left out) still belongs
    // in the queue — appended rather than dropped.
    ordered.push(...members.filter((m) => remaining.has(m)));
  }

  return [...ordered, ...standalone];
}

/**
 * Every playable title on the shelf, each chained to the next one so autoplay,
 * the "prossimo contenuto" countdown and the end screen have somewhere to go.
 */
export function buildPlayerCatalog(
  items: Item[],
  lookup: SourceLookup = () => EMPTY_SOURCE,
  saga: SagaContext | null = null,
): MediaContent[] {
  const catalog = sagaAwareOrder(items, saga).flatMap((item) => {
    const manifest = streamUrlOf(item, lookup);
    return manifest ? [toMediaContent(item, manifest, lookup(item.id))] : [];
  });

  return catalog.map((content, i) => {
    const next = catalog[i + 1];
    return next ? { ...content, nextInSaga: entryOf(next, i + 1) } : content;
  });
}
