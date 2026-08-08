import { create } from "zustand";
import type { HistoryEntry, Item, Status, ToastKind, ToastMessage } from "../types";

const STORAGE_KEY = "cinemate:v2";
const HISTORY_KEY = "cinemate:history:v1";

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
    // A new library starts genuinely empty — no demo titles to delete first.
    if (raw === null) return { data: [], corrupted: false };
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

function isHistoryArray(value: unknown): value is HistoryEntry[] {
  return (
    Array.isArray(value) &&
    value.every((v) => v && typeof v === "object" && typeof (v as HistoryEntry).id === "string")
  );
}

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!isHistoryArray(parsed)) throw new Error("malformed cinemate history");
    return parsed;
  } catch {
    return [];
  }
}

function saveHistory(history: HistoryEntry[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Non-critical derived data — skip silently on quota errors rather than
    // surfacing another toast on top of the main library's own storageError.
  }
}

const initialHistory = loadHistory();
if (localStorage.getItem(HISTORY_KEY) === null) saveHistory(initialHistory);

function makeHistoryEntry(
  item: Pick<Item, "id" | "title" | "kind">,
  date: string,
  action: HistoryEntry["action"],
  count = 1,
): HistoryEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    itemId: item.id,
    title: item.title,
    kind: item.kind,
    date,
    action,
    count,
  };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Signal for "Continua la storia": whichever title just crossed into *Visto*,
 * with the moment it happened. Deliberately not persisted — the prompt belongs
 * to the session in which you finished something, not to the next launch.
 */
export interface JustCompleted {
  itemId: string;
  at: number;
}

interface LibraryState {
  items: Item[];
  history: HistoryEntry[];
  toasts: ToastMessage[];
  storageError: boolean;
  justCompleted: JustCompleted | null;

  addItem: (data: Omit<Item, "id" | "added">) => void;
  /** Un blocco di titoli come una sola azione: una scrittura, un messaggio. */
  addItems: (list: Omit<Item, "id" | "added">[]) => void;
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
  clearJustCompleted: () => void;

  importData: (items: Item[], history: HistoryEntry[]) => void;
  clearAll: () => void;
  resetCorruptedData: () => void;
}

/** L'identificativo di un record nuovo: il momento in cui è entrato, più caso. */
function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

function logHistory(get: () => LibraryState, set: (partial: Partial<LibraryState>) => void, entries: HistoryEntry[]) {
  if (entries.length === 0) return;
  const next = [...get().history, ...entries];
  saveHistory(next);
  set({ history: next });
}

