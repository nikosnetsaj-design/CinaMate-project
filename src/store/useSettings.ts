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
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { apiKey: "", model: "claude-opus-5" };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      model: MODELS.some((m) => m.id === parsed.model) ? (parsed.model as ModelId) : "claude-opus-5",
    };
  } catch {
    return { apiKey: "", model: "claude-opus-5" };
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
}

const initial = loadSettings();

export const useSettings = create<SettingsState>((set, get) => ({
  ...initial,
  setApiKey: (apiKey) => {
    const next = { apiKey: apiKey.trim(), model: get().model };
    save(next);
    set(next);
  },
  setModel: (model) => {
    const next = { apiKey: get().apiKey, model };
    save(next);
    set(next);
  },
  clearApiKey: () => {
    const next = { apiKey: "", model: get().model };
    save(next);
    set(next);
  },
}));
