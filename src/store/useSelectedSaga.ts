import { create } from "zustand";
import type { SagaKey } from "./useSagas";

interface SelectedSagaState {
  /** `saga:<tmdbCollectionId>` or `universe:<id>`; null when the sheet is shut. */
  key: SagaKey | null;
  open: (key: SagaKey) => void;
  close: () => void;
}

export const useSelectedSaga = create<SelectedSagaState>((set) => ({
  key: null,
  open: (key) => set({ key }),
  close: () => set({ key: null }),
}));
