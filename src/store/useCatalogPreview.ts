import { create } from "zustand";
import type { Kind } from "../types";

/**
 * Il titolo del catalogo che stai guardando senza averlo in libreria.
 *
 * Esiste perché l'ordine era rovesciato: per leggere una trama, vedere il cast
 * o sapere dove si guarda bisognava prima *salvare* il titolo — cioè decidere
 * prima di avere in mano le cose su cui si decide. Chi cercava per curiosità si
 * ritrovava lo scaffale da riordinare.
 *
 * Tiene solo quel poco che il risultato di ricerca porta già con sé: il resto
 * lo chiede la scheda a TMDB, così l'intestazione compare subito invece di
 * aspettare la rete.
 */
export interface CatalogTarget {
  tmdbId: number;
  mediaType: "movie" | "tv";
  kind: Kind;
  title: string;
  year: number | null;
  posterPath: string | null;
}

interface CatalogPreviewState {
  target: CatalogTarget | null;
  open: (target: CatalogTarget) => void;
  close: () => void;
}

export const useCatalogPreview = create<CatalogPreviewState>((set) => ({
  target: null,
  open: (target) => set({ target }),
  close: () => set({ target: null }),
}));
