import { create } from "zustand";
import { ACCENTS, DEFAULT_ACCENT } from "../lib/accents";

type Theme = "dark" | "light";
const STORAGE_KEY = "cinemate:theme";
const ACCENT_KEY = "cinemate:accent";

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
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
  accent: string;
  toggle: () => void;
  setAccent: (accent: string) => void;
}

export const useTheme = create<ThemeState>((set, get) => ({
  theme: getInitialTheme(),
  accent: getInitialAccent(),
  toggle: () => {
    const next: Theme = get().theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* preference just won't persist across sessions */
    }
    set({ theme: next });
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
