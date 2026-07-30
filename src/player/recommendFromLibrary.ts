import type { Item } from "../types";
import { posterUrl } from "../lib/tmdb";
import type { MediaContent } from "./types";
import type { Recommendation } from "./services/recommendationService";

const MAX_RECOMMENDATIONS = 4;

/**
 * End-screen suggestions built from the shelf instead of from a recommendation
 * API. The player module ships a resolver that calls
 * `/api/content/:id/recommendations`; CineMate has no backend and doesn't want
 * one, and it already knows more about your taste than such an endpoint would.
 *
 * Follows the app's rule that every suggestion declares why it is there
 * (PRODUCT.md §7.2), so each one carries a one-line reason.
 */
export function recommendFromLibrary(
  content: MediaContent,
  items: Item[],
  playableIds: Set<string>,
): Recommendation[] {
  const current = items.find((i) => i.id === content.id);
  const others = items.filter((i) => i.id !== content.id);
  const picked = new Map<string, Recommendation>();

  const add = (item: Item, type: Recommendation["type"], reason: string) => {
    if (picked.size >= MAX_RECOMMENDATIONS || picked.has(item.id)) return;
    picked.set(item.id, {
      id: item.id,
      title: item.title,
      posterUrl: posterUrl(item.posterPath, "w342") ?? "",
      type,
      playable: playableIds.has(item.id),
      reason,
    });
  };

  // Playable titles come first throughout: an end screen whose every card is
  // inert is worse than a shorter one.
  const byPlayable = (a: Item, b: Item) =>
    Number(playableIds.has(b.id)) - Number(playableIds.has(a.id));

  // 1. The rest of the same saga, unfinished first — the strongest signal
  //    there is, and the reason sagas exist in this app.
  if (current?.collectionId != null) {
    const sameSaga = others
      .filter((i) => i.collectionId === current.collectionId)
      .sort((a, b) => Number(a.status === "Visto") - Number(b.status === "Visto") || byPlayable(a, b));
    for (const item of sameSaga) {
      add(item, "next_saga", current.collectionName ? `Da ${current.collectionName}` : "Dalla stessa saga");
    }
  }

  // 2. Titles this one's TMDB record names as similar and that you own.
  if (current?.similar.length) {
    const wanted = new Set(current.similar.map((t) => t.toLowerCase()));
    for (const item of others.filter((i) => wanted.has(i.title.toLowerCase())).sort(byPlayable)) {
      add(item, "similar", "Simile a quello che hai appena visto");
    }
  }

  // 3. Same director, which is how people actually pick a second film.
  if (current?.director) {
    for (const item of others.filter((i) => i.director === current.director).sort(byPlayable)) {
      add(item, "related", `Ancora ${current.director}`);
    }
  }

  // 4. Same genre, best-rated first — the generic tail, kept last.
  if (current?.genre) {
    const sameGenre = others
      .filter((i) => i.genre === current.genre && i.status !== "Visto")
      .sort((a, b) => byPlayable(a, b) || (b.vote ?? 0) - (a.vote ?? 0));
    for (const item of sameGenre) add(item, "related", `Ancora ${current.genre}`);
  }

  // 5. Nothing matched (a standalone title, or a library of one): fall back to
  //    whatever else is playable, so the end screen isn't a dead end.
  if (picked.size === 0) {
    for (const item of others.filter((i) => playableIds.has(i.id))) {
      add(item, "related", "Altro con una sorgente");
    }
  }

  return [...picked.values()];
}
