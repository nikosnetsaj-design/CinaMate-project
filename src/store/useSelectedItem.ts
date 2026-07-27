import { create } from "zustand";
import type { Item } from "../types";

interface SelectedItemState {
  item: Item | null;
  open: (item: Item) => void;
  close: () => void;
}

export const useSelectedItem = create<SelectedItemState>((set) => ({
  item: null,
  open: (item) => set({ item }),
  close: () => set({ item: null }),
}));
