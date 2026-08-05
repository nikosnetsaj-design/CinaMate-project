import { create } from "zustand";

/**
 * Chi è aperto nel Web Viewer, e per conto di quale titolo.
 *
 * Il contesto del titolo non è decorativo: è quello che permette al pulsante
 * «Usa questo flusso» di scrivere l'indirizzo trovato nella scheda giusta
 * invece di lasciartelo negli appunti.
 */

export interface ViewerContext {
  itemId: string;
  title: string;
}

interface WebViewerState {
  url: string | null;
  context: ViewerContext | null;
  open: (url: string, context?: ViewerContext) => void;
  close: () => void;
}

export const useWebViewer = create<WebViewerState>((set) => ({
  url: null,
  context: null,
  open: (url, context) => set({ url, context: context ?? null }),
  close: () => set({ url: null, context: null }),
}));
