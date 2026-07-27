import { create } from "zustand";
import { SEED } from "../data/seed";
import type { Item, Status, ToastKind, ToastMessage } from "../types";

const STORAGE_KEY = "cinemate:v2";

function isItemArray(value: unknown): value is Item[] {
  return (
    Array.isArray(value) &&
    value.every(
      (v) =>
        v && typeof v === "object" && typeof (v as Item).id === "string" && typeof (v as Item).title === "string",
    )
  );
}

function loadItems(): { data: Item[]; corrupted: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return { data: SEED, corrupted: false };
    const parsed: unknown = JSON.parse(raw);
    if (!isItemArray(parsed)) throw new Error("malformed cinemate library");
    return { data: parsed, corrupted: false };
  } catch {
    return { data: [], corrupted: true };
  }
}

function saveItems(items: Item[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

const initial = loadItems();
if (localStorage.getItem(STORAGE_KEY) === null && !initial.corrupted) {
  saveItems(initial.data);
}

interface LibraryState {
  items: Item[];
  toasts: ToastMessage[];
  storageError: boolean;

  addItem: (data: Omit<Item, "id" | "added">) => void;
  updateItem: (id: string, patch: Partial<Item>) => void;
  removeItem: (id: string) => void;
  setStatus: (id: string, status: Status) => void;
  toggleFav: (id: string) => void;
  incrementEpisode: (id: string) => void;
  decrementEpisode: (id: string) => void;
  setEpisodesSeen: (id: string, seen: number) => void;
  setRewatch: (id: string, rewatch: number) => void;

  pushToast: (kind: ToastKind, text: string) => void;
  dismissToast: (id: string) => void;

  resetCorruptedData: () => void;
}

function persistOrToast(
  get: () => LibraryState,
  set: (partial: Partial<LibraryState>) => void,
  next: Item[],
  successText?: string,
) {
  const ok = saveItems(next);
  set({ items: next, storageError: !ok });
  if (!ok) {
    get().pushToast("error", "Impossibile salvare: memoria del browser piena o non disponibile.");
  } else if (successText) {
    get().pushToast("success", successText);
  }
}

export const useLibrary = create<LibraryState>((set, get) => ({
  items: initial.data,
  toasts: [],
  storageError: initial.corrupted,

  addItem: (data) => {
    const item: Item = { ...data, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, added: new Date().toISOString().slice(0, 10) };
    persistOrToast(get, set, [item, ...get().items], `"${item.title}" aggiunto alla libreria.`);
  },

  updateItem: (id, patch) => {
    const next = get().items.map((i) => (i.id === id ? { ...i, ...patch } : i));
    persistOrToast(get, set, next);
  },

  removeItem: (id) => {
    const item = get().items.find((i) => i.id === id);
    const next = get().items.filter((i) => i.id !== id);
    persistOrToast(get, set, next, item ? `"${item.title}" rimosso dalla libreria.` : undefined);
  },

  setStatus: (id, status) => {
    const next = get().items.map((i) => (i.id === id ? { ...i, status } : i));
    persistOrToast(get, set, next);
  },

  toggleFav: (id) => {
    const next = get().items.map((i) => (i.id === id ? { ...i, fav: !i.fav } : i));
    persistOrToast(get, set, next);
  },

  incrementEpisode: (id) => {
    const next = get().items.map((i) => {
      if (i.id !== id || !i.episodes) return i;
      const seen = Math.min(i.episodes, (i.seen || 0) + 1);
      const status: Status = seen === i.episodes ? "Visto" : "In visione";
      return { ...i, seen, status };
    });
    persistOrToast(get, set, next);
  },

  decrementEpisode: (id) => {
    const next = get().items.map((i) => {
      if (i.id !== id) return i;
      const seen = Math.max(0, (i.seen || 0) - 1);
      const status: Status = i.status === "Visto" && seen < (i.episodes ?? 0) ? "In visione" : i.status;
      return { ...i, seen, status };
    });
    persistOrToast(get, set, next);
  },

  setEpisodesSeen: (id, seen) => {
    const next = get().items.map((i) => (i.id === id && i.episodes ? { ...i, seen: Math.max(0, Math.min(i.episodes, seen)) } : i));
    persistOrToast(get, set, next);
  },

  setRewatch: (id, rewatch) => {
    const next = get().items.map((i) => (i.id === id ? { ...i, rewatch: Math.max(0, rewatch) } : i));
    persistOrToast(get, set, next);
  },

  pushToast: (kind, text) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    set({ toasts: [...get().toasts, { id, kind, text }] });
    setTimeout(() => get().dismissToast(id), 4200);
  },
  dismissToast: (id) => {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },

  resetCorruptedData: () => {
    saveItems([]);
    set({ items: [], storageError: false });
    get().pushToast("info", "Dati locali ripristinati.");
  },
}));
