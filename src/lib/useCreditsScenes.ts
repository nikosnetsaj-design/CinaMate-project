import { useEffect, useState } from "react";
import { useSettings } from "../store/useSettings";
import { getCreditsScenes, type CreditsScenes } from "./tmdb";
import type { Item } from "../types";

/**
 * Le scene nei titoli di coda di un titolo della libreria, per il player.
 *
 * Una richiesta leggera e tenuta su disco per un giorno: il player la fa una
 * volta per titolo, mentre il film parte. `null` finché non si sa — senza
 * chiave, senza collegamento a TMDB, o se la risposta non è arrivata — e il
 * player in quel caso fa esattamente quello che faceva prima.
 */
export function useCreditsScenes(item: Item | null): CreditsScenes | null {
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const [scenes, setScenes] = useState<CreditsScenes | null>(null);
  const tmdbId = item?.tmdbId ?? null;
  const mediaType = item?.tmdbMediaType ?? null;

  useEffect(() => {
    setScenes(null);
    if (!tmdbApiKey || tmdbId == null || mediaType == null) return;
    let cancelled = false;
    getCreditsScenes(tmdbId, mediaType, tmdbApiKey)
      .then((s) => {
        if (!cancelled) setScenes(s.during || s.after ? s : null);
      })
      .catch(() => {
        /* un avviso in meno, non un errore da mostrare */
      });
    return () => {
      cancelled = true;
    };
  }, [tmdbApiKey, tmdbId, mediaType]);

  return scenes;
}
