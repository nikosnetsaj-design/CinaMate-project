import type { HistoryEntry, Item } from "../types";
import { computeMinutes } from "./stats";
import { buildEntries, sagaProgress } from "./sagas";
import type { TmdbSaga } from "./tmdb";
import { t } from "./i18n";

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
  { id: "horror", title: t("achievements.esperto_di_horror"), icon: "🩸", needles: ["horror"], target: 15 },
  { id: "fantascienza", title: t("achievements.esperto_di_fantascienza"), icon: "🛸", needles: ["fantascienza", "science fiction"], target: 15 },
  { id: "commedia", title: t("achievements.esperto_di_commedia"), icon: "🎭", needles: ["commedia", "comedy"], target: 15 },
  { id: "thriller", title: t("achievements.esperto_di_thriller"), icon: "🔪", needles: ["thriller", "crime", "poliziesco"], target: 15 },
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
      title: t("achievements.cento_film"),
      description: t("achievements.completa_100_film"),
      icon: "💯",
      earned: filmsWatched >= 100,
      progress: `${Math.min(filmsWatched, 100)}/100`,
    },
    {
      id: "saga-completa",
      title: t("achievements.saga_completata"),
      description: t("achievements.guarda_ogni_capitolo_di"),
      icon: "🗝️",
      earned: completedSagas >= 1,
      progress: completedSagas >= 1 ? `${completedSagas} complete` : "0/1",
    },
    {
      id: "collezionista",
      title: t("achievements.collezionista_di_saghe"),
      description: t("achievements.completa_3_saghe_diverse"),
      icon: "🏛️",
      earned: completedSagas >= 3,
      progress: `${Math.min(completedSagas, 3)}/3`,
    },
    {
      id: "serie-finite",
      title: t("achievements.chi_ben_comincia_finisce"),
      description: t("achievements.porta_a_termine_10"),
      icon: "📺",
      earned: seriesFinished >= 10,
      progress: `${Math.min(seriesFinished, 10)}/10`,
    },
    ...GENRE_BADGES.map(({ id, title, icon, needles, target }) => {
      const n = countGenre(items, needles);
      return {
        id,
        title,
        description: t("achievements.guarda_titoli_del_genere", { v0: target }),
        icon,
        earned: n >= target,
        progress: `${Math.min(n, target)}/${target}`,
      };
    }),
    {
      id: "maratoneta",
      title: t("achievements.maratoneta"),
      description: t("achievements.guarda_5_episodi_nello"),
      icon: "🔥",
      earned: maxEpisodesPerDay >= 5,
      progress: `${Math.min(maxEpisodesPerDay, 5)}/5`,
    },
    {
      id: "esploratore",
      title: t("achievements.esploratore_di_generi"),
      description: t("achievements.guarda_titoli_di_6"),
      icon: "🧭",
      earned: genres.size >= 6,
      progress: `${Math.min(genres.size, 6)}/6`,
    },
    {
      id: "cinefilo",
      title: t("achievements.cinefilo_instancabile"),
      description: t("achievements.supera_100_ore_totali"),
      icon: "🎬",
      earned: totalHours >= 100,
      progress: `${Math.min(Math.round(totalHours), 100)}/100h`,
    },
    {
      id: "otaku",
      title: t("achievements.amante_degli_anime"),
      description: t("achievements.guarda_5_anime"),
      icon: "⛩️",
      earned: animeWatched >= 5,
      progress: `${Math.min(animeWatched, 5)}/5`,
    },
    {
      id: "fedelissimo",
      title: t("achievements.fedelissimo"),
      description: t("achievements.rivedi_lo_stesso_titolo"),
      icon: "💫",
      earned: maxRewatch >= 3,
      progress: `${Math.min(maxRewatch, 3)}/3`,
    },
    {
      id: "costante",
      title: t("achievements.costante"),
      description: t("achievements.registra_attivita_in_10"),
      icon: "📆",
      earned: recentDays.size >= 10,
      progress: `${Math.min(recentDays.size, 10)}/10`,
    },
    {
      id: "critico",
      title: t("achievements.critico_esigente"),
      description: t("achievements.vota_almeno_15_titoli"),
      icon: "🧐",
      earned: voted.length >= 15 && avgVote < 6,
      progress: voted.length >= 15 ? `media ${avgVote.toFixed(1)}` : `${voted.length}/15`,
    },
  ];
}
