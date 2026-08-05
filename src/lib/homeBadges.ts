import type { Item } from "../types";
import type { UpcomingEntry } from "./upcoming";
import { countdown, daysBetweenToday } from "./format";

/**
 * La pastiglia su una copertina: due parole che dicono perché quel titolo
 * merita uno sguardo *adesso*.
 *
 * Ne esce al massimo una per copertina, e solo quando ha qualcosa da dire. Una
 * riga di copertine tutte marchiate è una riga senza gerarchia — esattamente il
 * difetto che PRODUCT.md §2 attribuisce alla Home di Netflix — quindi le
 * condizioni qui sotto sono strette apposta: una data vera in arrivo, oppure un
 * titolo entrato in libreria da pochi giorni.
 */

export interface PosterBadge {
  /** La riga forte: "Nuova stagione", "Aggiunto di recente". */
  label: string;
  /** La riga di contorno: "prossimamente", "tra 3 giorni". */
  detail?: string;
}

/** Per quanti giorni un titolo appena inserito è ancora una novità. */
const RECENT_DAYS = 10;

/** Oltre questo orizzonte una data non è più un'attesa, è un promemoria. */
const HORIZON_DAYS = 120;

function fromUpcoming(entry: UpcomingEntry): PosterBadge | null {
  const days = daysBetweenToday(entry.date);
  if (days < 0 || days > HORIZON_DAYS) return null;
  const detail = countdown(entry.date);

  if (entry.type === "film") return { label: "In arrivo", detail };
  // Primo episodio di una stagione: è l'inizio di qualcosa, non la puntata di
  // giovedì. TMDB numera gli episodi dentro la stagione, quindi `episode === 1`
  // è esattamente la differenza fra le due cose.
  if (entry.episode === 1) return { label: "Nuova stagione", detail };
  return { label: "Nuovo episodio", detail };
}

export function badgeFor(item: Item, upcoming?: UpcomingEntry): PosterBadge | null {
  if (upcoming) {
    const badge = fromUpcoming(upcoming);
    if (badge) return badge;
  }
  const age = -daysBetweenToday(item.added);
  if (age >= 0 && age <= RECENT_DAYS) return { label: "Aggiunto di recente" };
  return null;
}
