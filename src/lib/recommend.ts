import type { Item } from "../types";
import { computeMinutes } from "./stats";

/**
 * Every row on the Home page that is not a plain list obeys product rule 2:
 * a suggestion without a stated reason is advertising. So every function here
 * returns the reason alongside the title, and the reason is derived from the
 * same signal that produced the ranking — not written afterwards to fit.
 */
export interface Suggestion {
  item: Item;
  reason: string;
}

const WATCHED = new Set(["Visto", "In visione"]);

function names(value: string): string[] {
  return value
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
}

/**
 * A taste profile built only from titles you actually rated, weighted by how
 * far the vote sits from your own average rather than from an absolute middle.
 * Someone who rates generously and never goes below 7 would otherwise look
 * like they loved everything equally, and a profile that likes everything
 * recommends nothing.
 */
interface Taste {
  genres: Map<string, number>;
  directors: Map<string, number>;
  actors: Map<string, number>;
  studios: Map<string, number>;
  average: number;
}

function buildTaste(items: Item[]): Taste {
  const rated = items.filter((i) => i.vote != null);
  const average = rated.length ? rated.reduce((sum, i) => sum + (i.vote ?? 0), 0) / rated.length : 6;

  const taste: Taste = {
    genres: new Map(),
    directors: new Map(),
    actors: new Map(),
    studios: new Map(),
    average,
  };

  const bump = (map: Map<string, number>, key: string, weight: number) => {
    if (!key) return;
    map.set(key, (map.get(key) ?? 0) + weight);
  };

  for (const item of rated) {
    // Positive above your average, negative below: a genre you keep rating 4
    // should push its titles *down*, which a count-only profile can't express.
    const weight = (item.vote ?? 0) - average;
    if (weight === 0) continue;
    bump(taste.genres, item.genre, weight);
    bump(taste.studios, item.studio ?? "", weight * 0.5);
    for (const name of names(item.director)) bump(taste.directors, name, weight);
    // Cast is divided so a five-name list doesn't outweigh the one director.
    for (const name of item.cast) bump(taste.actors, name, weight / item.cast.length);
  }

  return taste;
}

/**
 * Suggestions from what you already own but haven't watched. Deliberately not
 * from the whole catalogue: this row answers "what do I watch tonight from the
 * shelf", and a row that recommends things you don't have is a shop.
 */
