/**
 * Navigazione direzionale: da un elemento a quello che gli sta accanto.
 *
 * Su un televisore non c'è un puntatore. C'è una croce direzionale, e l'unica
 * domanda che il telecomando sa porre è "cosa c'è a destra di quello che sto
 * guardando". Il browser da solo non risponde: il tasto Tab segue l'ordine del
 * documento, che in una griglia di copertine è una serpentina, e le frecce
 * scorrono la pagina invece di spostare il fuoco.
 *
 * Qui la risposta è geometrica e non dipende dall'ordine del DOM: si guarda
 * dove sono davvero i rettangoli sullo schermo. È la stessa regola che usa una
 * qualsiasi interfaccia da salotto, e ha il pregio di funzionare su una riga
 * che scorre, su una griglia irregolare e su un foglio aperto sopra la pagina
 * senza sapere niente di nessuno dei tre.
 *
 * Il modulo è puro di proposito — riceve rettangoli, restituisce un elemento —
 * così la parte difficile si può provare senza un televisore.
 */

export type Direction = "up" | "down" | "left" | "right";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Gli elementi che possono ricevere il fuoco dentro `root`, esclusi quelli che
 * non si vedono: un pulsante alto zero pixel è nell'albero ma non sullo
 * schermo, e mandarci il fuoco è un vicolo cieco da cui il telecomando non
 * saprebbe uscire.
 */
export function focusableIn(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => {
    if (el.hasAttribute("hidden") || el.getAttribute("aria-hidden") === "true") return false;
    if (el.closest("[inert]")) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
}

/** Quanto due segmenti si sovrappongono sull'asse trasversale, 0 se disgiunti. */
function overlap(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

/**
 * Il candidato migliore nella direzione richiesta, o `null` se da quella parte
 * non c'è niente — caso in cui il fuoco resta dov'è, che su un telecomando è la
 * risposta giusta: il bordo di una lista si deve sentire.
 *
 * Il punteggio somma due cose: quanto è lontano l'elemento lungo la direzione
 * del tasto, e quanto è disallineato rispetto a quella. Il disallineamento pesa
 * il doppio perché è l'errore che si nota: premendo ↓ su una riga di copertine
 * ci si aspetta quella *sotto*, non quella un po' più in basso e tre schermate
 * più a destra solo perché in linea d'aria è vicina. Chi si sovrappone sull'asse
 * trasversale non paga niente: è nella stessa colonna, o nella stessa riga.
 */
function closest(
  origin: DOMRect,
  candidates: HTMLElement[],
  direction: Direction,
  onlyAligned: boolean,
): HTMLElement | null {
  const horizontal = direction === "left" || direction === "right";
  // Un pixel di tolleranza: due schede della stessa riga arrotondate in modo
  // diverso non devono sembrare una sopra l'altra.
  const EPS = 1;

  let best: HTMLElement | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const el of candidates) {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;

    const primary = horizontal
      ? direction === "right"
        ? rect.left - origin.right
        : origin.left - rect.right
      : direction === "down"
        ? rect.top - origin.bottom
        : origin.top - rect.bottom;
    // Dietro o esattamente affiancato: non è in quella direzione.
    if (primary < -EPS) continue;

    const shared = horizontal
      ? overlap(origin.top, origin.bottom, rect.top, rect.bottom)
      : overlap(origin.left, origin.right, rect.left, rect.right);
    if (onlyAligned && shared <= 0) continue;

    const cross =
      shared > 0
        ? 0
        : horizontal
          ? Math.abs((rect.top + rect.bottom) / 2 - (origin.top + origin.bottom) / 2)
          : Math.abs((rect.left + rect.right) / 2 - (origin.left + origin.right) / 2);

    const score = Math.max(primary, 0) + cross * 2;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }

  return best;
}

export function nextInDirection(origin: DOMRect, candidates: HTMLElement[], direction: Direction): HTMLElement | null {
  // Prima chi sta davvero nella stessa riga (o nella stessa colonna): è la
  // risposta che ci si aspetta nove volte su dieci.
  const aligned = closest(origin, candidates, direction, true);
  if (aligned) return aligned;

  // In orizzontale ci si ferma qui. A fine riga, → non deve saltare a una
  // scheda di un'altra riga solo perché in linea d'aria è la più vicina: il
  // bordo di una lista si deve sentire, altrimenti il fuoco sembra teletrasportarsi.
  if (direction === "left" || direction === "right") return null;

  // In verticale invece il salto disallineato serve: sotto una griglia c'è un
  // pulsante che non è incolonnato con niente, e ↓ deve arrivarci lo stesso.
  return closest(origin, candidates, direction, false);
}

/**
 * L'ambito entro cui muoversi: se sopra la pagina c'è un foglio aperto, il
 * telecomando deve restare dentro quel foglio. Altrimenti si finisce a
 * evidenziare la navigazione sotto un modale, che è esattamente il modo in cui
 * un'interfaccia da salotto si perde.
 */
export function navScope(active: Element | null): ParentNode {
  return active?.closest('[role="dialog"]') ?? document;
}
