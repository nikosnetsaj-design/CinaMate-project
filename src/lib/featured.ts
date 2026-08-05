import type { Item } from "../types";
import type { UpcomingEntry } from "./upcoming";
import type { ResumeEntry } from "./continueWatching";
import { formatRuntime } from "./format";

/**
 * Il titolo della vetrina, e la riga che dice perché è lì.
 *
 * La vetrina è l'unico posto dell'app dove un titolo occupa mezzo schermo, e
 * quindi l'unico dove la scelta va motivata (regola di prodotto 2). L'ordine
 * qui sotto è una gerarchia di urgenze reali, non un punteggio: una data che
 * arriva batte una cosa lasciata a metà, che batte un titolo fermo lì da mesi.
 *
 * Volutamente *non* è una rotazione casuale: una vetrina che cambia a ogni
 * apertura insegna a ignorarla.
 */

export interface Featured {
  item: Item;
  /** "Gran finale: 26 agosto", "Restano 42 min" — sempre un fatto, mai uno slogan. */
  line: string;
  /** Da dove riprende il pulsante Riproduci: il secondo salvato, o 0. */
  resumeSec: number;
}

function dateWords(date: string): string {
  return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long" }).format(
    new Date(`${date}T00:00:00`),
  );
}

function fromUpcoming(entry: UpcomingEntry): string {
  const when = dateWords(entry.date);
  if (entry.type === "film") return `In uscita: ${when}`;
  if (entry.episode === 1) return `Nuova stagione: ${when}`;
  return entry.season != null && entry.episode != null
    ? `S${entry.season}E${entry.episode}: ${when}`
    : `Nuovo episodio: ${when}`;
}

function fromResume(entry: ResumeEntry): string {
  if (entry.hasPlayhead && entry.remainingMin > 0) {
    return `${entry.label} · restano ${formatRuntime(entry.remainingMin)}`;
  }
  if (entry.pct > 0) return `${entry.label} · ${entry.pct}% visto`;
  return entry.label;
}

export function pickFeatured(
  items: Item[],
  upcoming: UpcomingEntry[],
  resuming: ResumeEntry[],
): Featured | null {
  const owned = new Set(items.map((i) => i.id));

  // 1. La prima data che arriva, fra i titoli che segui.
  const next = upcoming.find((entry) => owned.has(entry.item.id));
  if (next) return { item: next.item, line: fromUpcoming(next), resumeSec: 0 };

  // 2. Quello che hai lasciato a metà più di recente.
  const [resume] = resuming;
  if (resume) return { item: resume.item, line: fromResume(resume), resumeSec: resume.positionSec };

  // 3. Un preferito mai visto, poi il più recente arrivato in libreria: in
  //    entrambi i casi la riga dice cos'è, perché non c'è nient'altro di vero
  //    da dire.
  const wanted = items.find((i) => i.fav && i.status === "Da vedere");
  const fallback = wanted ?? [...items].sort((a, b) => b.added.localeCompare(a.added))[0];
  if (!fallback) return null;
  return {
    item: fallback,
    line: wanted ? "Preferito, ancora da vedere" : "Ultimo arrivato in libreria",
    resumeSec: 0,
  };
}
