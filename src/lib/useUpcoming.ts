import { useEffect, useState } from "react";
import { useLibrary } from "../store/useLibrary";
import { useSettings } from "../store/useSettings";
import { loadUpcoming, trackedKey, type UpcomingEntry } from "./upcoming";

/**
 * Le uscite che stai aspettando, disponibili a chiunque sulla Home.
 *
 * Tre punti dell'app fanno ormai la stessa domanda — la riga "In arrivo", la
 * vetrina in cima e le pastiglie sulle copertine — e ognuno la faceva a modo
 * suo. Le risposte vengono comunque da una cache per titolo dentro
 * `upcoming.ts` (sei ore), quindi il costo vero è uno solo: qui si condivide il
 * codice, non il traffico.
 */
export function useUpcoming(): UpcomingEntry[] {
  const items = useLibrary((s) => s.items);
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const [upcoming, setUpcoming] = useState<UpcomingEntry[]>([]);

  // Dipende dai titoli seguiti, non dall'identità dell'array: una modifica
  // qualunque della libreria non deve far ripartire la ricognizione.
  const key = trackedKey(items);

  useEffect(() => {
    let cancelled = false;
    void loadUpcoming(useLibrary.getState().items, tmdbApiKey).then((list) => {
      if (!cancelled) setUpcoming(list);
    });
    return () => {
      cancelled = true;
    };
  }, [tmdbApiKey, key]);

  return upcoming;
}

/** Le uscite indicizzate per titolo — come le legge una pastiglia su una copertina. */
export function byItemId(entries: UpcomingEntry[]): Record<string, UpcomingEntry> {
  const map: Record<string, UpcomingEntry> = {};
  for (const entry of entries) {
    // Il primo vince: `loadUpcoming` restituisce la lista in ordine di data, e
    // di un titolo interessa la prossima uscita, non l'ultima.
    if (!map[entry.item.id]) map[entry.item.id] = entry;
  }
  return map;
}