export const useLibrary = create<LibraryState>((set, get) => ({
  items: initial.data,
  history: initialHistory,
  toasts: [],
  storageError: initial.corrupted,
  justCompleted: null,

  addItem: (data) => {
    const item: Item = { ...data, id: newId(), added: today() };
    persistOrToast(get, set, [item, ...get().items], `"${item.title}" aggiunto alla libreria.`);
    if (item.status === "Visto") logHistory(get, set, [makeHistoryEntry(item, item.added, "watched")]);
  },

  /**
   * Più titoli in una volta sola: una scrittura e una conferma.
   *
   * `addItem` chiamata in ciclo faceva N salvataggi su `localStorage` e N
   * messaggi impilati — con tre titoli scelti al primo avvio, tre pastiglie
   * che coprivano per intero la vetrina appena costruita. Un'aggiunta in
   * blocco *è* una sola azione, e va confermata una volta.
   */
  addItems: (list) => {
    if (list.length === 0) return;
    const added = today();
    const items: Item[] = list.map((data) => ({ ...data, id: newId(), added }));
    persistOrToast(
      get,
      set,
      [...items, ...get().items],
      list.length === 1
        ? `"${items[0].title}" aggiunto alla libreria.`
        : `${items.length} titoli aggiunti alla libreria.`,
    );
    logHistory(
      get,
      set,
      items.filter((i) => i.status === "Visto").map((i) => makeHistoryEntry(i, i.added, "watched")),
    );
  },

  updateItem: (id, patch) => {
    const prev = get().items.find((i) => i.id === id);
    const next = get().items.map((i) => (i.id === id ? { ...i, ...patch } : i));
    persistOrToast(get, set, next);
    // Editing the status to "Visto" completes a title just as surely as the
    // chip in the detail sheet does, so it has to reach the diary too.
    if (prev && prev.status !== "Visto" && patch.status === "Visto") {
      logHistory(get, set, [makeHistoryEntry(prev, today(), "watched")]);
      set({ justCompleted: { itemId: id, at: Date.now() } });
    }
  },

  removeItem: (id) => {
    const item = get().items.find((i) => i.id === id);
    const next = get().items.filter((i) => i.id !== id);
    persistOrToast(get, set, next, item ? `"${item.title}" rimosso dalla libreria.` : undefined);
    if (get().justCompleted?.itemId === id) set({ justCompleted: null });
    // Drop the item's history too, so deleted titles stop counting towards
    // achievements and the log doesn't grow with unreachable entries.
    const prunedHistory = get().history.filter((h) => h.itemId !== id);
    if (prunedHistory.length !== get().history.length) {
      saveHistory(prunedHistory);
      set({ history: prunedHistory });
    }
  },

  setStatus: (id, status) => {
    const prev = get().items.find((i) => i.id === id);
    const next = get().items.map((i) => (i.id === id ? { ...i, status } : i));
    persistOrToast(get, set, next);
    if (prev && prev.status !== "Visto" && status === "Visto") {
      logHistory(get, set, [makeHistoryEntry(prev, today(), "watched")]);
      set({ justCompleted: { itemId: id, at: Date.now() } });
    }
  },

  toggleFav: (id) => {
    const next = get().items.map((i) => (i.id === id ? { ...i, fav: !i.fav } : i));
    persistOrToast(get, set, next);
  },

  incrementEpisode: (id) => {
    const prev = get().items.find((i) => i.id === id);
    let becameWatched = false;
    const next = get().items.map((i) => {
      if (i.id !== id || !i.episodes) return i;
      const seen = Math.min(i.episodes, (i.seen || 0) + 1);
      const status: Status = seen === i.episodes ? "Visto" : "In visione";
      if (status === "Visto" && i.status !== "Visto") becameWatched = true;
      return { ...i, seen, status };
    });
    persistOrToast(get, set, next);
    if (prev && prev.episodes) {
      const entries = [makeHistoryEntry(prev, today(), "episode")];
      if (becameWatched) entries.push(makeHistoryEntry(prev, today(), "watched"));
      logHistory(get, set, entries);
    }
    if (becameWatched) set({ justCompleted: { itemId: id, at: Date.now() } });
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
    const prev = get().items.find((i) => i.id === id);
    const next = get().items.map((i) => (i.id === id && i.episodes ? { ...i, seen: Math.max(0, Math.min(i.episodes, seen)) } : i));
    persistOrToast(get, set, next);
    if (!prev?.episodes) return;
    // The slider is a primary way to record progress, so a jump forward has to
    // reach the diary as well — logged as one entry covering the whole delta.
    const clamped = Math.max(0, Math.min(prev.episodes, seen));
    const delta = clamped - (prev.seen || 0);
    if (delta > 0) logHistory(get, set, [makeHistoryEntry(prev, today(), "episode", delta)]);
  },

  setRewatch: (id, rewatch) => {
    const prev = get().items.find((i) => i.id === id);
    const clamped = Math.max(0, rewatch);
    const next = get().items.map((i) => (i.id === id ? { ...i, rewatch: clamped } : i));
    persistOrToast(get, set, next);
    if (prev && clamped > prev.rewatch) logHistory(get, set, [makeHistoryEntry(prev, today(), "rewatch")]);
  },

  pushToast: (kind, text) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    set({ toasts: [...get().toasts, { id, kind, text }] });
    setTimeout(() => get().dismissToast(id), 4200);
  },
  dismissToast: (id) => {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
  clearJustCompleted: () => set({ justCompleted: null }),

  importData: (items, history) => {
    const okItems = saveItems(items);
    saveHistory(history);
    set({ items, history, storageError: !okItems });
    if (!okItems) {
      get().pushToast("error", "Impossibile salvare: memoria del browser piena o non disponibile.");
    } else {
      get().pushToast("success", `Libreria importata: ${items.length} titoli.`);
    }
  },

  clearAll: () => {
    saveItems([]);
    saveHistory([]);
    set({ items: [], history: [], storageError: false, justCompleted: null });
    get().pushToast("info", "Libreria svuotata.");
  },

  resetCorruptedData: () => {
    saveItems([]);
    saveHistory([]);
    set({ items: [], history: [], storageError: false, justCompleted: null });
    get().pushToast("info", "Dati locali ripristinati.");
  },
}));
