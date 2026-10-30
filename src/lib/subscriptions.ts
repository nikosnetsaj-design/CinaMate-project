import type { HistoryEntry, Item, Platform } from "../types";
import { localDay, localDaysAgo } from "./day";
import { isRecord } from "./localStore";

/**
 * «Quanto mi costa davvero Netflix?» — la domanda che nessun servizio ha
 * interesse a farti fare.
 *
 * Dichiari a cosa sei abbonato (e, se vuoi, quanto paghi); l'app ci fa tre
 * cose: nella scheda di un titolo ti dice se è già incluso in qualcosa che
 * paghi, in Scopri ti mostra cosa c'è di popolare *lì*, e in Tu ti dice quanto
 * hai guardato su ognuno nell'ultimo mese e quanto ti è costata ogni ora. È il
 * «contatore del valore degli abbonamenti» dell'analisi, e va nella direzione
 * opposta ai pattern che trattengono: serve anche a capire quale sospendere.
 *
 * I servizi sono identificati dall'id di TMDB/JustWatch, non dal nome: il nome
 * cambia coi piani («Netflix Standard with Ads»), l'id no.
 */

export interface Subscription {
  providerId: number;
  name: string;
  logoPath: string | null;
  /** Euro al mese, quando l'hai scritto. */
  monthly: number | null;
}

export function readSubscriptions(value: unknown): Subscription[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<number>();
  const out: Subscription[] = [];
  for (const v of value) {
    if (!isRecord(v)) continue;
    const id = v.providerId;
    const name = typeof v.name === "string" ? v.name.trim() : "";
    if (typeof id !== "number" || !Number.isInteger(id) || id <= 0 || !name || seen.has(id)) continue;
    seen.add(id);
    const monthly = typeof v.monthly === "number" && Number.isFinite(v.monthly) && v.monthly >= 0 ? Math.round(v.monthly * 100) / 100 : null;
    out.push({ providerId: id, name, logoPath: typeof v.logoPath === "string" ? v.logoPath : null, monthly });
  }
  return out;
}

/** «9,99», «9.99», «9,99 €», «€ 9» → 9.99. Vuoto o illeggibile → null. */
export function parsePrice(text: string): number | null {
  const clean = text.replace(/€|eur(o)?/gi, "").trim().replace(/\s+/g, "");
  if (!clean) return null;
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 && n < 1000 ? Math.round(n * 100) / 100 : null;
}

const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
export function formatEuro(value: number): string {
  return euro.format(value);
}

function normalize(name: string): string {
  return name.toLowerCase().replace(/\+/g, "plus").replace(/[^a-z0-9]/g, "");
}

/**
 * La piattaforma della libreria che corrisponde a un servizio di TMDB. Per
 * prefisso, perché i servizi arrivano con il piano attaccato al nome:
 * «Netflix Standard with Ads» è Netflix, «Amazon Prime Video with Ads» è
 * Prime Video.
 */
const PREFIXES: [string, Platform][] = [
  ["netflix", "Netflix"],
  ["amazonprimevideo", "Prime Video"],
  ["primevideo", "Prime Video"],
  ["disneyplus", "Disney+"],
  ["appletvplus", "Apple TV+"],
  ["appletv", "Apple TV+"],
  ["nowtv", "Sky / NOW"],
  ["now", "Sky / NOW"],
  ["skygo", "Sky / NOW"],
  ["hbomax", "HBO Max"],
  ["max", "HBO Max"],
  ["paramountplus", "Paramount+"],
  ["crunchyroll", "Crunchyroll"],
  ["mubi", "MUBI"],
  ["raiplay", "RaiPlay"],
];

export function platformOfProvider(name: string): Platform | null {
  const n = normalize(name);
  // «now» e «max» sono parole troppo corte per un prefisso: valgono solo intere.
  for (const [prefix, platform] of PREFIXES) {
    if (prefix === "now" || prefix === "max" ? n === prefix : n.startsWith(prefix)) return platform;
  }
  return null;
}

export interface SubscriptionValue {
  sub: Subscription;
  platform: Platform | null;
  /** Film e rivisioni, più gli episodi: quante cose hai guardato lì negli ultimi 30 giorni. */
  views: number;
  /** I minuti di quelle visioni, dalla durata dei titoli. */
  minutes: number;
  /** L'ultima voce del diario di un titolo su quel servizio, anche più vecchia di 30 giorni. */
  lastSeen: string | null;
  /** Euro per ora guardata, quando il prezzo è noto e l'ora non è zero. */
  perHour: number | null;
}

export const VALUE_WINDOW_DAYS = 30;

/**
 * Il conto, servizio per servizio. Una visione «è» di un servizio se il titolo
 * in libreria ha quella piattaforma: l'app non sa dove hai premuto play, sa
 * dove hai detto che sta il titolo — e lo dice, sotto il riquadro.
 */
export function subscriptionValues(
  subs: Subscription[],
  items: Item[],
  history: HistoryEntry[],
  today: string = localDay(),
): SubscriptionValue[] {
  const from = localDaysAgo(VALUE_WINDOW_DAYS - 1, new Date(`${today}T12:00:00`));
  const byId = new Map(items.map((i) => [i.id, i]));
  return subs.map((sub) => {
    const platform = platformOfProvider(sub.name);
    let views = 0;
    let minutes = 0;
    let lastSeen: string | null = null;
    if (platform) {
      for (const h of history) {
        const item = byId.get(h.itemId);
        if (!item || item.platform !== platform) continue;
        if (!lastSeen || h.date > lastSeen) lastSeen = h.date;
        if (h.date < from || h.date > today) continue;
        const count = h.action === "episode" ? (h.count ?? 1) : 1;
        views += count;
        minutes += count * (item.runtime || 0);
      }
    }
    const perHour = sub.monthly != null && minutes > 0 ? sub.monthly / (minutes / 60) : null;
    return { sub, platform, views, minutes, lastSeen, perHour };
  });
}
