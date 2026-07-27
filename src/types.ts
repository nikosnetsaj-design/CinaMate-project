export type Genre =
  | "Dramma"
  | "Commedia"
  | "Thriller"
  | "Fantascienza"
  | "Animazione"
  | "Documentario"
  | "Horror"
  | "Romantico"
  | "Noir"
  | "Azione";

export type PosterTone = "gold" | "rust" | "teal" | "ink";

export interface Movie {
  id: string;
  title: string;
  originalTitle?: string;
  year: number;
  director: string;
  country: string;
  runtime: number;
  genres: Genre[];
  synopsis: string;
  cast: string[];
  tone: PosterTone;
}

export interface WatchlistEntry {
  movieId: string;
  addedAt: string;
}

export interface DiaryEntry {
  movieId: string;
  watchedAt: string;
  rating: number;
  note?: string;
}

export type ToastKind = "success" | "error" | "info";

export interface ToastMessage {
  id: string;
  kind: ToastKind;
  text: string;
}
