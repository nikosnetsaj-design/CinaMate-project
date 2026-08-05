import { useEffect, useState } from "react";
import { useSettings } from "../store/useSettings";
import { getTitleLogo } from "./tmdb";
import type { Item } from "../types";

/**
 * Il logo disegnato del titolo, quando TMDB ce l'ha.
 *
 * Non finisce nel record della libreria di proposito: è un'immagine di
 * contorno, si ricava dall'id TMDB in ogni momento, e metterla dentro `Item`
 * avrebbe voluto dire farla viaggiare nell'esporta/importa e obbligare ogni
 * libreria esistente a un aggiornamento per una cosa che è già in rete. Sta in
 * una cache di modulo (vedi `getTitleLogo`), quindi la seconda apertura della
 * stessa scheda non chiede niente a nessuno.
 */
export function useTitleLogo(item: Item): string | null {
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const [logo, setLogo] = useState<string | null>(null);

  useEffect(() => {
    setLogo(null);
    if (!tmdbApiKey || item.tmdbId == null || item.tmdbMediaType == null) return;
    let cancelled = false;
    void getTitleLogo(item.tmdbId, item.tmdbMediaType, tmdbApiKey).then((path) => {
      if (!cancelled) setLogo(path);
    });
    return () => {
      cancelled = true;
    };
  }, [item.tmdbId, item.tmdbMediaType, tmdbApiKey]);

  return logo;
}
