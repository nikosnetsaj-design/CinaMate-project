import { flushSync } from "react-dom";

/**
 * Un cambio di stato che il browser può animare da solo.
 *
 * `document.startViewTransition` fotografa lo schermo com'è, lascia che il DOM
 * cambi, e interpola fra le due immagini sul compositore — cioè sulla GPU,
 * fuori dal thread che sta già disegnando la pagina. Rispetto a un'animazione
 * scritta in JavaScript costa zero byte di libreria e zero lavoro sul thread
 * principale: è la stessa ragione per cui un'app installata sembra più fluida
 * di una pagina, e qui non serve altro che chiamarla.
 *
 * `flushSync` non è un dettaglio: React raggruppa gli aggiornamenti e li
 * applica quando gli pare, mentre la transizione ha bisogno che il DOM sia già
 * cambiato quando il callback finisce. Senza, si fotografa due volte la stessa
 * schermata e non si vede nessuna animazione.
 *
 * Chi ha chiesto meno movimento nelle impostazioni di sistema non ne vede
 * nessuno: si applica il cambio e basta. Vale anche per i browser che l'API
 * non ce l'hanno — Firefox oggi — dove tutto resta esattamente com'era prima.
 */
export function withViewTransition(update: () => void): void {
  const doc = document as Document & {
    startViewTransition?: (callback: () => void) => { finished: Promise<void> };
  };

  const reduced =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!doc.startViewTransition || reduced) {
    update();
    return;
  }

  doc.startViewTransition(() => {
    flushSync(update);
  });
}
