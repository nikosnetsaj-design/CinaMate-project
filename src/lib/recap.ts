import { compareEpisodes, episodeLabel, type EpisodeRef } from "./episodes";

/**
 * «Nelle puntate precedenti»: le regole del riassunto, senza rete.
 *
 * Il confine è un episodio preciso — l'ultimo del registro — e non un numero
 * di puntate: «ha visto 14 episodi» lascia al modello il conto di dove cada il
 * quattordicesimo, e un conto sbagliato è uno spoiler. Il prompt nomina la
 * stagione e l'episodio, e lo ripete come vincolo.
 *
 * Le sinossi ufficiali di TMDB, quando ci sono, ancorano il riassunto a fatti
 * invece che alla memoria del modello. Passano tutte da `withinBoundary`: una
 * sola sinossi oltre il confine nel prompt sarebbe uno spoiler consegnato a
 * mano, qualunque cosa dica il vincolo.
 */

export type RecapDetail = "breve" | "normale" | "dettagliato";

export const RECAP_DETAILS: { id: RecapDetail; label: string; words: number }[] = [
  { id: "breve", label: "Breve", words: 60 },
  { id: "normale", label: "Normale", words: 150 },
  { id: "dettagliato", label: "Dettagliato", words: 300 },
];

export interface EpisodeSynopsis extends EpisodeRef {
  title: string;
  overview: string;
}

/** Solo gli episodi fino al confine compreso, gli ultimi `limit`. */
export function withinBoundary<T extends EpisodeRef>(episodes: T[], last: EpisodeRef, limit = 12): T[] {
  return episodes
    .filter((e) => compareEpisodes(e, last) <= 0)
    .sort(compareEpisodes)
    .slice(-limit);
}

export interface RecapRequest {
  title: string;
  year: number | null;
  last: EpisodeRef;
  lastTitle: string | null;
  watchedCount: number;
  synopses: EpisodeSynopsis[];
  detail: RecapDetail;
}

export function recapPrompt(r: RecapRequest): { system: string; prompt: string } {
  const where = `stagione ${r.last.season}, episodio ${r.last.episode}${r.lastTitle ? ` («${r.lastTitle}»)` : ""}`;
  const words = RECAP_DETAILS.find((d) => d.id === r.detail)?.words ?? 150;
  const style =
    r.detail === "breve"
      ? "Poche frasi: dove sono i personaggi principali e qual è la questione aperta."
      : r.detail === "dettagliato"
        ? "Racconta gli archi dei personaggi principali e i fili aperti, con i fatti dell'ultima stagione vista in ordine."
        : "I fatti che servono per riprendere: chi sono, dove sono, cosa vogliono, cosa è appena successo.";

  const system = `Scrivi riassunti «Nelle puntate precedenti» per chi riprende una serie dopo una pausa. Il confine è assoluto: la storia finisce alla fine dell'episodio indicato. Niente di quello che accade dopo — né fatti, né accenni, né «presto scoprirà», né il tono di quello che verrà. Se non conosci la serie abbastanza da rispettare il confine, dillo in una riga invece di inventare.`;

  const synopses = withinBoundary(r.synopses, r.last)
    .filter((s) => s.overview.trim())
    .map((s) => `- ${episodeLabel(s)} «${s.title}»: ${s.overview.trim()}`)
    .join("\n");

  const prompt = `Serie: «${r.title}»${r.year ? ` (${r.year})` : ""}.
L'ultimo episodio visto è: ${where}. In tutto ha visto ${r.watchedCount} episodi.
${synopses ? `\nSinossi ufficiali degli episodi visti più di recente (fonte TMDB), tutte entro il confine:\n${synopses}\n` : ""}
Scrivi in italiano il riassunto di dove si trova la storia alla fine di ${where}. ${style} Al massimo ${words} parole, in prosa, senza titoli né elenchi.

Vincolo: non rivelare nulla che accada dopo ${where}.`;

  return { system, prompt };
}

// --- La memoria dei riassunti ------------------------------------------------

const CACHE_KEY = "cinemate:recaps:v1";
const CACHE_LIMIT = 40;

/**
 * Un riassunto costa credito dell'utente: si paga una volta per confine e
 * livello. Segnare un altro episodio sposta il confine, e la chiave con lui.
 */
export function recapKey(itemId: string, last: EpisodeRef, detail: RecapDetail): string {
  return `${itemId}|${last.season}x${last.episode}|${detail}`;
}

type Cache = Record<string, { text: string; at: number }>;

function readCache(): Cache {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Cache) : {};
  } catch {
    return {};
  }
}

export function cachedRecap(key: string): string | null {
  return readCache()[key]?.text ?? null;
}

export function storeRecap(key: string, text: string): void {
  const cache = readCache();
  cache[key] = { text, at: Date.now() };
  const kept = Object.entries(cache)
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, CACHE_LIMIT);
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(kept)));
  } catch {
    // Senza spazio si paga di nuovo la prossima volta: niente di peggio.
  }
}

const DETAIL_KEY = "cinemate:recap-detail";

export function savedDetail(): RecapDetail {
  try {
    const v = localStorage.getItem(DETAIL_KEY);
    return RECAP_DETAILS.some((d) => d.id === v) ? (v as RecapDetail) : "normale";
  } catch {
    return "normale";
  }
}

export function saveDetail(detail: RecapDetail): void {
  try {
    localStorage.setItem(DETAIL_KEY, detail);
  } catch {
    // preferenza di comodo
  }
}
