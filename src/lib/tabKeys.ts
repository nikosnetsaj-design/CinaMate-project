import type { KeyboardEvent } from "react";

/**
 * Le frecce dentro una fila di schede, come le descrive WAI-ARIA («Tabs
 * pattern»): ← e → passano alla scheda accanto, Inizio e Fine vanno ai bordi,
 * e nell'ordine del tasto Tab c'è una scheda sola — quella scelta — invece di
 * tutte (ogni scheda porta `tabIndex={scelta ? 0 : -1}`).
 *
 * Prima ogni scheda era una fermata del Tab e le frecce non facevano niente:
 * per arrivare al contenuto di «Traguardi» da tastiera bisognava attraversare
 * le altre quattro schede una per una, e un lettore di schermo annunciava
 * «scheda, 1 di 4» senza che i tasti che quell'annuncio promette
 * funzionassero.
 *
 * L'attivazione è automatica — la scheda raggiunta si apre — perché qui i
 * pannelli sono già in memoria e non c'è niente da aspettare. Ai bordi le
 * frecce si fermano, e lo dicono fermandosi: è la regola che l'app usa anche
 * per le righe di copertine sul televisore («il bordo di una lista si deve
 * sentire»), e `preventDefault` impedisce alla navigazione da telecomando di
 * portare il fuoco fuori dalla fila alle spalle di chi la sta percorrendo.
 *
 * Una funzione e non un componente: le file di schede dell'app hanno cinque
 * disegni diversi — pastiglie, segmenti, punti della vetrina, schede del
 * player — e il comportamento da tastiera è l'unica cosa che hanno in comune.
 * È un'utilità generica come `useFocusTrap`, ed è per questo che anche il
 * player la usa.
 */
export function onTabListKeyDown(e: KeyboardEvent<HTMLElement>): void {
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  const vertical = e.currentTarget.getAttribute("aria-orientation") === "vertical";
  const back = vertical ? "ArrowUp" : "ArrowLeft";
  const forward = vertical ? "ArrowDown" : "ArrowRight";
  if (e.key !== back && e.key !== forward && e.key !== "Home" && e.key !== "End") return;

  const tabs = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')).filter(
    (t) => !t.hasAttribute("disabled") && t.getAttribute("aria-disabled") !== "true",
  );
  const current = tabs.indexOf(document.activeElement as HTMLElement);
  if (current < 0) return;
  const target =
    e.key === "Home"
      ? 0
      : e.key === "End"
        ? tabs.length - 1
        : e.key === forward
          ? Math.min(tabs.length - 1, current + 1)
          : Math.max(0, current - 1);

  e.preventDefault();
  if (target === current) return;
  const tab = tabs[target];
  tab.focus({ preventScroll: true });
  tab.scrollIntoView({ block: "nearest", inline: "nearest" });
  tab.click();
}
