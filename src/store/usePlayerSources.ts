import { create } from "zustand";
import { isRecord, readJson, writeJson } from "../lib/localStore";

const KEY = "cinemate:player-sources:v1";

/**
 * Everything the player needs about a title that the library itself cannot
 * know: subtitle files, where the intro and the credits are, and the sprite
 * sheet for timeline previews. A personal link ending in `.m3u8` is enough to
 * *play* a title (see player/fromLibrary.ts); this is what turns that into a
 * full viewing experience.
 *
 * Kept out of `Item` deliberately: the library record is what backup/restore
 * round-trips and what every page reads, and none of it needs any of this.
 */

export type MarkerType = "intro" | "recap" | "credits";

export interface PlayerSubtitle {
  id: string;
  language: string;
  label: string;
  url: string;
}

export interface PlayerMarker {
  type: MarkerType;
  startSec: number;
  endSec: number;
}

export interface PlayerSprite {
  url: string;
  /** Seconds between two tiles. */
  interval: number;
  columns: number;
  rows: number;
  tileWidth: number;
  tileHeight: number;
  count: number;
}

export interface PlayerSource {
  /**
   * Overrides the `.m3u8` personal link when set. Lets a title carry a source
   * without spending one of its two link slots on it.
   */
  manifestUrl?: string;
  subtitles: PlayerSubtitle[];
  markers: PlayerMarker[];
  sprite?: PlayerSprite;
}

export const EMPTY_SOURCE: PlayerSource = { subtitles: [], markers: [] };

type SourceMap = Record<string, PlayerSource>;

function isSource(value: unknown): value is PlayerSource {
  return isRecord(value) && Array.isArray(value.subtitles) && Array.isArray(value.markers);
}

function isSourceMap(value: unknown): value is SourceMap {
  return isRecord(value) && Object.values(value).every(isSource);
}

interface PlayerSourcesState {
  sources: SourceMap;
  get: (itemId: string) => PlayerSource;
  patch: (itemId: string, patch: Partial<PlayerSource>) => void;
  addSubtitle: (itemId: string, subtitle: Omit<PlayerSubtitle, "id">) => void;
  removeSubtitle: (itemId: string, subtitleId: string) => void;
  setMarker: (itemId: string, marker: PlayerMarker) => void;
  removeMarker: (itemId: string, type: MarkerType) => void;
  clear: (itemId: string) => void;
  /** Applies a map from a backup file, ignoring anything malformed. */
  restore: (value: unknown) => void;
}

function persist(sources: SourceMap): SourceMap {
  writeJson(KEY, sources);
  return sources;
}

export const usePlayerSources = create<PlayerSourcesState>((set, get) => ({
  sources: readJson<SourceMap>(KEY, isSourceMap, {}),

  get: (itemId) => get().sources[itemId] ?? EMPTY_SOURCE,

  patch: (itemId, patch) => {
    const current = get().sources[itemId] ?? EMPTY_SOURCE;
    set({ sources: persist({ ...get().sources, [itemId]: { ...current, ...patch } }) });
  },

  addSubtitle: (itemId, subtitle) => {
    const current = get().sources[itemId] ?? EMPTY_SOURCE;
    const entry: PlayerSubtitle = {
      ...subtitle,
      // The id doubles as the value the settings menu selects on, so it has to
      // stay stable for the lifetime of the track.
      id: `sub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    };
    get().patch(itemId, { subtitles: [...current.subtitles, entry] });
  },

  removeSubtitle: (itemId, subtitleId) => {
    const current = get().sources[itemId] ?? EMPTY_SOURCE;
    get().patch(itemId, { subtitles: current.subtitles.filter((s) => s.id !== subtitleId) });
  },

  setMarker: (itemId, marker) => {
    const current = get().sources[itemId] ?? EMPTY_SOURCE;
    // One marker per type: an episode has one intro, not several.
    const others = current.markers.filter((m) => m.type !== marker.type);
    get().patch(itemId, { markers: [...others, marker].sort((a, b) => a.startSec - b.startSec) });
  },

  removeMarker: (itemId, type) => {
    const current = get().sources[itemId] ?? EMPTY_SOURCE;
    get().patch(itemId, { markers: current.markers.filter((m) => m.type !== type) });
  },

  clear: (itemId) => {
    const next = { ...get().sources };
    delete next[itemId];
    set({ sources: persist(next) });
  },

  restore: (value) => {
    set({ sources: persist(isSourceMap(value) ? value : {}) });
  },
}));
