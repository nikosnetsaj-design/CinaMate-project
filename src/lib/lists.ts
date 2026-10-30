import type { Item } from "../types";
import { isRecord } from "./localStore";

/**
 * Una lista scelta da te: «Da vedere col partner», «Horror di ottobre».
 *
 * È la prima voce «Poi» della roadmap, e la ragione è scritta lì: una lista si
 * poteva condividere ma non conservare. Lo stato di un titolo risponde a «a
 * che punto sono», un genere a «che cos'è»; nessuno dei due risponde a «con
 * chi lo guardo» o «per quale sera». Quella domanda ha bisogno di un nome
 * scelto da chi la pone — è tutta qui la differenza fra una lista e un filtro.
 *
 * Una lista tiene gli *id* dei titoli, nell'ordine in cui li hai messi, e non
 * copie: un voto cambiato nella scheda è già cambiato anche lì. Un id di un
 * titolo che non c'è più resta dov'è e semplicemente non si mostra — così un
 * backup reimportato riporta i titoli al loro posto nella lista, e una
 * libreria che all'avvio non si legge non svuota le liste per riflesso.
 */
export interface UserList {
  id: string;
  name: string;
  itemIds: string[];
  /** `yyyy-mm-dd`, giorno locale. */
  createdAt: string;
  /** `yyyy-mm-dd`: l'ultima volta che è entrato o uscito un titolo. */
  updatedAt: string;
}

/** Il nome più lungo che una riga di lista mostra senza andare a capo due volte. */
export const LIST_NAME_MAX = 60;

export function cleanListName(name: string): string {
  return name.replace(/\s+/g, " ").trim().slice(0, LIST_NAME_MAX);
}

export function isUserList(value: unknown): value is UserList {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    Array.isArray(value.itemIds) &&
    value.itemIds.every((id) => typeof id === "string")
  );
}

/**
 * Le liste di un file o di `localStorage`, una per una: una lista malformata
 * non porta via le altre, e gli id ripetuti dentro una lista si contano una
 * volta sola.
 */
export function readLists(value: unknown): UserList[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: UserList[] = [];
  for (const raw of value) {
    if (!isUserList(raw) || seen.has(raw.id)) continue;
    const name = cleanListName(raw.name);
    if (!name) continue;
    seen.add(raw.id);
    out.push({
      id: raw.id,
      name,
      itemIds: Array.from(new Set(raw.itemIds)),
      createdAt: typeof raw.createdAt === "string" ? raw.createdAt : "",
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "",
    });
  }
  return out;
}

/** I titoli di una lista, nel suo ordine, saltando quelli che non ci sono più. */
export function listItems(list: UserList, byId: Map<string, Item>): Item[] {
  const out: Item[] = [];
  for (const id of list.itemIds) {
    const item = byId.get(id);
    if (item) out.push(item);
  }
  return out;
}

/** Sposta un id di `delta` posti, fermandosi ai bordi. */
export function moveId(ids: string[], id: string, delta: number): string[] {
  const from = ids.indexOf(id);
  if (from === -1) return ids;
  const to = Math.max(0, Math.min(ids.length - 1, from + delta));
  if (to === from) return ids;
  const next = ids.slice();
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

/**
 * Chi è chi fra i titoli di una lista arrivata da un link e quelli che hai.
 *
 * Prima per id TMDB, che è certo; poi per titolo e anno, che è quasi certo;
 * poi per titolo soltanto, ma solo se sullo scaffale ce n'è uno solo con quel
 * nome — due «Dune» senza anno sono una domanda, non una risposta.
 */
export function matchSharedEntries(
  entries: { t: string; y?: number; i?: number; m?: "movie" | "tv" }[],
  items: Item[],
): (Item | null)[] {
  const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const byTmdb = new Map<string, Item>();
  const byTitleYear = new Map<string, Item>();
  const byTitle = new Map<string, Item[]>();
  for (const item of items) {
    if (item.tmdbId) byTmdb.set(`${item.tmdbMediaType ?? ""}:${item.tmdbId}`, item);
    byTitleYear.set(`${fold(item.title)}|${item.year}`, item);
    const key = fold(item.title);
    byTitle.set(key, [...(byTitle.get(key) ?? []), item]);
  }
  return entries.map((entry) => {
    if (entry.i) {
      const hit = byTmdb.get(`${entry.m ?? ""}:${entry.i}`) ?? (entry.m ? undefined : byTmdb.get(`movie:${entry.i}`) ?? byTmdb.get(`tv:${entry.i}`));
      if (hit) return hit;
    }
    const title = fold(entry.t);
    if (entry.y) {
      const hit = byTitleYear.get(`${title}|${entry.y}`);
      if (hit) return hit;
    }
    const sameName = byTitle.get(title) ?? [];
    return sameName.length === 1 && (!entry.y || !sameName[0].year) ? sameName[0] : null;
  });
}
