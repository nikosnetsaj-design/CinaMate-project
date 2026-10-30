import { create } from "zustand";
import type { HistoryEntry, Item, Status, ToastKind, ToastMessage } from "../types";
import { localDay } from "../lib/day";
import { normalizeHistoryEntry, normalizeItem, salvage } from "../lib/normalize";

const STORAGE_KEY = "cinemate:v2";
const HISTORY_KEY = "cinemate:history:v1";
/**
 * La copia del valore originale quando la lettura ha dovuto scartare qualcosa.
 * Esportata perché il banner la offre da scaricare: i dati sono tuoi anche
 * quando l'app non li sa leggere.
 */
export const RESCUE_KEY = "cinemate:v2:rescue";

/**
 * Cosa è andato storto leggendo la libreria all'avvio, se qualcosa è andato
 * storto. Prima c'era un solo stato, «non riesco a leggere», e un solo
 * rimedio, svuotare: un titolo malformato su trecento costava gli altri
 * duecentonovantanove, sovrascritti dalla prima modifica successiva.
 */
export interface LoadIssue {
  /** `unreadable`: il valore intero non è un elenco. `partial`: alcuni record sì e altri no. */
  kind: "unreadable" | "partial";
  /** I record scartati, per `partial`. */
  skipped: number;
  /** Se una copia del valore originale è stata messa da parte sotto `RESCUE_KEY`. */
  rescued: boolean;
}

/**
 * Mette da parte il valore originale, una volta sola: se una copia c'è già è
 * quella più vecchia, cioè la più vicina ai dati buoni, e non va sostituita.
 */
