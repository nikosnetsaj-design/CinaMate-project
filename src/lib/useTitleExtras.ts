import { useEffect, useState } from "react";
import { useSettings } from "../store/useSettings";
import { getTitleExtras, type TmdbTitleExtras } from "./tmdb";
import type { Item } from "../types";

export interface TitleExtrasState {
  extras: TmdbTitleExtras | null;
  /** Vero finché la risposta non è arrivata: serve a mostrare i segnaposto. */
  loading: boolean;
  /** Vero quando TMDB non è collegato o la chiamata è fallita: si mostra niente. */
  missing: boolean;
}

/**
 * Il resto della scheda — troupe, soldi, studi, immagini, correlati.
 *
 * Come `useTitleLogo`, non tocca il record della libreria: sono dati di
 * contorno che si ricavano dall'id TMDB in qualsiasi momento, e metterli dentro
 * `Item` vorrebbe dire farli viaggiare nell'esporta/importa e gonfiare il
 * `localStorage` con sedici percorsi di locandine per ogni titolo.
 *
 * Più riquadri della stessa scheda lo chiamano insieme; la richiesta è una
 * sola perché `getTitleExtras` tiene in cache la promessa, non solo il
 * risultato.
 */
export function useTitleExtras(item: Item): TitleExtrasState {
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const [extras, setExtras] = useState<TmdbTitleExtras | null>(null);
  const [failed, setFailed] = useState(false);

  const linked = tmdbApiKey && item.tmdbId != null && item.tmdbMediaType != null;

  useEffect(() => {
    setExtras(null);
    setFailed(false);
    if (!tmdbApiKey || item.tmdbId == null || item.tmdbMediaType == null) return;

    let cancelled = false;
    getTitleExtras(item.tmdbId, item.tmdbMediaType, tmdbApiKey)
      .then((r) => {
        if (!cancelled) setExtras(r);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [item.tmdbId, item.tmdbMediaType, tmdbApiKey]);

  return { extras, loading: Boolean(linked) && !extras && !failed, missing: !linked || failed };
}
