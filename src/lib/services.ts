import type { Item } from "../types";
import type { TmdbWatchProvider } from "./tmdb";

/**
 * Quale abbonamento conviene, dalla tua lista «Da vedere».
 *
 * Si conta su quale servizio stanno i titoli che vuoi vedere, nel tuo paese,
 * e quanti ce ne sono *solo* lì — il numero che decide se un abbonamento in
 * più vale la pena. La combinazione che copre di più si sceglie un servizio
 * alla volta: prima quello con più titoli, poi quello che ne aggiunge di più
 * fra quelli rimasti. Ogni proposta dice il conto da cui viene.
 *
 * Le varianti dello stesso servizio — «con pubblicità», il canale dentro
 * Amazon o Apple — contano come un servizio solo: sono modi diversi di
 * pagare la stessa cosa, e separate dividerebbero i conti.
 */

export interface Availability {
  item: Item;
  streaming: TmdbWatchProvider[];
  free: TmdbWatchProvider[];
}

export interface Service {
  key: string;
  name: string;
  logoPath: string | null;
}

export interface ServiceSummary {
  service: Service;
  items: Item[];
  /** Quanti titoli della lista stanno solo qui. */
  only: number;
}

export function serviceKey(name: string): string {
  return name
    .replace(/\s+(standard|basic|premium)?\s*with ads$/i, "")
    .replace(/\s+(amazon|apple tv)\s+channel$/i, "")
    .replace(/\s+channel$/i, "")
    .trim()
    .toLowerCase();
}

function toService(p: TmdbWatchProvider): Service {
  const name = p.name
    .replace(/\s+(standard|basic|premium)?\s*with ads$/i, "")
    .replace(/\s+(amazon|apple tv)\s+channel$/i, "")
    .replace(/\s+channel$/i, "")
    .trim();
  return { key: serviceKey(p.name), name, logoPath: p.logoPath };
}

/** I servizi in abbonamento di un titolo, senza doppioni di variante. */
export function servicesOf(av: Availability): Service[] {
  const seen = new Map<string, Service>();
  for (const p of av.streaming) {
    const s = toService(p);
    if (!seen.has(s.key)) seen.set(s.key, s);
  }
  return [...seen.values()];
}

export function summarize(list: Availability[]): ServiceSummary[] {
  const byKey = new Map<string, { service: Service; items: Item[] }>();
  const where = new Map<string, number>();
  for (const av of list) {
    const services = servicesOf(av);
    where.set(av.item.id, services.length);
    for (const s of services) {
      const entry = byKey.get(s.key) ?? { service: s, items: [] };
      entry.items.push(av.item);
      byKey.set(s.key, entry);
    }
  }
  return [...byKey.values()]
    .map(({ service, items }) => ({ service, items, only: items.filter((i) => where.get(i.id) === 1).length }))
    .sort((a, b) => b.items.length - a.items.length || b.only - a.only || a.service.name.localeCompare(b.service.name));
}

export interface Combo {
  steps: { service: Service; adds: number; total: number }[];
}

/**
 * La combinazione che copre di più, un servizio alla volta. Si ferma quando
 * il prossimo non aggiungerebbe niente, o dopo `max` servizi: oltre il terzo
 * abbonamento il consiglio smette di essere un consiglio.
 */
export function bestCombo(list: Availability[], max = 3): Combo {
  const remaining = new Map(list.map((av) => [av.item.id, new Set(servicesOf(av).map((s) => s.key))]));
  const services = new Map(list.flatMap((av) => servicesOf(av).map((s) => [s.key, s] as const)));
  const steps: Combo["steps"] = [];
  let total = 0;
  while (steps.length < max) {
    let best: { key: string; adds: number } | null = null;
    for (const key of services.keys()) {
      if (steps.some((s) => s.service.key === key)) continue;
      let adds = 0;
      for (const set of remaining.values()) if (set.has(key)) adds++;
      if (adds > 0 && (!best || adds > best.adds || (adds === best.adds && key < best.key))) best = { key, adds };
    }
    if (!best) break;
    total += best.adds;
    steps.push({ service: services.get(best.key) as Service, adds: best.adds, total });
    for (const [id, set] of remaining) if (set.has(best.key)) remaining.delete(id);
  }
  return { steps };
}

/** I titoli che si guardano con quello che paghi già (o gratis). */
export function onMine(list: Availability[], mine: Set<string>): Item[] {
  return list.filter((av) => av.free.length > 0 || servicesOf(av).some((s) => mine.has(s.key))).map((av) => av.item);
}

/** Regioni offerte nella scelta del paese: dove JustWatch, quindi TMDB, ha dati. */
export const REGIONS = [
  "IT", "CH", "SM", "FR", "DE", "AT", "ES", "PT", "GB", "IE", "BE", "NL", "LU", "SE", "NO", "DK", "FI",
  "PL", "CZ", "GR", "RO", "HR", "SI", "US", "CA", "MX", "BR", "AR", "AU", "NZ", "JP", "KR", "IN", "TR",
];
