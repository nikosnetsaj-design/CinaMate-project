import { create } from "zustand";

const STORAGE_KEY = "cinemate:settings";

export const MODELS = [
  { id: "claude-opus-5", label: "Claude Opus 5", hint: "il più capace" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5", hint: "veloce ed economico" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", hint: "il più rapido" },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];

interface Settings {
  apiKey: string;
  model: ModelId;
  tmdbApiKey: string;
  /**
   * Il lettore di pagine: l'indirizzo di un servizio tuo che scarica una
   * pagina al posto del browser e la restituisce con gli header CORS. Vuoto
   * significa «nessuno», ed è il valore di partenza — vedi `lib/pageReader.ts`
   * per cosa cambia quando c'è e perché non ne viene proposto nessuno.
   */
  pageReader: string;
}

const EMPTY: Settings = { apiKey: "", model: "claude-opus-5", tmdbApiKey: "", pageReader: "" };

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      model: MODELS.some((m) => m.id === parsed.model) ? (parsed.model as ModelId) : "claude-opus-5",
      tmdbApiKey: typeof parsed.tmdbApiKey === "string" ? parsed.tmdbApiKey : "",
      pageReader: typeof parsed.pageReader === "string" ? parsed.pageReader : "",
    };
  } catch {
    return { ...EMPTY };
  }
}

function save(settings: Settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* best-effort — settings simply won't persist across sessions */
  }
}

interface SettingsState extends Settings {
  setApiKey: (apiKey: string) => void;
  setModel: (model: ModelId) => void;
  clearApiKey: () => void;
  setTmdbApiKey: (tmdbApiKey: string) => void;
  clearTmdbApiKey: () => void;
  setPageReader: (pageReader: string) => void;
}

const initial = loadSettings();

function currentSettings(s: SettingsState): Settings {
  return { apiKey: s.apiKey, model: s.model, tmdbApiKey: s.tmdbApiKey, pageReader: s.pageReader };
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...initial,
  setApiKey: (apiKey) => {
    const next = { ...currentSettings(get()), apiKey: apiKey.trim() };
    save(next);
    set(next);
  },
  setModel: (model) => {
    const next = { ...currentSettings(get()), model };
    save(next);
    set(next);
  },
  clearApiKey: () => {
    const next = { ...currentSettings(get()), apiKey: "" };
    save(next);
    set(next);
  },
  setTmdbApiKey: (tmdbApiKey) => {
    const next = { ...currentSettings(get()), tmdbApiKey: tmdbApiKey.trim() };
    save(next);
    set(next);
  },
  clearTmdbApiKey: () => {
    const next = { ...currentSettings(get()), tmdbApiKey: "" };
    save(next);
    set(next);
  },
  setPageReader: (pageReader) => {
    const next = { ...currentSettings(get()), pageReader: pageReader.trim() };
    save(next);
    set(next);
  },
}));
