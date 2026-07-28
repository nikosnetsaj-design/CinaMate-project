import { create } from "zustand";

const KEY = "cinemate:session:v1";

interface Session {
  itemId: string;
  startedAt: number;
}

function load(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Session>;
    return typeof p.itemId === "string" && typeof p.startedAt === "number" ? { itemId: p.itemId, startedAt: p.startedAt } : null;
  } catch {
    return null;
  }
}

function save(s: Session | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* best effort: the prompt simply will not reappear after a reload */
  }
}

interface SessionState {
  session: Session | null;
  /** Marks that watching has begun, so the return can be recognised. */
  start: (itemId: string) => void;
  clear: () => void;
}

export const useWatchSession = create<SessionState>((set) => ({
  session: load(),
  start: (itemId) => {
    const s = { itemId, startedAt: Date.now() };
    save(s);
    set({ session: s });
  },
  clear: () => {
    save(null);
    set({ session: null });
  },
}));
