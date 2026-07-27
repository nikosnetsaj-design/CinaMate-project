import { create } from "zustand";

interface AddSheetState {
  isOpen: boolean;
  prefillTitle: string;
  open: (prefillTitle?: string) => void;
  close: () => void;
}

export const useAddSheet = create<AddSheetState>((set) => ({
  isOpen: false,
  prefillTitle: "",
  open: (prefillTitle = "") => set({ isOpen: true, prefillTitle }),
  close: () => set({ isOpen: false, prefillTitle: "" }),
}));
