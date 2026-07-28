import { create } from "zustand";

interface SelectedPersonState {
  /**
   * Names, not ids: the library stores cast and director as plain text, so the
   * only handle a poster or a detail sheet can offer is the name it printed.
   * The sheet resolves it against TMDB when it opens.
   */
  name: string | null;
  open: (name: string) => void;
  close: () => void;
}

export const useSelectedPerson = create<SelectedPersonState>((set) => ({
  name: null,
  open: (name) => set({ name }),
  close: () => set({ name: null }),
}));
