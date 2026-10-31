import { create } from "zustand";
import type { HistoryEntry, Item, Status, ToastKind, ToastMessage, WatchedEpisode } from "../types";
import { durable } from "../lib/durable";
import { applyImport, type Accepted, type ImportOutcome } from "../lib/importApply";
import {
  isEpisodic,
  isWatched,
  lastWatched,
  migrateWatched,
  nextEpisode,
  remapProvisional,
  resizeWatched,
  seasonLayout,
  upTo,
  watchedList,
  withEpisode,
  withoutEpisode,
  type EpisodeRef,
} from "../lib/episodes";

/*
 * La libreria e il diario stanno su IndexedDB (lib/durable), con una copia in
 * memoria caricata prima che l'app parta: le letture qui sotto restano
 * sincrone come quando stavano in localStorage, e da lì arrivano ancora se
 * IndexedDB non c'è.
 */

function isItemArray(value: unknown): value is Item[] {
  return (
    Array.isArray(value) &&
    value.every(
      (v) =>
        v && typeof v === "object" && typeof (v as Item).id === "string" && typeof (v as Item).title === "string",
    )
  );
}

function loadItems(): { data: Item[]; corrupted: boolean; absent: boolean } {
  const stored = durable.read("library");
  // A new library starts genuinely empty — no demo titles to delete first.
  if (stored === undefined) return { data: [], corrupted: false, absent: true };
  if (stored.corrupt || !isItemArray(stored.value)) return { data: [], corrupted: true, absent: false };
  return { data: stored.value, corrupted: false, absent: false };
}

function saveItems(items: Item[]): boolean {
  return durable.write("library", items);
}

const initial = loadItems();
if (initial.absent) saveItems(initial.data);

function isHistoryArray(value: unknown): value is HistoryEntry[] {
  return (
    Array.isArray(value) &&
    value.every((v) => v && typeof v === "object" && typeof (v as HistoryEntry).id === "string")
  );
}

function loadHistory(): { data: HistoryEntry[]; absent: boolean } {
  const stored = durable.read("history");
  if (stored === undefined) return { data: [], absent: true };
  if (stored.corrupt || !isHistoryArray(stored.value)) return { data: [], absent: false };
  return { data: stored.value, absent: false };
}

function saveHistory(history: HistoryEntry[]): void {
  // Non-critical derived data — a failure is not surfaced on its own, on top of
  // the main library's storageError.
  durable.write("history", history);
}

const loadedHistory = loadHistory();
const initialHistory = loadedHistory.data;
if (loadedHistory.absent) saveHistory(initialHistory);

/**
 * Dal contatore al registro, per i titoli scritti prima che esistesse.
 *
 * Gira al caricamento e su ogni importazione, e solo sui titoli a puntate che
 * non hanno ancora `watched`: una seconda passata non trova niente da fare.
 * Le date vengono dal diario (lib/episodes).
 */
export function migrateEpisodes(items: Item[], history: HistoryEntry[]): { items: Item[]; changed: boolean } {
  let changed = false;
  const next = items.map((item) => {
    if (!isEpisodic(item) || item.watched !== undefined) return item;
    changed = true;
    const watched = migrateWatched(item, history);
    return { ...item, watched, seen: watched.length };
  });
  return { items: next, changed };
}

const migratedInitial = initial.corrupted ? { items: initial.data, changed: false } : migrateEpisodes(initial.data, initialHistory);
if (migratedInitial.changed) saveItems(migratedInitial.items);

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
  /**
   * The data lives in a database that this launch could not open. Distinct
   * from `storageError`: nothing is corrupt and nothing must be reset — the
   * remedy is to reload, not to start over.
   */
  storageUnavailable: boolean;
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
  /** Tocco su un episodio: visto, o di nuovo da vedere. */
  toggleEpisode: (id: string, ref: EpisodeRef) => void;
  /** Pressione lunga: tutti gli episodi fino a questo, compreso. */
  markEpisodesUpTo: (id: string, ref: EpisodeRef) => void;
  /** Il lettore ha finito questa puntata: si segna, senza toggle. */
  markEpisodeWatched: (id: string, ref: EpisodeRef) => void;
  setRewatch: (id: string, rewatch: number) => void;

  pushToast: (kind: ToastKind, text: string) => void;
  dismissToast: (id: string) => void;
  clearJustCompleted: () => void;

  importData: (items: Item[], history: HistoryEntry[]) => void;
  /** I titoli scelti dall'importazione da un'altra app: aggiunti o completati, mai doppi. */
  importEntries: (accepted: Accepted[]) => Omit<ImportOutcome, "items" | "history">;
  /** Con chi e dove, sulle voci del diario indicate. Un campo vuoto si toglie. */
  annotateHistory: (ids: string[], note: { with: string; where: string }) => void;
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

