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
}

export type ToastKind = "success" | "error" | "info";

export interface ToastMessage {
  id: string;
  kind: ToastKind;
  text: string;
}
