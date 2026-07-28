export type Kind = "film" | "serie" | "anime" | "doc";

export type Status = "In visione" | "Visto" | "Da vedere" | "Abbandonato" | "In pausa";

export const PLATFORMS = [
  "Netflix",
  "Prime Video",
  "Disney+",
  "Apple TV+",
  "Sky / NOW",
  "HBO Max",
  "Paramount+",
  "Crunchyroll",
  "MUBI",
  "RaiPlay",
  "Cinema",
  "Altro",
] as const;

export type Platform = (typeof PLATFORMS)[number];

export interface Item {
  id: string;
  title: string;
  kind: Kind;
  year: number;
  genre: string;
  status: Status;
  vote: number | null;
  platform: Platform;
  runtime: number;
  episodes: number | null;
  seen: number;
  seasons: number | null;
  fav: boolean;
  rewatch: number;
  overview: string;
  director: string;
  cast: string[];
  similar: string[];
  notes: string;
  added: string;
  tmdbId: number | null;
  tmdbMediaType: "movie" | "tv" | null;
  posterPath: string | null;
  trailerUrl: string | null;
  links: string[];
  /**
   * TMDB collection the title belongs to — what the app calls a *saga*. Absent
   * on records written before sagas existed, and `null` once a title has been
   * checked and turned out to be standalone: the two states are distinct so the
   * background linker knows what it still has to look at.
   */
  collectionId?: number | null;
  collectionName?: string | null;
}

export type ToastKind = "success" | "error" | "info";

export interface ToastMessage {
  id: string;
  kind: ToastKind;
  text: string;
}

export type HistoryAction = "watched" | "episode" | "rewatch";

export interface HistoryEntry {
  id: string;
  itemId: string;
  title: string;
  kind: Kind;
  date: string;
  action: HistoryAction;
  /**
   * Episodes covered by this entry. Lets a binge stay a single record instead
   * of one per episode, which matters for long-running series. Absent in
   * entries written before this field existed — always read it as `?? 1`.
   */
  count?: number;
}
