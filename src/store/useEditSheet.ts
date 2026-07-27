import { create } from "zustand";
import type { Item } from "../types";
import { blankDraft, draftFromItem, type ItemDraft } from "../lib/draft";

interface EditSheetState {
  isOpen: boolean;
  editingId: string | null;
  draft: ItemDraft;
  openNew: (partial?: Partial<ItemDraft>) => void;
  openEdit: (item: Item) => void;
  close: () => void;
  patch: (p: Partial<ItemDraft>) => void;
}

export const useEditSheet = create<EditSheetState>((set, get) => ({
  isOpen: false,
  editingId: null,
  draft: blankDraft(),
  openNew: (partial) => set({ isOpen: true, editingId: null, draft: { ...blankDraft(), ...partial } }),
  openEdit: (item) => set({ isOpen: true, editingId: item.id, draft: draftFromItem(item) }),
  close: () => set({ isOpen: false }),
  patch: (p) => set({ draft: { ...get().draft, ...p } }),
}));