export function forYou(items: Item[], limit = 6): Suggestion[] {
  const taste = buildTaste(items);
  const candidates = items.filter((i) => i.status === "Da vedere" || i.status === "In pausa");

  const scored = candidates.map((item) => {
    // Each contribution is kept with its own label so the strongest one can
    // become the reason — the reason is the ranking, not a caption on it.
    const parts: { score: number; reason: string }[] = [];

    const genre = taste.genres.get(item.genre) ?? 0;
    if (genre > 0) parts.push({ score: genre, reason: `Perché voti alto i ${item.genre.toLowerCase()}` });

    for (const name of names(item.director)) {
      const score = taste.directors.get(name) ?? 0;
      if (score > 0) parts.push({ score: score * 1.5, reason: `Perché ti è piaciuto il cinema di ${name}` });
    }

    for (const name of item.cast) {
      const score = taste.actors.get(name) ?? 0;
      if (score > 0) parts.push({ score: score * 1.2, reason: `Con ${name}, che guardi spesso` });
    }

    const studio = item.studio ? taste.studios.get(item.studio) ?? 0 : 0;
    if (studio > 0) parts.push({ score: studio, reason: `Perché segui i film ${item.studio}` });

    // A saga you have already started outranks everything: the answer to "what
    // next" is usually sitting inside one, and it needs no taste model at all.
    const sagaStarted =
      item.collectionId != null &&
      items.some((other) => other.collectionId === item.collectionId && other.status === "Visto");
    if (sagaStarted) {
      parts.push({ score: 12, reason: `Il prossimo capitolo di ${item.collectionName ?? "una saga che hai iniziato"}` });
    }

    const total = parts.reduce((sum, p) => sum + p.score, 0);
    const best = parts.sort((a, b) => b.score - a.score)[0];
    return { item, total, reason: best?.reason ?? "" };
  });

  return scored
    .filter((entry) => entry.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
    .map(({ item, reason }) => ({ item, reason }));
}

/**
 * Quanto deve valere un legame per meritarsi la parola «simile».
 *
 * Il genere da solo vale 2 e non basta più: «stesso genere: horror» accostava
 * *Obsession* e *Noi* a *L'avvocato del diavolo* e a qualunque altro horror
 * dello scaffale, cioè diceva una cosa vera e inutile. Da qui in su servono un
 * regista in comune (6), un attore (4), una saga (10) — legami che spiegano
 * davvero perché due titoli stiano nella stessa frase.
 */
const SIMILAR_THRESHOLD = 4;

/**
 * Titoli del tuo scaffale che somigliano a questo, con detto *cosa* hanno in
 * comune. Diverso dai consigli di TMDB, che sono cose che non hai: questa lista
 * è "questi ce li hai già".
 */
export function similarInLibrary(item: Item, items: Item[], limit = 6): Suggestion[] {
  const directors = new Set(names(item.director));
  const cast = new Set(item.cast);

  const scored = items
    .filter((other) => other.id !== item.id)
    .map((other) => {
      const parts: { score: number; reason: string }[] = [];

      if (item.collectionId != null && other.collectionId === item.collectionId) {
        parts.push({ score: 10, reason: `Stessa saga: ${item.collectionName ?? "collezione"}` });
      }

      const sharedDirector = names(other.director).find((n) => directors.has(n));
      if (sharedDirector) parts.push({ score: 6, reason: `Anche questo è di ${sharedDirector}` });

      const sharedActor = other.cast.find((n) => cast.has(n));
      if (sharedActor) parts.push({ score: 4, reason: `Anche con ${sharedActor}` });

      // Genere e studio non fanno somiglianza da soli (restano sotto la
      // soglia): rafforzano un legame che c'è già.
      if (item.genre && other.genre === item.genre) {
        parts.push({ score: 2, reason: `Stesso genere: ${item.genre.toLowerCase()}` });
      }

      if (item.studio && other.studio === item.studio) {
        parts.push({ score: 2, reason: `Stesso studio: ${item.studio}` });
      }

      // Contemporaries only count once something else already connects them —
      // on its own, "uscito nello stesso decennio" is not a resemblance.
      if (parts.length > 0 && Math.abs(other.year - item.year) <= 5) {
        parts.push({ score: 1, reason: "" });
      }

      const total = parts.reduce((sum, p) => sum + p.score, 0);
      const best = parts.filter((p) => p.reason).sort((a, b) => b.score - a.score)[0];
      return { item: other, total, reason: best?.reason ?? "" };
    });

  return scored
    .filter((entry) => entry.total >= SIMILAR_THRESHOLD)
    .sort((a, b) => b.total - a.total || (b.item.vote ?? 0) - (a.item.vote ?? 0))
    .slice(0, limit)
    .map(({ item: found, reason }) => ({ item: found, reason }));
}

/**
 * "Più visti" counts *time*, not entries. A series you watched forty episodes
 * of is more watched than a film you saw twice, and ranking by rewatch count
 * alone would put the film first — which is why this reuses the same minute
 * calculation the statistics page shows.
 */
export function mostWatched(items: Item[], limit = 8): Suggestion[] {
  return items
    .filter((i) => WATCHED.has(i.status))
    .map((item) => ({ item, minutes: computeMinutes(item) }))
    .filter((entry) => entry.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, limit)
    .map(({ item, minutes }) => ({
      item,
      reason:
        (item.rewatch ?? 0) > 0
          ? `${Math.round(minutes / 60)}h · rivisto ${item.rewatch}×`
          : `${Math.round(minutes / 60)}h guardate`,
    }));
}

/**
 * "Perché hai guardato X": la riga che parte da un titolo preciso invece che
 * da un profilo di gusti.
 *
 * È la forma più onesta di consiglio che esista — il motivo è nel titolo della
 * riga, prima ancora di guardare le copertine — e per questo il seme non è il
 * titolo con il voto più alto ma l'ultimo finito davvero: è quello che hai in
 * testa adesso. Se dallo scaffale non emerge niente che gli somigli la riga non
 * esiste, invece di riempirsi col primo titolo dello stesso genere.
 */
export function becauseYouWatched(
  items: Item[],
  lastSeenByItem: Record<string, string>,
  limit = 8,
): { seed: Item; entries: Suggestion[] } | null {
  const finished = items
    .filter((i) => i.status === "Visto" && lastSeenByItem[i.id])
    .sort((a, b) => (lastSeenByItem[b.id] ?? "").localeCompare(lastSeenByItem[a.id] ?? ""));

  for (const seed of finished.slice(0, 5)) {
    // Solo roba che non hai già visto: "perché hai guardato" che ti riporta a
    // ciò che hai guardato è un cerchio, non un consiglio.
    const entries = similarInLibrary(seed, items, limit).filter((s) => s.item.status !== "Visto");
    if (entries.length >= 2) return { seed, entries };
  }
  return null;
}

/** Newest arrivals, by the date the record was written. */
export function recentlyAdded(items: Item[], limit = 8): Item[] {
  return [...items].sort((a, b) => b.added.localeCompare(a.added)).slice(0, limit);
}