/**
 * Un titolo con il registro nuovo: `seen` derivato, e lo stato che segue —
 * «Visto» quando l'ultimo episodio è segnato, di nuovo «In visione» quando se
 * ne toglie uno a una serie che era finita.
 */
function withWatched(item: Item, watched: WatchedEpisode[], grew: boolean): { item: Item; becameWatched: boolean } {
  const seen = watched.length;
  let status = item.status;
  if (item.episodes && seen >= item.episodes) status = "Visto";
  // Segnare un episodio vuol dire che la stai guardando, anche se era in
  // pausa; toglierne uno riapre solo una serie che risultava finita.
  else if (grew) status = "In visione";
  else if (item.status === "Visto") status = "In visione";
  return { item: { ...item, watched, seen, status }, becameWatched: status === "Visto" && item.status !== "Visto" };
}

/** I titoli a puntate nuovi entrano con il registro già scritto. */
function withInitialRegistry(item: Item): Item {
  if (!isEpisodic(item) || item.watched !== undefined) return item;
  const watched = migrateWatched(item, []);
  return { ...item, watched, seen: watched.length };
}

/**
 * Scrive un nuovo registro per un titolo, con le voci del diario per gli
 * episodi aggiunti. Le voci tolte non cancellano il diario: «l'ho segnato per
 * sbaglio» si corregge sul registro, il diario resta la storia di cosa è
 * successo.
 */
function commitWatched(
  get: () => LibraryState,
  set: (partial: Partial<LibraryState>) => void,
  id: string,
  compute: (item: Item) => WatchedEpisode[],
) {
  const prev = get().items.find((i) => i.id === id);
  if (!prev || !isEpisodic(prev)) return;
  const before = watchedList(prev);
  const after = compute(prev);
  const { item, becameWatched } = withWatched(prev, after, after.length > before.length);
  persistOrToast(get, set, get().items.map((i) => (i.id === id ? item : i)));

  const added = after.filter((w) => !before.some((b) => b.season === w.season && b.episode === w.episode));
  if (added.length > 0) {
    const entry = makeHistoryEntry(prev, today(), "episode", added.length);
    if (added.length === 1) {
      entry.season = added[0].season;
      entry.episode = added[0].episode;
    }
    const entries = [entry];
    if (becameWatched) entries.push(makeHistoryEntry(prev, today(), "watched"));
    logHistory(get, set, entries);
  }
  if (becameWatched) set({ justCompleted: { itemId: id, at: Date.now() } });
}

