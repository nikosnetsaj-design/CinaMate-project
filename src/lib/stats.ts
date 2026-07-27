import type { HistoryEntry, Item, Kind, Status } from "../types";

export function computeMinutes(item: Item): number {
  if (!item.runtime) return 0;
  const base = item.kind === "film" ? (item.status === "Visto" ? item.runtime : 0) : (item.seen || 0) * item.runtime;
  return base * (1 + (item.rewatch || 0));
}

export interface LibraryStats {
  total: number;
  avgVote: number | null;
  minutes: number;
  hours: number;
  days: string;
  byStatus: Record<Status, number>;
  favs: number;
  byGenre: [string, number][];
  byPlatform: [string, number][];
  byKind: [Kind, number][];
  voteDist: { v: number; n: number }[];
  top: Item[];
}

export function computeStats(items: Item[]): LibraryStats {
  const voted = items.filter((i) => i.vote != null);
  const avgVote = voted.length ? voted.reduce((a, b) => a + (b.vote ?? 0), 0) / voted.length : null;
  const minutes = items.reduce((a, i) => a + computeMinutes(i), 0);

  const byStatus: Record<Status, number> = {
    "In visione": 0,
    Visto: 0,
    "Da vedere": 0,
    Abbandonato: 0,
    "In pausa": 0,
  };
  for (const i of items) byStatus[i.status]++;

  const genreCounts = new Map<string, number>();
  const platCounts = new Map<string, number>();
  const kindCounts = new Map<Kind, number>();
  for (const i of items) {
    if (i.genre) genreCounts.set(i.genre, (genreCounts.get(i.genre) ?? 0) + 1);
    platCounts.set(i.platform, (platCounts.get(i.platform) ?? 0) + 1);
    kindCounts.set(i.kind, (kindCounts.get(i.kind) ?? 0) + 1);
  }

  const voteDist = Array.from({ length: 10 }, (_, idx) => {
    const v = idx + 1;
    return { v, n: items.filter((i) => i.vote === v).length };
  });

  const top = voted
    .slice()
    .sort((a, b) => (b.vote ?? 0) - (a.vote ?? 0))
    .slice(0, 5);

  return {
    total: items.length,
    avgVote,
    minutes,
    hours: Math.round(minutes / 60),
    days: (minutes / 1440).toFixed(1),
    byStatus,
    favs: items.filter((i) => i.fav).length,
    byGenre: Array.from(genreCounts.entries()).sort((a, b) => b[1] - a[1]),
    byPlatform: Array.from(platCounts.entries()).sort((a, b) => b[1] - a[1]),
    byKind: Array.from(kindCounts.entries()),
    voteDist,
    top,
  };
}

export interface YearInReview {
  year: number;
  watchedCount: number;
  hours: number;
  topGenre: string | null;
  busiestMonth: string | null;
}

const MONTH_NAMES = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

export function computeYearInReview(items: Item[], history: HistoryEntry[], year: number): YearInReview {
  const yearHistory = history.filter((h) => h.date.startsWith(`${year}-`));
  const itemById = new Map(items.map((i) => [i.id, i]));
  let minutes = 0;
  const monthCounts = new Map<number, number>();
  const watchedItemIds = new Set<string>();

  for (const h of yearHistory) {
    const item = itemById.get(h.itemId);
    if (!item) continue;
    if (h.action === "watched") {
      watchedItemIds.add(h.itemId);
      if (item.kind === "film" || item.kind === "doc") minutes += item.runtime;
    } else if (h.action === "episode") {
      minutes += item.runtime * (h.count ?? 1);
    } else if (h.action === "rewatch" && (item.kind === "film" || item.kind === "doc")) {
      minutes += item.runtime;
    }
    const month = Number(h.date.slice(5, 7)) - 1;
    monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1);
  }

  const genreCounts = new Map<string, number>();
  for (const id of watchedItemIds) {
    const genre = itemById.get(id)?.genre;
    if (genre) genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
  }

  const topGenre = Array.from(genreCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const busiestMonthIdx = Array.from(monthCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];

  return {
    year,
    watchedCount: watchedItemIds.size,
    hours: Math.round(minutes / 60),
    topGenre,
    busiestMonth: busiestMonthIdx != null ? MONTH_NAMES[busiestMonthIdx] : null,
  };
}

export function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return "Ancora sveglio";
  if (hour < 13) return "Buongiorno";
  if (hour < 18) return "Buon pomeriggio";
  return "Buonasera";
}
