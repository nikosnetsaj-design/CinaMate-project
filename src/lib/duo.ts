import type { Item } from "../types";
import { rankShelf } from "./recommend";

/**
 * «Stasera in due»: due liste «Da vedere» che si incontrano.
 *
 * Quello che viaggia è il minimo: gli identificativi TMDB dei titoli, in
 * ordine di preferenza di chi manda. Niente nomi, niente voti, niente diario,
 * nemmeno i titoli scritti — il codice dice «questi film», non «questa
 * persona». L'ordine è l'unica cosa in più, ed è ciò che permette di mettere
 * in testa quello che piace a tutti e due invece di quello che piace a uno.
 *
 * Il formato è corto apposta, perché deve stare in un QR: `1.` per la
 * versione, poi una voce per titolo separata da un punto, `m` per i film e
 * `t` per le serie, l'id in base 36. Duecento titoli sono circa 1 KB.
 */

export interface DuoEntry {
  id: number;
  media: "movie" | "tv";
}

export const DUO_LIMIT = 200;
const VERSION = "1";

export function encodeDuo(entries: DuoEntry[]): string {
  return [VERSION, ...entries.slice(0, DUO_LIMIT).map((e) => `${e.media === "movie" ? "m" : "t"}${e.id.toString(36)}`)].join(".");
}

export function decodeDuo(code: string): DuoEntry[] | null {
  const [version, ...parts] = code.trim().split(".");
  if (version !== VERSION || parts.length === 0) return null;
  const out: DuoEntry[] = [];
  const seen = new Set<string>();
  for (const part of parts.slice(0, DUO_LIMIT)) {
    const media = part[0] === "m" ? "movie" : part[0] === "t" ? "tv" : null;
    const id = parseInt(part.slice(1), 36);
    if (!media || !Number.isInteger(id) || id <= 0 || !/^[0-9a-z]+$/.test(part.slice(1))) return null;
    const key = `${media}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id, media });
  }
  return out;
}

/** Un link intero, il solo frammento, o il codice nudo: quello che si incolla. */
export function readDuo(text: string): DuoEntry[] | null {
  const raw = text.trim();
  const match = raw.match(/due=([0-9a-z.]+)/i);
  return decodeDuo(match ? match[1] : raw);
}

/** La tua lista, nell'ordine del tuo palato: chi riceve vede cosa ti va di più. */
export function myDuoList(items: Item[]): Item[] {
  const candidates = items.filter((i) => i.status === "Da vedere" && i.tmdbId && i.tmdbMediaType);
  return rankShelf(items, candidates).map((r) => r.item);
}

export function duoEntries(list: Item[]): DuoEntry[] {
  return list.map((i) => ({ id: i.tmdbId as number, media: i.tmdbMediaType as "movie" | "tv" }));
}

export function duoUrl(list: Item[]): string {
  const url = new URL(import.meta.env.BASE_URL, window.location.origin);
  const base = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
  url.pathname = `${base}stasera-in-due`;
  url.hash = `due=${encodeDuo(duoEntries(list))}`;
  return url.toString();
}

export interface DuoMatch {
  item: Item;
  /** 0–100: quanto sta in alto in tutte e due le liste. */
  compat: number;
  reason: string;
}

/** 1 in cima alla lista, 0 in fondo. */
function standing(rank: number, length: number): number {
  return length <= 1 ? 1 : 1 - rank / (length - 1);
}

/**
 * I titoli in comune, dal più compatibile. La compatibilità è la media di
 * quanto il titolo sta in alto nelle due liste; a parità passa avanti quello
 * che almeno uno dei due vuole di più. Il motivo dice da dove viene: in cima
 * a entrambe, il tuo palato, o la lista dell'altra persona.
 */
export function intersect(mine: Item[], theirs: DuoEntry[], reasons: Map<string, string> = new Map()): DuoMatch[] {
  const theirRank = new Map(theirs.map((e, i) => [`${e.media}:${e.id}`, i]));
  const out: (DuoMatch & { best: number })[] = [];
  mine.forEach((item, myIndex) => {
    const r = theirRank.get(`${item.tmdbMediaType}:${item.tmdbId}`);
    if (r === undefined) return;
    const a = standing(myIndex, mine.length);
    const b = standing(r, theirs.length);
    const compat = Math.round(((a + b) / 2) * 100);
    const reason =
      a >= 0.75 && b >= 0.75
        ? "In cima a tutte e due le liste"
        : reasons.get(item.id) || (b > a ? "Più in alto nella sua lista che nella tua" : "Su tutte e due le liste");
    out.push({ item, compat, reason, best: Math.max(a, b) });
  });
  return out.sort((x, y) => y.compat - x.compat || y.best - x.best).map(({ item, compat, reason }) => ({ item, compat, reason }));
}

/**
 * La ruota: a caso, ma pesato sulla compatibilità — il primo esce più spesso
 * dell'ultimo, l'ultimo può uscire. `exclude` fa sì che «un altro» cambi
 * davvero, quando c'è altro.
 */
export function spin(matches: DuoMatch[], random: () => number = Math.random, exclude?: string): DuoMatch | null {
  const pool = matches.length > 1 && exclude ? matches.filter((m) => m.item.id !== exclude) : matches;
  if (pool.length === 0) return null;
  const weights = pool.map((m) => 1 + (m.compat / 100) ** 2 * 4);
  let r = random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r < 0) return pool[i];
  }
  return pool[pool.length - 1];
}
