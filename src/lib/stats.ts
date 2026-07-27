import { MOVIES } from "../data/movies";
import type { DiaryEntry, Genre } from "../types";

export interface LibraryStats {
  totalWatched: number;
  totalMinutes: number;
  thisMonthWatched: number;
  avgRating: number;
  favoriteGenre: Genre | null;
}

export function computeStats(diary: DiaryEntry[]): LibraryStats {
  const totalWatched = diary.length;
  const totalMinutes = diary.reduce(
    (sum, d) => sum + (MOVIES.find((m) => m.id === d.movieId)?.runtime ?? 0),
    0,
  );
  const avgRating = totalWatched ? diary.reduce((s, d) => s + d.rating, 0) / totalWatched : 0;

  const now = new Date();
  const thisMonthWatched = diary.filter((d) => {
    const dt = new Date(d.watchedAt);
    return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth();
  }).length;

  const genreCounts = new Map<Genre, number>();
  for (const entry of diary) {
    const movie = MOVIES.find((m) => m.id === entry.movieId);
    movie?.genres.forEach((g) => genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1));
  }
  let favoriteGenre: Genre | null = null;
  let max = 0;
  genreCounts.forEach((count, genre) => {
    if (count > max) {
      max = count;
      favoriteGenre = genre;
    }
  });

  return { totalWatched, totalMinutes, thisMonthWatched, avgRating, favoriteGenre };
}

export function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return "Ancora sveglio";
  if (hour < 13) return "Buongiorno";
  if (hour < 18) return "Buon pomeriggio";
  return "Buonasera";
}
