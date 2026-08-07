import { create } from "zustand";
import { withViewTransition } from "../lib/viewTransition";
import type { Item } from "../types";

interface SelectedItemState {
  item: Item | null;
  open: (item: Item) => void;
  close: () => void;
}

/**
 * L'apertura e la chiusura passano da una transizione del browser: la scheda
 * entra in dissolvenza sopra la pagina invece di comparire di scatto. È
 * l'unico punto in cui serve saperlo — chi chiama `open` non cambia una riga.
 */
export const useSelectedItem = create<SelectedItemState>((set) => ({
  item: null,
  open: (item) => withViewTransition(() => set({ item })),
  close: () => withViewTransition(() => set({ item: null })),
}));
