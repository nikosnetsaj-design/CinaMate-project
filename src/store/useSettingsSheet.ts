import { create } from "zustand";

interface SettingsSheetState {
  isOpen: boolean;
  /**
   * Il pannello su cui aprirsi, quando chi apre sa già dove vuole andare —
   * «Gestisci Link Host» dal menu in cima, per esempio. `null` è l'elenco.
   *
   * Sta qui e non dentro il foglio perché è chi apre a saperlo, e obbligare
   * l'utente a ritrovare a mano la voce che ha appena toccato è il modo più
   * semplice per rendere inutile una scorciatoia.
   */
  panel: string | null;
  open: (panel?: string) => void;
  close: () => void;
}

export const useSettingsSheet = create<SettingsSheetState>((set) => ({
  isOpen: false,
  panel: null,
  open: (panel) => set({ isOpen: true, panel: panel ?? null }),
  close: () => set({ isOpen: false, panel: null }),
}));
