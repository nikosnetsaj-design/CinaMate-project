import { useRef } from "react";

const HOLD_MS = 500;

/**
 * Tocco e pressione lunga sullo stesso bottone.
 *
 * Il tocco fa l'azione breve; tenendo premuto mezzo secondo parte l'altra, e il
 * click che il browser manda al rilascio viene ingoiato — altrimenti la
 * pressione lunga farebbe anche quella breve. La pressione lunga non esiste da
 * tastiera né per molti lettori di schermo, quindi ha due strade in più che
 * fanno la stessa cosa: Maiuscolo + clic (o Maiuscolo + Invio) e il menu
 * contestuale, che su Android è proprio la pressione lunga.
 */
export function useLongPress(onTap: () => void, onLong: () => void) {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);

  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };

  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      fired.current = false;
      clear();
      timer.current = window.setTimeout(() => {
        fired.current = true;
        timer.current = null;
        // Un cenno fisico dove c'è: la pressione è riuscita.
        try {
          navigator.vibrate?.(12);
        } catch {
          // niente
        }
        onLong();
      }, HOLD_MS);
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      if (fired.current) return;
      clear();
      fired.current = true;
      onLong();
    },
    onClick: (e: React.MouseEvent) => {
      if (fired.current) {
        fired.current = false;
        return;
      }
      if (e.shiftKey) onLong();
      else onTap();
    },
  };
}
