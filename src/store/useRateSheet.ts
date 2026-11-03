import { create } from "zustand";

/**
 * Il foglio del voto: quale titolo si sta votando.
 *
 * Tiene solo l'id — il titolo vero lo si rilegge dalla libreria, così il foglio
 * vede sempre lo stato attuale (anche se nel frattempo è cambiato lo stato o
 * il voto da un'altra parte).
 */
interface RateSheetState {
  itemId: string | null;
  open: (itemId: string) => void;
  close: () => void;
}

export const useRateSheet = create<RateSheetState>((set) => ({
  itemId: null,
  open: (itemId) => set({ itemId }),
  close: () => set({ itemId: null }),
}));
