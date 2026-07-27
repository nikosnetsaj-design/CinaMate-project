import { create } from "zustand";
import { MOVIES } from "../data/movies";
import type { DiaryEntry, ToastKind, ToastMessage, WatchlistEntry } from "../types";

const STORAGE_KEY = "cinemate:v1";

interface PersistedState {
  watchlist: WatchlistEntry[];
  diary: DiaryEntry[];
}

function isPersistedState(value: unknown): value is PersistedState {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v.watchlist) && Array.isArray(v.diary);
}

function loadState(): { data: PersistedState; corrupted: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { data: { watchlist: [], diary: [] }, corrupted: false };
    const parsed: unknown = JSON.parse(raw);
    if (!isPersistedState(parsed)) throw new Error("malformed cinemate state");
    return { data: parsed, corrupted: false };
  } catch {
    return { data: { watchlist: [], diary: [] }, corrupted: true };
  }
}

function saveState(data: PersistedState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

const initial = loadState();

interface LibraryState {
  watchlist: WatchlistEntry[];
  diary: DiaryEntry[];
  toasts: ToastMessage[];
  storageError: boolean;

  isInWatchlist: (movieId: string) => boolean;
  getDiaryEntry: (movieId: string) => DiaryEntry | undefined;
  isWatched: (movieId: string) => boolean;

  toggleWatchlist: (movieId: string) => void;
  markWatched: (movieId: string, rating: number, note?: string) => void;
  removeDiaryEntry: (movieId: string) => void;

  pushToast: (kind: ToastKind, text: string) => void;
  dismissToast: (id: string) => void;

  resetCorruptedData: () => void;
}

function persistOrToast(
  get: () => LibraryState,
  set: (partial: Partial<LibraryState>) => void,
  next: PersistedState,
  successText?: string,
) {
  const ok = saveState(next);
  set({ watchlist: next.watchlist, diary: next.diary, storageError: !ok });
  if (!ok) {
    get().pushToast(
      "error",
      "Impossibile salvare le modifiche: memoria del browser piena o non disponibile.",
    );
  } else if (successText) {
    get().pushToast("success", successText);
  }
}

export const useLibrary = create<LibraryState>((set, get) => ({
  watchlist: initial.data.watchlist,
  diary: initial.data.diary,
  toasts: [],
  storageError: initial.corrupted,

  isInWatchlist: (movieId) => get().watchlist.some((w) => w.movieId === movieId),
  getDiaryEntry: (movieId) => get().diary.find((d) => d.movieId === movieId),
  isWatched: (movieId) => get().diary.some((d) => d.movieId === movieId),

  toggleWatchlist: (movieId) => {
    const movie = MOVIES.find((m) => m.id === movieId);
    const title = movie?.title ?? "Film";
    if (get().isWatched(movieId)) {
      get().pushToast("info", `"${title}" è già nel tuo diario.`);
      return;
    }
    const inList = get().isInWatchlist(movieId);
    const nextWatchlist = inList
      ? get().watchlist.filter((w) => w.movieId !== movieId)
      : [...get().watchlist, { movieId, addedAt: new Date().toISOString() }];
    persistOrToast(
      get,
      set,
      { watchlist: nextWatchlist, diary: get().diary },
      inList ? `"${title}" rimosso dalla watchlist.` : `"${title}" aggiunto alla watchlist.`,
    );
  },

  markWatched: (movieId, rating, note) => {
    const movie = MOVIES.find((m) => m.id === movieId);
    const title = movie?.title ?? "Film";
    const existing = get().getDiaryEntry(movieId);
    const entry: DiaryEntry = {
      movieId,
      watchedAt: existing?.watchedAt ?? new Date().toISOString(),
      rating,
      note: note?.trim() || undefined,
    };
    const nextDiary = [entry, ...get().diary.filter((d) => d.movieId !== movieId)];
    const nextWatchlist = get().watchlist.filter((w) => w.movieId !== movieId);
    persistOrToast(
      get,
      set,
      { watchlist: nextWatchlist, diary: nextDiary },
      existing ? `Valutazione di "${title}" aggiornata.` : `"${title}" segnato come visto.`,
    );
  },

  removeDiaryEntry: (movieId) => {
    const movie = MOVIES.find((m) => m.id === movieId);
    const nextDiary = get().diary.filter((d) => d.movieId !== movieId);
    persistOrToast(
      get,
      set,
      { watchlist: get().watchlist, diary: nextDiary },
      `"${movie?.title ?? "Film"}" rimosso dal diario.`,
    );
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
    const next: PersistedState = { watchlist: [], diary: [] };
    saveState(next);
    set({ watchlist: [], diary: [], storageError: false });
    get().pushToast("info", "Dati locali ripristinati.");
  },
}));
