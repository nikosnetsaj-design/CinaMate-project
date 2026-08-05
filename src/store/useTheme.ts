import { create } from "zustand";
import { ACCENTS, DEFAULT_ACCENT } from "../lib/accents";

/**
 * Tre temi, non due. "Slate" è una seconda base scura — grigio-blu invece che
 * aubergine — presa dall'analisi di Streaming Community: stessa identità di
 * accenti, stanza diversa. Resta un tema *scuro*, quindi degli accenti usa le
 * varianti scure: le chiare, pensate per una pagina pallida, qui sparirebbero.
 */
export type Theme = "dark" | "light" | "slate";
export const THEMES: { id: Theme; label: string }[] = [
  { id: "dark", label: "Velluto" },
  { id: "slate", label: "Ardesia" },
  { id: "light", label: "Chiaro" },
];
const STORAGE_KEY = "cinemate:theme";
const ACCENT_KEY = "cinemate:accent";

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light" || stored === "slate") return stored;
  } catch {
    /* localStorage unavailable — fall through to system preference */
  }
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "dark";
}

function getInitialAccent(): string {
  try {
    const stored = localStorage.getItem(ACCENT_KEY);
    if (stored && ACCENTS.some((a) => a.id === stored)) return stored;
  } catch {
    /* localStorage unavailable — the default is a fine answer */
  }
  return DEFAULT_ACCENT;
}

interface ThemeState {
  theme: Theme;
  /** L'ultimo tema scuro scelto: è dove torna l'interruttore rapido. */
  lastDark: Theme;
  accent: string;
  toggle: () => void;
  setTheme: (theme: Theme) => void;
  setAccent: (accent: string) => void;
}

const initialTheme = getInitialTheme();

export const useTheme = create<ThemeState>((set, get) => ({
  theme: initialTheme,
  lastDark: initialTheme === "light" ? "dark" : initialTheme,
  accent: getInitialAccent(),
  // L'interruttore rapido nella barra resta binario: chiaro o scuro. Ma "scuro"
  // significa l'ultimo scuro che avevi scelto, non sempre il velluto: chi ha
  // messo ardesia e accende la luce per un attimo si aspetta di ritrovare la sua
  // stanza quando la rispegne.
  toggle: () => {
    const { theme, lastDark } = get();
    get().setTheme(theme === "light" ? lastDark : "light");
  },
  setTheme: (theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* preference just won't persist across sessions */
    }
    set(theme === "light" ? { theme } : { theme, lastDark: theme });
  },
  setAccent: (accent) => {
    if (!ACCENTS.some((a) => a.id === accent)) return;
    try {
      localStorage.setItem(ACCENT_KEY, accent);
    } catch {
      /* preference just won't persist across sessions */
    }
    set({ accent });
  },
}));
