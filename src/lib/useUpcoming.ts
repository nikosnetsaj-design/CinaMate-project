import { useEffect, useState } from "react";
import { useLibrary } from "../store/useLibrary";
import { useSettings } from "../store/useSettings";
import { loadTitleDates, trackedKey, type TitleDates, type UpcomingEntry } from "./upcoming";
import { daysBetweenToday } from "./format";
import type { Item } from "../types";

/**
 * Le date dei titoli che segui: cosa sta per uscire e cosa è appena uscito.
 *
 * Tre punti dell'app fanno ormai la stessa domanda — la riga "In arrivo", la
 * vetrina in cima e le pastiglie sulle copertine — e ognuno la faceva a modo
 * suo. Le risposte vengono comunque da una cache per titolo dentro
 * `upcoming.ts` (sei ore), quindi il costo vero è uno solo: qui si condivide il
 * codice, non il traffico.
 */
export interface TitleDatesResult {
  /** Solo le uscite future, in ordine di data: la riga "In arrivo" e la vetrina. */
  upcoming: UpcomingEntry[];
  /** Tutte le date per titolo, passato compreso: le pastiglie sulle copertine. */
  byItem: Record<string, TitleDates>;
}

const EMPTY: TitleDatesResult = { upcoming: [], byItem: {} };

export function useUpcoming(): TitleDatesResult {
  const items = useLibrary((s) => s.items);
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const [result, setResult] = useState<TitleDatesResult>(EMPTY);

  // Dipende dai titoli seguiti, non dall'identità dell'array: una modifica
  // qualunque della libreria non deve far ripartire la ricognizione.
  const key = trackedKey(items);

  useEffect(() => {
    let cancelled = false;
    void loadTitleDates(useLibrary.getState().items, tmdbApiKey).then((dates) => {
      if (cancelled) return;
      const byId = new Map(useLibrary.getState().items.map((i) => [i.id, i] as const));
      const byItem: Record<string, TitleDates> = {};
      for (const entry of dates) byItem[entry.itemId] = entry;

      const upcoming = dates
        .flatMap((d): UpcomingEntry[] => {
          const item = byId.get(d.itemId);
          if (!item || !d.date || daysBetweenToday(d.date) < 0) return [];
          return [{ item, date: d.date, type: d.type, season: d.season, episode: d.episode }];
        })
        .sort((a, b) => a.date.localeCompare(b.date));

      setResult({ upcoming, byItem });
    });
    return () => {
      cancelled = true;
    };
  }, [tmdbApiKey, key]);

  return result;
}

/** Le pastiglie di una libreria intera, calcolate una volta per pagina. */
export function badgesFor(
  items: Item[],
  byItem: Record<string, TitleDates>,
  badgeFor: (item: Item, dates?: TitleDates) => { label: string; detail?: string } | null,
): Record<string, { label: string; detail?: string }> {
  const map: Record<string, { label: string; detail?: string }> = {};
  for (const item of items) {
    const badge = badgeFor(item, byItem[item.id]);
    if (badge) map[item.id] = badge;
  }
  return map;
}
