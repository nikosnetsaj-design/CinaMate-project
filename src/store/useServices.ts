import { create } from "zustand";
import { isRecord, readJson, writeJson } from "../lib/localStore";
import { REGIONS } from "../lib/services";
import { setWatchRegion } from "../lib/tmdb";

const KEY = "cinemate:services:v1";

/**
 * Il paese in cui guardi e i servizi che paghi già. Una preferenza, come il
 * tema: resta su questo dispositivo. Il paese decide cosa risponde TMDB su
 * «dove guardarlo», in tutta l'app.
 */
interface ServicesData {
  region: string;
  /** Chiavi dei servizi (lib/services `serviceKey`). */
  mine: string[];
}

function isData(value: unknown): value is ServicesData {
  return (
    isRecord(value) &&
    typeof value.region === "string" &&
    REGIONS.includes(value.region) &&
    Array.isArray(value.mine) &&
    value.mine.every((k) => typeof k === "string")
  );
}

interface ServicesState extends ServicesData {
  setRegion: (region: string) => void;
  toggleMine: (key: string) => void;
}

// L'Italia finché non lo cambi: è quello che l'app ha sempre fatto, e dedurlo
// dalla lingua del browser sposterebbe sugli Stati Uniti chi in Italia usa un
// browser in inglese.
const initial = readJson<ServicesData>(KEY, isData, { region: "IT", mine: [] });
setWatchRegion(initial.region);

export const useServices = create<ServicesState>((set, get) => ({
  ...initial,

  setRegion: (region) => {
    if (!REGIONS.includes(region)) return;
    setWatchRegion(region);
    writeJson(KEY, { region, mine: get().mine });
    set({ region });
  },

  toggleMine: (key) => {
    const mine = get().mine.includes(key) ? get().mine.filter((k) => k !== key) : [...get().mine, key];
    writeJson(KEY, { region: get().region, mine });
    set({ mine });
  },
}));
