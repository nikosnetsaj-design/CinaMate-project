import { create } from "zustand";

interface SettingsSheetState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useSettingsSheet = create<SettingsSheetState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
