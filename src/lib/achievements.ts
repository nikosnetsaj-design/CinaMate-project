import type { HistoryEntry, Item } from "../types";
import { computeMinutes } from "./stats";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  earned: boolean;
  progress: string;
}

export function computeAchievements(items: Item[], history: HistoryEntry[]): Achievement[] {
  const totalHours = items.reduce((a, i) => a + computeMinutes(i), 0) / 60;
  const genres = new Set(items.filter((i) => i.status === "Visto" && i.genre).map((i) => i.genre));
  const animeWatched = items.filter((i) => i.kind === "anime" && i.status === "Visto").length;
  const maxRewatch = items.reduce((a, i) => Math.max(a, i.rewatch || 0), 0);
  const voted = items.filter((i) => i.vote != null);
  const avgVote = voted.length ? voted.reduce((a, i) => a + (i.vote ?? 0), 0) / voted.length : 0;

  const episodesPerDay = new Map<string, number>();
  const liveItemIds = new Set(items.map((i) => i.id));
  for (const e of history) {
    if (e.action === "episode" && liveItemIds.has(e.itemId)) {
      episodesPerDay.set(e.date, (episodesPerDay.get(e.date) ?? 0) + (e.count ?? 1));
    }
  }
  const maxEpisodesPerDay = episodesPerDay.size ? Math.max(...episodesPerDay.values()) : 0;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const recentDays = new Set(
    history.filter((e) => e.date >= cutoffStr && liveItemIds.has(e.itemId)).map((e) => e.date),
  );

  return [
    {
      id: "maratoneta",
      title: "Maratoneta",
      description: "Guarda 5+ episodi nello stesso giorno",
      icon: "🔥",
      earned: maxEpisodesPerDay >= 5,
      progress: `${Math.min(maxEpisodesPerDay, 5)}/5`,
    },
    {
      id: "esploratore",
      title: "Esploratore di generi",
      description: "Guarda titoli di 6+ generi diversi",
      icon: "🧭",
      earned: genres.size >= 6,
      progress: `${Math.min(genres.size, 6)}/6`,
    },
    {
      id: "cinefilo",
      title: "Cinefilo instancabile",
      description: "Supera 100 ore totali davanti allo schermo",
      icon: "🎬",
      earned: totalHours >= 100,
      progress: `${Math.min(Math.round(totalHours), 100)}/100h`,
    },
    {
      id: "otaku",
      title: "Amante degli anime",
      description: "Guarda 5+ anime",
      icon: "⛩️",
      earned: animeWatched >= 5,
      progress: `${Math.min(animeWatched, 5)}/5`,
    },
    {
      id: "fedelissimo",
      title: "Fedelissimo",
      description: "Rivedi lo stesso titolo 3+ volte",
      icon: "💫",
      earned: maxRewatch >= 3,
      progress: `${Math.min(maxRewatch, 3)}/3`,
    },
    {
      id: "costante",
      title: "Costante",
      description: "Registra attività in 10+ giorni diversi negli ultimi 30",
      icon: "📆",
      earned: recentDays.size >= 10,
      progress: `${Math.min(recentDays.size, 10)}/10`,
    },
    {
      id: "critico",
      title: "Critico esigente",
      description: "Vota almeno 15 titoli con una media sotto 6",
      icon: "🧐",
      earned: voted.length >= 15 && avgVote < 6,
      progress: voted.length >= 15 ? `media ${avgVote.toFixed(1)}` : `${voted.length}/15`,
    },
  ];
}
