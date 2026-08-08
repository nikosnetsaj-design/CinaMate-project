import { create } from "zustand";

const KEY = "cinemate:onboarded:v1";

/**
 * Se il primo avvio è già passato.
 *
 * Una riga sola in `localStorage`, e la si scrive **quando il flusso finisce
 * in qualunque modo** — completato o saltato. Un onboarding che ricompare
 * perché lo si è chiuso non è un onboarding: è un cartello pubblicitario.
 *
 * Chi arriva da una versione precedente non lo vede mai: la libreria piena è
 * la prova che il primo minuto è già stato superato, e mostrargli «benvenuto»
 * dopo due anni di uso sarebbe una regressione con l'aria di una novità.
 * Questa è l'unica ragione per cui `useOnboarding` non decide da solo se
 * aprirsi — glielo dice `App`, che la libreria ce l'ha sotto mano.
 */
function load(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    // Senza `localStorage` — navigazione privata, quota piena — il flusso
    // ricomparirebbe a ogni avvio. Meglio non mostrarlo che mostrarlo ogni
    // volta: le altre superfici dicono comunque cosa manca.
    return true;
  }
}

interface OnboardingState {
  done: boolean;
  /** Aperto a mano da Impostazioni, anche a primo avvio già passato. */
  replaying: boolean;
  finish: () => void;
  replay: () => void;
}

export const useOnboarding = create<OnboardingState>((set) => ({
  done: load(),
  replaying: false,
  finish: () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* best effort: al massimo si rivede una volta */
    }
    set({ done: true, replaying: false });
  },
  replay: () => set({ replaying: true }),
}));