export const useLibrary = create<LibraryState>((set, get) => ({
  items: migratedInitial.items,
  history: initialHistory,
  toasts: [],
  storageError: initial.corrupted,
  storageUnavailable: durable.status().backend === "unavailable",
  justCompleted: null,

  addItem: (data) => {
    const item: Item = withInitialRegistry({ ...data, id: newId(), added: today() });
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
    const items: Item[] = list.map((data) => withInitialRegistry({ ...data, id: newId(), added }));
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
    const next = get().items.map((i) => {
      if (i.id !== id) return i;
      let merged: Item = { ...i, ...patch };
      if (isEpisodic(merged)) {
        // Chi parla ancora in totali — la casella «Ep. visti» del modulo —
        // scrive `seen`: il registro si allunga o si accorcia di conseguenza.
        if ("seen" in patch && !("watched" in patch) && patch.seen !== watchedList(i).length) {
          merged.watched = resizeWatched(merged, patch.seen ?? 0, today());
        }
        // La divisione in stagioni è arrivata: gli episodi provvisori vanno
        // al loro posto.
        const layout = seasonLayout(merged);
        if (layout && merged.watched?.some((w) => w.provisional)) {
          merged.watched = remapProvisional(merged.watched, layout);
        }
        if (merged.watched) merged = { ...merged, seen: merged.watched.length };
        // Il numero di puntate arriva dopo il registro — un titolo importato,
        // o collegato più tardi — e le hai già segnate tutte: è finita.
        if ("episodes" in patch && merged.status === "In visione" && merged.episodes && merged.seen >= merged.episodes) {
          merged = { ...merged, status: "Visto" };
        }
      }
      return merged;
    });
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
    commitWatched(get, set, id, (item) => {
      const ref = nextEpisode(item);
      return ref ? withEpisode(watchedList(item), ref, today()) : watchedList(item);
    });
  },

  decrementEpisode: (id) => {
    commitWatched(get, set, id, (item) => {
      const last = lastWatched(item);
      return last ? withoutEpisode(watchedList(item), last) : watchedList(item);
    });
  },

  setEpisodesSeen: (id, seen) => {
    // The slider is a primary way to record progress, so a jump forward has to
    // reach the diary as well — logged as one entry covering the whole delta.
    commitWatched(get, set, id, (item) => {
      const capped = item.episodes ? Math.min(item.episodes, seen) : seen;
      return resizeWatched(item, capped, today());
    });
  },

  toggleEpisode: (id, ref) => {
    commitWatched(get, set, id, (item) =>
      isWatched(item, ref) ? withoutEpisode(watchedList(item), ref) : withEpisode(watchedList(item), ref, today()),
    );
  },

  markEpisodesUpTo: (id, ref) => {
    commitWatched(get, set, id, (item) =>
      upTo(item, ref).reduce((list, r) => withEpisode(list, r, today()), watchedList(item)),
    );
  },

  markEpisodeWatched: (id, ref) => {
    commitWatched(get, set, id, (item) => withEpisode(watchedList(item), ref, today()));
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

  importData: (rawItems, history) => {
    // Un file scritto prima del registro degli episodi passa dalla stessa
    // migrazione del caricamento, con il diario che porta con sé.
    const items = migrateEpisodes(rawItems, history).items;
    const okItems = saveItems(items);
    saveHistory(history);
    set({ items, history, storageError: !okItems });
    if (!okItems) {
      get().pushToast("error", "Impossibile salvare: memoria del browser piena o non disponibile.");
    } else {
      get().pushToast("success", `Libreria importata: ${items.length} titoli.`);
    }
  },

  importEntries: (accepted) => {
    const { items, history, ...counts } = applyImport(get().items, get().history, accepted, { today: today(), newId });
    if (counts.added + counts.updated === 0) return counts;
    persistOrToast(get, set, items);
    saveHistory(history);
    set({ history });
    return counts;
  },

  annotateHistory: (ids, note) => {
    const targets = new Set(ids);
    const clean = { with: note.with.trim().slice(0, 80), where: note.where.trim().slice(0, 80) };
    const next = get().history.map((h) => {
      if (!targets.has(h.id)) return h;
      const { with: _w, where: _p, ...rest } = h;
      return { ...rest, ...(clean.with ? { with: clean.with } : {}), ...(clean.where ? { where: clean.where } : {}) };
    });
    saveHistory(next);
    set({ history: next });
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

/*
 * Una scrittura su disco che fallisce dopo — IndexedDB risponde in modo
 * asincrono — arriva qui, con lo stesso avviso di una scrittura sincrona
 * rifiutata. E una scrittura fatta in un'altra scheda aggiorna questa: prima,
 * con due schede aperte, l'ultima a salvare cancellava le aggiunte dell'altra.
 */
durable.onError(() => {
  useLibrary.setState({ storageError: true });
  useLibrary.getState().pushToast("error", "Impossibile salvare: memoria del browser piena o non disponibile.");
});
durable.subscribe((key) => {
  if (key === "library") {
    const next = loadItems();
    if (!next.corrupted) useLibrary.setState({ items: next.data });
  } else if (key === "history") {
    useLibrary.setState({ history: loadHistory().data });
  }
});
