import { useState } from "react";
import { useSettings } from "../store/useSettings";
import { useEditSheet } from "../store/useEditSheet";
import { useLibrary } from "../store/useLibrary";
import { draftFromTmdb } from "./addFromTmdb";
import type { Kind } from "../types";

export interface CatalogTitle {
  tmdbId: number;
  mediaType: "movie" | "tv";
  kind: Kind;
  title: string;
  year: number | null;
  posterPath: string | null;
}

/**
 * «Questo non ce l'ho»: da una locandina del catalogo al foglio di aggiunta
 * già compilato.
 *
 * È lo stesso gesto in tre punti diversi — la filmografia di una persona, la
 * fila dei correlati, la linea della saga — e ripeterlo a mano ogni volta
 * significava tre versioni leggermente diverse dello stesso errore. Il foglio
 * si apre *compilato* invece di aggiungere di nascosto: mettere qualcosa in
 * libreria è una decisione, e prima si vuole vedere cosa si sta prendendo.
 */
export function useAddFromCatalog(onOpened?: () => void) {
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const openNew = useEditSheet((s) => s.openNew);
  const pushToast = useLibrary((s) => s.pushToast);
  /** L'id in corso, per far girare la rotellina solo sulla carta toccata. */
  const [adding, setAdding] = useState<number | null>(null);

  async function add(title: CatalogTitle) {
    if (!tmdbApiKey) {
      pushToast("error", "Serve la chiave TMDB nelle Impostazioni per aggiungere dal catalogo.");
      return;
    }
    setAdding(title.tmdbId);
    try {
      openNew(
        await draftFromTmdb(title.tmdbId, title.mediaType, title.kind, tmdbApiKey, {
          title: title.title,
          year: title.year,
          posterPath: title.posterPath,
        }),
      );
      onOpened?.();
    } catch {
      pushToast("error", "Non è stato possibile leggere questo titolo da TMDB.");
    }
    setAdding(null);
  }

  return { add, adding };
}
