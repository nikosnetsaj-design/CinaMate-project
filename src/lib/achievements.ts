import type { HistoryEntry, Item } from "../types";
import { computeMinutes } from "./stats";
import { buildEntries, sagaProgress } from "./sagas";
import type { TmdbSaga } from "./tmdb";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  earned: boolean;
  progress: string;
}

/**
 * Genre badges are one shape repeated, so they are declared as data. The match
 * is a substring because TMDB's Italian genre names vary in ways a badge should
 * not care about ("Fantascienza" vs "Science Fiction" on unlinked titles).
 */
const GENRE_BADGES: { id: string; title: string; icon: string; needles: string[]; target: number }[] = [
  { id: "horror", title: "Esperto di horror", icon: "🩸", needles: ["horror"], target: 15 },
  { id: "fantascienza", title: "Esperto di fantascienza", icon: "🛸", needles: ["fantascienza", "science fiction"], target: 15 },
  { id: "commedia", title: "Esperto di commedia", icon: "🎭", needles: ["commedia", "comedy"], target: 15 },
  { id: "thriller", title: "Esperto di thriller", icon: "🔪", needles: ["thriller", "crime", "poliziesco"], target: 15 },
];

function countGenre(items: Item[], needles: string[]): number {
  return items.filter(
    (i) => i.status === "Visto" && needles.some((n) => i.genre.toLowerCase().includes(n)),
  ).length;
}

export function computeAchievements(
  items: Item[],
  history: HistoryEntry[],
  sagas: Record<string, TmdbSaga> = {},
): Achievement[] {
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

  const filmsWatched = items.filter((i) => (i.kind === "film" || i.kind === "doc") && i.status === "Visto").length;
  const seriesFinished = items.filter((i) => (i.kind === "serie" || i.kind === "anime") && i.status === "Visto").length;

  // A saga counts as completed only when every chapter TMDB knows about is
  // watched — owning four of six Rocky films is not the same achievement.
  const ownedCollections = new Set(
    items.map((i) => i.collectionId).filter((id): id is number => typeof id === "number"),
  );
  const completedSagas = Array.from(ownedCollections)
    .map((id) => sagas[String(id)])
    .filter((saga) => !!saga)
    .filter((saga) => {
      const progress = sagaProgress(buildEntries(saga.parts, items));
      return progress.total > 1 && progress.watched === progress.total;
    }).length;

  return [
    {
      id: "centurione",
      title: "Cento film",
      description: "Completa 100 film",
      icon: "💯",
      earned: filmsWatched >= 100,
      progress: `${Math.min(filmsWatched, 100)}/100`,
    },
    {
      id: "saga-completa",
      title: "Saga completata",
      description: "Guarda ogni capitolo di una saga",
      icon: "🗝️",
      earned: completedSagas >= 1,
      progress: completedSagas >= 1 ? `${completedSagas} complete` : "0/1",
    },
    {
      id: "collezionista",
      title: "Collezionista di saghe",
      description: "Completa 3 saghe diverse",
      icon: "🏛️",
      earned: completedSagas >= 3,
      progress: `${Math.min(completedSagas, 3)}/3`,
    },
    {
      id: "serie-finite",
      title: "Chi ben comincia, finisce",
      description: "Porta a termine 10 serie",
      icon: "📺",
      earned: seriesFinished >= 10,
      progress: `${Math.min(seriesFinished, 10)}/10`,
    },
    ...GENRE_BADGES.map(({ id, title, icon, needles, target }) => {
      const n = countGenre(items, needles);
      return {
        id,
        title,
        description: `Guarda ${target} titoli del genere`,
        icon,
        earned: n >= target,
        progress: `${Math.min(n, target)}/${target}`,
      };
    }),
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
