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
}

const DEFAULTS: PlayerPrefs = { dataSaver: false, watchPartyRelayUrl: "", displayName: "Tu" };

function isPrefs(value: unknown): value is PlayerPrefs {
  return (
    isRecord(value) &&
    typeof value.dataSaver === "boolean" &&
    typeof value.watchPartyRelayUrl === "string" &&
    typeof value.displayName === "string"
  );
}

interface PlayerPrefsState extends PlayerPrefs {
  set: (patch: Partial<PlayerPrefs>) => void;
}

export const usePlayerPrefs = create<PlayerPrefsState>((set, get) => ({
  ...readJson<PlayerPrefs>(KEY, isPrefs, DEFAULTS),
  set: (patch) => {
    const { set: _set, ...current } = get();
    const next = { ...current, ...patch };
    writeJson(KEY, next);
    set(next);
  },
}));
