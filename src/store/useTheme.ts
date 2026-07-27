import { create } from "zustand";

type Theme = "dark" | "light";
const STORAGE_KEY = "cinemate:theme";

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

interface ThemeState {
  theme: Theme;
  toggle: () => void;
}

export const useTheme = create<ThemeState>((set, get) => ({
  theme: getInitialTheme(),
  toggle: () => {
    const next: Theme = get().theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* preference just won't persist across sessions */
    }
    set({ theme: next });
  },
}));
