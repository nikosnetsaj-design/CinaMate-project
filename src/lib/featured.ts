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

/**
 * La vetrina, in ordine di urgenza: il primo è quello che si vede aprendo
 * l'app, gli altri si raggiungono scorrendo.
 *
 * Sono pochi di proposito. Una vetrina che scorre all'infinito è una riga di
 * copertine travestita da proposta, e la promessa qui è l'opposto: poche cose,
 * ognuna con il suo motivo.
 */
export function pickFeaturedList(
  items: Item[],
  upcoming: UpcomingEntry[],
  resuming: ResumeEntry[],
  max = 5,
): Featured[] {
  const owned = new Set(items.map((i) => i.id));
  const out: Featured[] = [];
  const taken = new Set<string>();

  const push = (entry: Featured) => {
    if (taken.has(entry.item.id) || out.length >= max) return;
    taken.add(entry.item.id);
    out.push(entry);
  };

  // 1. Le date che arrivano, fra i titoli che segui.
  for (const entry of upcoming) {
    if (owned.has(entry.item.id)) push({ item: entry.item, line: fromUpcoming(entry), resumeSec: 0 });
  }

  // 2. Quello che hai lasciato a metà, dal più recente.
  for (const entry of resuming) {
    push({ item: entry.item, line: fromResume(entry), resumeSec: entry.positionSec });
  }

  // 3. Un preferito mai visto, poi gli ultimi arrivati: in entrambi i casi la
  //    riga dice cos'è, perché non c'è nient'altro di vero da dire.
  for (const item of items.filter((i) => i.fav && i.status === "Da vedere")) {
    push({ item, line: "Preferito, ancora da vedere", resumeSec: 0 });
  }
  for (const item of [...items].sort((a, b) => b.added.localeCompare(a.added))) {
    push({ item, line: "Ultimo arrivato in libreria", resumeSec: 0 });
  }

  return out;
}
