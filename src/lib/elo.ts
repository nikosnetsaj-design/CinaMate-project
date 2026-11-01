import type { Item } from "../types";
import { isEpisodic } from "./episodes";

/**
 * «Questo o quello»: una classifica personale da confronti a coppie.
 *
 * Il voto da 1 a 10 si dà un titolo alla volta, a mesi di distanza, e scivola:
 * il 7 di gennaio non è il 7 di ottobre. Un confronto chiede una cosa sola —
 * fra questi due, quale? — e a quella si risponde senza esitare. Con il
 * punteggio Elo, quello degli scacchi, tante risposte piccole diventano un
 * ordine.
 *
 * L'ordine poi serve a una cosa: far notare i voti che non gli somigliano.
 * Non li cambia. Propone, e il voto lo cambi tu con un tocco o lo lasci.
 */

export const START = 1000;

export interface Rating {
  elo: number;
  games: number;
}

export type Ratings = Record<string, Rating>;

export function expected(a: number, b: number): number {
  return 1 / (1 + 10 ** ((b - a) / 400));
}

/** Si muove molto all'inizio, poco quando la posizione è già confermata. */
export function kFactor(games: number): number {
  return games < 6 ? 40 : games < 15 ? 28 : 20;
}

export function ratingOf(ratings: Ratings, id: string): Rating {
  return ratings[id] ?? { elo: START, games: 0 };
}

/** `score`: 1 vince il primo, 0 il secondo, 0.5 pari. */
export function play(ratings: Ratings, a: string, b: string, score: 0 | 0.5 | 1): Ratings {
  const ra = ratingOf(ratings, a);
  const rb = ratingOf(ratings, b);
  const ea = expected(ra.elo, rb.elo);
  return {
    ...ratings,
    [a]: { elo: ra.elo + kFactor(ra.games) * (score - ea), games: ra.games + 1 },
    [b]: { elo: rb.elo + kFactor(rb.games) * (1 - score - (1 - ea)), games: rb.games + 1 },
  };
}

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** I titoli che si possono confrontare: quelli visti. */
export function duelPool(items: Item[]): Item[] {
  return items.filter((i) => i.status === "Visto");
}

/**
 * La prossima coppia. Il primo è quello con meno confronti — una classifica
 * vale quanto il suo titolo meno giudicato. Il secondo è quello con il
 * punteggio più vicino, dello stesso genere di cosa (film con film, serie con
 * serie, quando ce ne sono), fra quelli meno confrontati, e mai una coppia
 * appena vista. Finché i confronti sono pochi il voto dice quali titoli sono
 * vicini: è lì che una risposta insegna di più.
 */
export function pickPair(pool: Item[], ratings: Ratings, recent: string[], random: () => number = Math.random): [Item, Item] | null {
  if (pool.length < 2) return null;
  const jitter = new Map(pool.map((i) => [i.id, random()]));
  const first = [...pool].sort(
    (x, y) => ratingOf(ratings, x.id).games - ratingOf(ratings, y.id).games || (jitter.get(x.id) ?? 0) - (jitter.get(y.id) ?? 0),
  )[0];
  const family = (i: Item) => (isEpisodic(i) ? "serie" : "film");
  const others = pool.filter((i) => i.id !== first.id);
  const sameFamily = others.filter((i) => family(i) === family(first));
  const candidates = sameFamily.length > 0 ? sameFamily : others;
  const recentSet = new Set(recent);
  const a = ratingOf(ratings, first.id);
  const cost = (i: Item) => {
    const r = ratingOf(ratings, i.id);
    // Il voto aiuta finché i confronti sono pochi, poi lascia parlare loro.
    const trust = Math.max(0, 1 - (a.games + r.games) / 10);
    const voteGap = first.vote != null && i.vote != null ? Math.abs(first.vote - i.vote) * 25 * trust : 0;
    return (
      Math.abs(a.elo - r.elo) +
      voteGap +
      r.games * 30 +
      (recentSet.has(pairKey(first.id, i.id)) ? 400 : 0) +
      (jitter.get(i.id) ?? 0) * 60
    );
  };
  const second = candidates.reduce((best, i) => (cost(i) < cost(best) ? i : best));
  // A sinistra o a destra a caso: la posizione non deve suggerire niente.
  return random() < 0.5 ? [first, second] : [second, first];
}

export interface Ranked {
  item: Item;
  elo: number;
  games: number;
}

export function ranking(pool: Item[], ratings: Ratings, minGames = 2): Ranked[] {
  return pool
    .map((item) => ({ item, ...ratingOf(ratings, item.id) }))
    .filter((r) => r.games >= minGames)
    .sort((x, y) => y.elo - x.elo);
}

export interface Recalibration {
  item: Item;
  vote: number;
  suggested: number;
}

/** Quanti titoli votati e confrontati servono prima di dire qualcosa sui voti. */
export const CALIBRATION_MIN = 6;

/**
 * I voti che non somigliano ai confronti. L'ordine dei confronti riceve i
 * *tuoi* voti, ordinati: il primo prende il voto più alto che hai dato, e così
 * via. Così il suggerimento resta nella tua scala — chi non scende mai sotto
 * il 6 non si sente proporre un 3. Si segnala solo uno scarto di almeno due
 * punti, e non un titolo per cui hai già detto «lascia così» a quel voto.
 */
export function recalibrations(pool: Item[], ratings: Ratings, kept: Record<string, number> = {}, minGames = 3): Recalibration[] {
  const ranked = ranking(pool, ratings, minGames).filter((r) => r.item.vote != null);
  if (ranked.length < CALIBRATION_MIN) return [];
  const votes = ranked.map((r) => r.item.vote as number).sort((x, y) => y - x);
  return ranked
    .map((r, i) => ({ item: r.item, vote: r.item.vote as number, suggested: votes[i] }))
    .filter((r) => Math.abs(r.suggested - r.vote) >= 2 && kept[r.item.id] !== r.vote)
    .sort((x, y) => Math.abs(y.suggested - y.vote) - Math.abs(x.suggested - x.vote));
}
