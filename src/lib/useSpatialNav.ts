import { useEffect } from "react";
import { focusableIn, navScope, nextInDirection, type Direction } from "./spatialNav";
import { useTvMode } from "../store/useTvMode";

const KEYS: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

/**
 * Non si scippano le frecce a chi le sta usando per scrivere. Dentro un campo
 * di testo servono a muovere il cursore, dentro un gruppo di scelte servono al
 * browser per cambiare opzione: in tutti questi casi il telecomando può
 * aspettare, perché su un televisore quei controlli si aprono uno alla volta.
 */
function editing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/**
 * Collega le frecce al fuoco quando l'app gira su un televisore.
 *
 * Montato una volta sola in `App`: è un ascoltatore su `document`, e averne uno
 * per riga di copertine significherebbe pagarlo a ogni scorrimento.
 *
 * Il player resta fuori di proposito. Là dentro le frecce hanno già un
 * significato — avanti, indietro, volume — e sono il primo comando che si cerca
 * col telecomando in mano: sovrascriverle qui vorrebbe dire rompere l'unico
 * punto dell'app in cui la croce direzionale funzionava già.
 */
export function useSpatialNav(): void {
  const active = useTvMode((s) => s.active);

  useEffect(() => {
    // La classe accende l'anello di fuoco spesso e la scala da salotto: sta
    // qui e non in App perché è la stessa decisione, applicata al foglio di
    // stile invece che agli ascoltatori.
    document.documentElement.classList.toggle("tv", active);
    if (!active) return;

    function handleKeyDown(e: KeyboardEvent) {
      const direction = KEYS[e.key];
      if (!direction) return;
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (editing(e.target)) return;
      // Il player si comanda da sé.
      if (e.target instanceof HTMLElement && e.target.closest(".pv-app")) return;

      const current = document.activeElement;
      const focused = current instanceof HTMLElement && current !== document.body ? current : null;

      // Primo tasto premuto a pagina appena aperta: non c'è un "accanto", c'è
      // un "da qualche parte". Si parte dal primo elemento utile.
      if (!focused) {
        const first = focusableIn(document)[0];
        if (!first) return;
        e.preventDefault();
        first.focus({ preventScroll: true });
        first.scrollIntoView({ block: "center", inline: "nearest" });
        return;
      }

      const candidates = focusableIn(navScope(focused)).filter((el) => el !== focused);
      const next = nextInDirection(focused.getBoundingClientRect(), candidates, direction);
      // Se da quella parte non c'è niente le frecce tornano al browser, che
      // scorrerà la pagina: preferibile a un tasto che non fa proprio nulla.
      if (!next) return;

      e.preventDefault();
      next.focus({ preventScroll: true });
      next.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [active]);
}
