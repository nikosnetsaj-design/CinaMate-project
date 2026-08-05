import { create } from "zustand";
import type { TmdbSearchResult } from "../lib/tmdb";

/**
 * Il titolo che stai *guardando* senza averlo ancora salvato.
 *
 * Serve uno store perché la scheda di anteprima si apre da tre posti diversi —
 * la pagina Cerca, la riga dei simili dentro una scheda, i cataloghi di Scopri
 * — e in due di quelli il foglio deve comparire sopra a un altro foglio già
 * aperto. Passarsi lo stato di mano in mano avrebbe voluto dire tre copie della
 * stessa anteprima.
 */
interface TitlePreviewState {
  result: TmdbSearchResult | null;
  open: (result: TmdbSearchResult) => void;
  close: () => void;
}

export const useTitlePreview = create<TitlePreviewState>((set) => ({
  result: null,
  open: (result) => set({ result }),
  close: () => set({ result: null }),
}));
