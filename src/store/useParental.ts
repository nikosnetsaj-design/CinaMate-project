import { create } from "zustand";
import { isRecord, readJson, writeJson } from "../lib/localStore";
import { AGE_LEVELS, hashPin, newSalt, type AgeLevel } from "../lib/parental";

const KEY = "cinemate:parental:v1";

interface Stored {
  enabled: boolean;
  maxAge: AgeLevel;
  allowUnrated: boolean;
  pinHash: string;
  salt: string;
}

const DEFAULTS: Stored = {
  enabled: false,
  maxAge: 12,
  allowUnrated: false,
  pinHash: "",
  salt: "",
};

function isStored(value: unknown): value is Stored {
  return (
    isRecord(value) &&
    typeof value.enabled === "boolean" &&
    AGE_LEVELS.includes(value.maxAge as AgeLevel) &&
    typeof value.pinHash === "string"
  );
}

interface ParentalState extends Stored {
  /**
   * Set once the correct PIN has been entered this session, and never
   * persisted: closing the app must re-lock, otherwise the first unlock is
   * permanent and the whole thing is decoration.
   */
  unlocked: boolean;
  enable: (pin: string, maxAge: AgeLevel, allowUnrated: boolean) => Promise<void>;
  disable: (pin: string) => Promise<boolean>;
  unlock: (pin: string) => Promise<boolean>;
  lock: () => void;
  setRules: (patch: { maxAge?: AgeLevel; allowUnrated?: boolean }) => void;
}

function persist(stored: Stored): Stored {
  writeJson(KEY, stored);
  return stored;
}

function snapshot(state: ParentalState): Stored {
  return {
    enabled: state.enabled,
    maxAge: state.maxAge,
    allowUnrated: state.allowUnrated,
    pinHash: state.pinHash,
    salt: state.salt,
  };
}

export const useParental = create<ParentalState>((set, get) => ({
  ...readJson<Stored>(KEY, isStored, DEFAULTS),
  unlocked: false,

  enable: async (pin, maxAge, allowUnrated) => {
    const salt = newSalt();
    const pinHash = await hashPin(pin, salt);
    set({ ...persist({ enabled: true, maxAge, allowUnrated, pinHash, salt }), unlocked: false });
  },

  disable: async (pin) => {
    const state = get();
    if ((await hashPin(pin, state.salt)) !== state.pinHash) return false;
    set({ ...persist(DEFAULTS), unlocked: false });
    return true;
  },

  unlock: async (pin) => {
    const state = get();
    if ((await hashPin(pin, state.salt)) !== state.pinHash) return false;
    set({ unlocked: true });
    return true;
  },

  lock: () => set({ unlocked: false }),

  // Changing the rules while unlocked doesn't need the PIN again — you already
  // proved who you are to get here — but it does keep the same PIN, so this
  // never becomes a way to lower the age limit without knowing it.
  setRules: (patch) => set(persist({ ...snapshot(get()), ...patch })),
}));

/**
 * The rules as the filters want them. Being unlocked means seeing everything,
 * which is what makes the unlock worth doing — and why the flag is per-session.
 */
export function parentalRules(state: ParentalState) {
  return {
    enabled: state.enabled && !state.unlocked,
    maxAge: state.maxAge,
    allowUnrated: state.allowUnrated,
  };
}