function keepRescue(raw: string): boolean {
  try {
    if (localStorage.getItem(RESCUE_KEY) !== null) return true;
    localStorage.setItem(RESCUE_KEY, JSON.stringify({ savedAt: new Date().toISOString(), raw }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Il valore originale, così com'era prima che l'app lo scartasse: la copia di
 * sicurezza se c'è, altrimenti la chiave stessa — che in quel caso nessuno ha
 * sovrascritto (vedi `protectOriginal`).
 */
export function readOriginalLibrary(): string | null {
  try {
    const rescue = localStorage.getItem(RESCUE_KEY);
    if (rescue !== null) {
      const parsed = JSON.parse(rescue) as { raw?: unknown };
      if (typeof parsed.raw === "string") return parsed.raw;
    }
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Vero quando la libreria salvata non si legge *e* non c'è stato posto per
 * una copia: allora la chiave originale è l'unico posto in cui quei dati
 * esistono, e nessuna scrittura deve toccarla finché non lo decidi tu.
 */
let protectOriginal = false;

function loadItems(): { data: Item[]; issue: LoadIssue | null } {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return { data: [], issue: null };
  }
  // A new library starts genuinely empty — no demo titles to delete first.
  if (raw === null) return { data: [], issue: null };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = undefined;
  }
  if (!Array.isArray(parsed)) {
    const rescued = keepRescue(raw);
    protectOriginal = !rescued;
    return { data: [], issue: { kind: "unreadable", skipped: 0, rescued } };
  }

  const { records, skipped } = salvage(parsed, normalizeItem);
  if (skipped === 0) return { data: records, issue: null };
  return { data: records, issue: { kind: "partial", skipped, rescued: keepRescue(raw) } };
}

function saveItems(items: Item[]): boolean {
  if (protectOriginal) return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

const initial = loadItems();

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Voce per voce, come la libreria: una voce storta non porta via il diario.
    return salvage(parsed, normalizeHistoryEntry).records;
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

function makeHistoryEntry(
  item: Pick<Item, "id" | "title" | "kind">,
  date: string,
  action: HistoryEntry["action"],
  count = 1,
  id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
): HistoryEntry {
  return {
    id,
    itemId: item.id,
    title: item.title,
    kind: item.kind,
    date,
    action,
    count,
  };
}

/** Il giorno di calendario locale: vedi `lib/day` per la storia di questa riga. */
function today(): string {
  return localDay();
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
  /** L'ultima scrittura è stata rifiutata: memoria piena o non disponibile. */
  storageError: boolean;
  /** Cosa la lettura all'avvio ha dovuto scartare. Vedi `LoadIssue`. */
  loadIssue: LoadIssue | null;
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
  /**
   * Titoli che arrivano da fuori — un export di Letterboxd o di IMDb — da
   * *unire* alla libreria invece di sostituirla, con le loro voci di diario.
   * Le voci del diario si riferiscono ai titoli per indice nell'elenco
   * passato, perché gli id li assegna lo store.
   */
  mergeImported: (
    incoming: Omit<Item, "id" | "added">[],
    updates: { id: string; patch: Partial<Item> }[],
    diary: { index?: number; itemId?: string; date: string; action: HistoryEntry["action"]; count?: number }[],
    addedDates?: (string | undefined)[],
  ) => { added: number; updated: number; logged: number; createdIds: string[]; saved: boolean };
  clearAll: () => void;
  resetCorruptedData: () => void;
  /** Butta la copia di sicurezza dopo che l'hai vista (o scaricata). */
  dismissLoadIssue: () => void;
}

/** L'identificativo di un record nuovo: il momento in cui è entrato, più caso. */
function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * L'identificativo di un record arrivato da un import.
 *
 * Diverso di proposito da `newId`: quello porta scritto l'istante in
 * millisecondi, e `repairUtcDay` (vedi `lib/day`) lo usa per correggere le
 * date scritte col giorno di Greenwich — cioè ogni data uguale al giorno UTC
 * di quell'istante. Una data importata non è stata calcolata adesso, ma
 * può coincidere col giorno UTC di adesso: importando a mezzanotte e mezza
 * la visione di ieri, la correzione la sposterebbe a oggi. Senza le tredici
 * cifre in testa la correzione non la tocca.
 */
function importId(): string {
  return `imp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function persistOrToast(
  get: () => LibraryState,
  set: (partial: Partial<LibraryState>) => void,
  next: Item[],
  successText?: string,
): boolean {
  const ok = saveItems(next);
  set({ items: next, storageError: !ok && !protectOriginal });
  if (!ok) {
    get().pushToast(
      "error",
      protectOriginal
        ? "Non salvo niente finché i dati che non riesco a leggere sono lì: scegli cosa farne nel riquadro in cima."
        : "Impossibile salvare: memoria del browser piena o non disponibile.",
    );
  } else if (successText) {
    get().pushToast("success", successText);
  }
  return ok;
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
  storageError: false,
  loadIssue: initial.issue,
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

  importData: (rawItems, rawHistory) => {
    // Ripassati anche qui: `parseBackup` li normalizza già, ma questo è il
    // punto in cui entrano nello store, e chi lo chiama domani potrebbe non
    // passare di là.
    const items = salvage(rawItems, normalizeItem).records;
    const history = salvage(rawHistory, normalizeHistoryEntry).records;
    // Un import è una scelta esplicita di sostituire: vale anche come
    // risposta ai dati illeggibili, che da qui in poi non vanno più protetti.
    protectOriginal = false;
    const okItems = saveItems(items);
    saveHistory(history);
    set({ items, history, storageError: !okItems, loadIssue: null });
    if (!okItems) {
      get().pushToast("error", "Impossibile salvare: memoria del browser piena o non disponibile.");
    } else {
      get().pushToast("success", `Libreria importata: ${items.length} titoli.`);
    }
  },

  mergeImported: (incoming, updates, diary, addedDates = []) => {
    const fallbackDay = today();
    const created: Item[] = incoming.map((data, index) => {
      const day = addedDates[index];
      return { ...data, id: importId(), added: day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : fallbackDay };
    });
    const patches = new Map(updates.map((u) => [u.id, u.patch]));
    const merged = [...created, ...get().items.map((i) => (patches.has(i.id) ? { ...i, ...patches.get(i.id) } : i))];
    const saved = persistOrToast(get, set, merged);

    const byIndex = (index: number | undefined) => (index === undefined ? undefined : created[index]);
    const byId = new Map(merged.map((i) => [i.id, i]));
    const entries: HistoryEntry[] = [];
    for (const d of diary) {
      const target = byIndex(d.index) ?? (d.itemId ? byId.get(d.itemId) : undefined);
      if (!target) continue;
      entries.push(makeHistoryEntry(target, d.date, d.action, d.count ?? 1, importId()));
    }
    // In ordine di data: il diario si legge così, e qualche vista (il Nastro)
    // assume che le voci siano già in fila.
    if (entries.length) {
      const next = [...get().history, ...entries].sort((a, b) => a.date.localeCompare(b.date));
      saveHistory(next);
      set({ history: next });
    }
    // Gli id nuovi, nell'ordine dell'elenco ricevuto: servono a chi deve
    // metterli in una lista subito dopo (le liste di Letterboxd).
    return { added: created.length, updated: updates.length, logged: entries.length, createdIds: created.map((i) => i.id), saved };
  },

  clearAll: () => {
    saveItems([]);
    saveHistory([]);
    set({ items: [], history: [], storageError: false, justCompleted: null });
    get().pushToast("info", "Libreria svuotata.");
  },

  resetCorruptedData: () => {
    protectOriginal = false;
    saveItems([]);
    saveHistory([]);
    set({ items: [], history: [], storageError: false, loadIssue: null, justCompleted: null });
    get().pushToast("info", "Dati locali ripristinati.");
  },

  dismissLoadIssue: () => {
    try {
      localStorage.removeItem(RESCUE_KEY);
    } catch {
      /* la copia resta: occupa spazio, non fa danni */
    }
    set({ loadIssue: null });
  },
}));
