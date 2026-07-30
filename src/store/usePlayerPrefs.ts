import { create } from "zustand";
import { isRecord, readJson, writeJson } from "../lib/localStore";

const KEY = "cinemate:player-prefs:v1";

interface PlayerPrefs {
  /** Caps the adaptive ladder to the lowest rungs — for metered connections. */
  dataSaver: boolean;
  /**
   * Relay for Watch Party. Empty means `BroadcastChannel`, which only reaches
   * other tabs of the same browser; a `ws://` or `wss://` address here makes
   * the room work across devices. The relay only has to fan every message it
   * receives out to the other clients in the same room — see the README.
   */
  watchPartyRelayUrl: string;
  /** Name shown to the others in a Watch Party room. */
  displayName: string;
  /**
   * Up to three address patterns for your own sources, written once instead of
   * pasted per title. Placeholders (see lib/sourceTemplate.ts) are filled in
   * from the title, and the patterns are tried in order until one answers — so
   * the second and third double as fallbacks when the first is down.
   */
  sourceTemplates: string[];
}

export const TEMPLATE_SLOTS = 3;

const DEFAULTS: PlayerPrefs = {
  dataSaver: false,
  watchPartyRelayUrl: "",
  displayName: "Tu",
  sourceTemplates: Array(TEMPLATE_SLOTS).fill(""),
};

function isPrefs(value: unknown): value is PlayerPrefs {
  return (
    isRecord(value) &&
    typeof value.dataSaver === "boolean" &&
    typeof value.watchPartyRelayUrl === "string" &&
    typeof value.displayName === "string"
  );
}

/** Older stored prefs have no templates; give them the empty slots. */
function withDefaults(prefs: PlayerPrefs): PlayerPrefs {
  const stored = Array.isArray(prefs.sourceTemplates) ? prefs.sourceTemplates : [];
  return {
    ...prefs,
    sourceTemplates: Array.from({ length: TEMPLATE_SLOTS }, (_, i) =>
      typeof stored[i] === "string" ? stored[i] : "",
    ),
  };
}

interface PlayerPrefsState extends PlayerPrefs {
  set: (patch: Partial<PlayerPrefs>) => void;
  setTemplate: (index: number, value: string) => void;
  /** Applies preferences from a backup, falling back to the defaults. */
  restore: (value: unknown) => void;
}

export const usePlayerPrefs = create<PlayerPrefsState>((set, get) => ({
  ...withDefaults(readJson<PlayerPrefs>(KEY, isPrefs, DEFAULTS)),
  set: (patch) => {
    const { set: _set, restore: _restore, ...current } = get();
    const next = withDefaults({ ...current, ...patch });
    writeJson(KEY, next);
    set(next);
  },
  setTemplate: (index, value) => {
    const templates = [...get().sourceTemplates];
    templates[index] = value;
    get().set({ sourceTemplates: templates });
  },
  restore: (value) => {
    const next = withDefaults(isPrefs(value) ? value : DEFAULTS);
    writeJson(KEY, next);
    set(next);
  },
}));
