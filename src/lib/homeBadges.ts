import type { Item } from "../types";
import type { TitleDates } from "./upcoming";
import { countdown, daysBetweenToday } from "./format";

/**
 * La pastiglia su una copertina dice una cosa sola: che *adesso* è cambiato
 * qualcosa.
 *
 * La prima versione marchiava anche i titoli entrati in libreria da pochi
 * giorni, e questo è il difetto che l'ha resa inutile: aggiungere venti film in
 * una sera li marcava tutti «Aggiunto di recente» anche se erano usciti nel
 * 1972. Da quando li hai *archiviati* non interessa a nessuno; quello che
 * interessa è se una cosa sta per uscire o se è appena diventata disponibile.
 *
 * Quindi ora la pastiglia guarda solo le date del titolo:
 * — una data in avanti → sta per arrivare (film, stagione o episodio);
 * — una data indietro molto vicina → è appena arrivato;
 * — tutto il resto → nessuna pastiglia, che è il caso di quasi tutta la libreria
 *   ed è giusto che sia così: una riga tutta marchiata non ha gerarchia.
 */

export interface PosterBadge {
  /** La riga forte: "Nuova stagione", "Nuovo episodio". */
  label: string;
  /** La riga di contorno: "prossimamente", "tra 3 giorni", "disponibile". */
  detail?: string;
}

/** Oltre questo orizzonte una data non è un'attesa, è un promemoria. */
const HORIZON_DAYS = 120;

/**
 * Per quanti giorni una cosa uscita è ancora una novità. Una settimana e mezza
 * per un episodio — dopo è semplicemente l'ultimo episodio — e un mese per un
 * film, che di solito si guarda con più calma.
 */
const NEW_EPISODE_DAYS = 10;
const NEW_FILM_DAYS = 30;

function upcomingBadge(dates: TitleDates): PosterBadge | null {
  if (!dates.date) return null;
  const days = daysBetweenToday(dates.date);
  if (days < 0 || days > HORIZON_DAYS) return null;
  // "prossimamente" quando la data è lontana, il conto alla rovescia quando è
  // vicina: "tra 4 mesi" su una copertina è rumore, "domani" è una notizia.
  const detail = days > 30 ? "prossimamente" : countdown(dates.date);

  if (dates.type === "film") return { label: "Prossimamente", detail };
  // Primo episodio di una stagione: è l'inizio di qualcosa, non la puntata di
  // giovedì. TMDB numera gli episodi dentro la stagione, quindi `episode === 1`
  // è esattamente la differenza fra le due cose.
  if (dates.episode === 1) return { label: "Nuova stagione", detail };
  return { label: "Nuovo episodio", detail };
}

function arrivedBadge(item: Item, dates: TitleDates): PosterBadge | null {
  if (!dates.lastDate) return null;
  const ago = -daysBetweenToday(dates.lastDate);
  if (ago < 0) return null;

  if (dates.type === "film") {
    return ago <= NEW_FILM_DAYS ? { label: "Uscito da poco", detail: countdown(dates.lastDate) } : null;
  }

  if (ago > NEW_EPISODE_DAYS) return null;
  // Un episodio uscito da poco è una notizia solo se non l'hai già visto: su
  // una serie che hai finito sarebbe una pastiglia che ti dice quello che sai.
  const behind = item.episodes == null || (item.seen || 0) < item.episodes;
  return behind ? { label: "Nuovo episodio", detail: "disponibile" } : null;
}

export function badgeFor(item: Item, dates?: TitleDates): PosterBadge | null {
  if (!dates) return null;
  return upcomingBadge(dates) ?? arrivedBadge(item, dates);
}
