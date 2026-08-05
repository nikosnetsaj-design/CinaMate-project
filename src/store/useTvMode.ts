import { create } from "zustand";

/**
 * Modalità televisore: riconoscerla, e poterla smentire.
 *
 * Un televisore non si distingue con certezza da un computer — la stringa che
 * il browser dichiara è l'unico indizio, e i produttori la scrivono come
 * capita. Per questo il riconoscimento automatico è solo il valore iniziale di
 * una preferenza a tre stati: chi ha un mini-PC attaccato al televisore la
 * accende a mano, chi ha un portatile che per qualche ragione somiglia a una
 * smart TV la spegne. Indovinare senza dare l'interruttore sarebbe il difetto
 * peggiore delle due cose.
 */

export type TvPreference = "auto" | "on" | "off";

const STORAGE_KEY = "cinemate:tv";

/**
 * I due indizi che valgono qualcosa.
 *
 * Il primo sono i nomi che le TV si danno: Tizen è Samsung, webOS è LG, gli
 * `AFT…` sono i Fire TV, `CrKey` è un Chromecast. Il secondo è più interessante
 * del primo: `pointer: none` significa che il browser dichiara di non avere
 * *nessun* dispositivo di puntamento, né mouse né dito. Su un telefono o su un
 * computer non succede; su un apparecchio che si comanda col telecomando sì.
 */
function detectTv(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  if (/\b(smart-?tv|googletv|android tv|hbbtv|netcast|viera|bravia|aft[a-z]{1,3}|crkey|web0s|webos|tizen)\b/i.test(ua)) {
    return true;
  }
  return typeof window.matchMedia === "function" && window.matchMedia("(pointer: none)").matches;
}

function loadPreference(): TvPreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "auto" || stored === "on" || stored === "off") return stored;
  } catch {
    /* localStorage non disponibile: "auto" è comunque la risposta giusta */
  }
  return "auto";
}

interface TvState {
  preference: TvPreference;
  /** Cosa dice il riconoscimento — mostrato accanto all'interruttore, non nascosto. */
  detected: boolean;
  /** Se la navigazione da telecomando è accesa adesso. */
  active: boolean;
  setPreference: (preference: TvPreference) => void;
}

function resolve(preference: TvPreference, detected: boolean): boolean {
  return preference === "on" || (preference === "auto" && detected);
}

const detected = detectTv();
const preference = loadPreference();

export const useTvMode = create<TvState>((set) => ({
  preference,
  detected,
  active: resolve(preference, detected),
  setPreference: (next) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* la preferenza semplicemente non sopravvive alla sessione */
    }
    set({ preference: next, active: resolve(next, detected) });
  },
}));
