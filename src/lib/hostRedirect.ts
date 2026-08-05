import { normalizeSite, withProtocol } from "./linkHost";

/**
 * Seguire un host che ha cambiato indirizzo.
 *
 * Il meccanismo è tutto qui: un sito che trasloca lascia un redirect
 * sull'indirizzo vecchio, `fetch` lo segue, e `Response.url` è dove si è
 * fermato. Se quel dominio è diverso da quello di partenza, l'host ha traslocato
 * e l'indirizzo salvato è vecchio.
 *
 * **Non si applica da solo.** Il risultato è una *proposta* che compare
 * nell'elenco e che devi accettare: un redirect può portare a una pagina di
 * cortesia, a un parcheggio di dominio o a qualcosa che non c'entra niente, e
 * riscrivere in silenzio un indirizzo che hai scritto tu sarebbe la cosa
 * sbagliata da fare anche quando indovina.
 *
 * **Cosa il browser non lascia sapere.** Se il sito non manda gli header CORS,
 * `fetch` fallisce prima di dire dov'è finito, e in `no-cors` la risposta è
 * opaca: `url` vuoto, `status` 0. In quel caso si impara una cosa sola — se
 * qualcosa risponde o no — e il risultato lo dice invece di inventarsi un
 * indirizzo. È il limite di girare in una pagina web invece che in un'app
 * nativa, ed è meglio dichiararlo che mascherarlo.
 */

const PROBE_TIMEOUT_MS = 8000;

export type RedirectStatus =
  | "invariato"
  | "traslocato"
  | "raggiungibile-ma-opaco"
  | "non-raggiungibile";

export interface RedirectProbe {
  status: RedirectStatus;
  /** L'indirizzo finale, solo quando il browser ce l'ha fatto leggere. */
  finalUrl?: string;
  checkedAt: number;
}

function hostnameOf(url: string): string {
  try {
    return new URL(withProtocol(url)).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

async function timed(url: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
      redirect: "follow",
      referrerPolicy: "no-referrer",
    });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

/** Dov'è finito l'indirizzo, per quanto il browser lascia vedere. */
export async function probeRedirect(address: string, signal?: AbortSignal): Promise<RedirectProbe> {
  const checkedAt = Date.now();
  const start = normalizeSite(address);
  if (!start) return { status: "non-raggiungibile", checkedAt };

  try {
    // `GET` e non `HEAD`: un buon numero di server risponde 405 a `HEAD` e
    // salta il redirect che invece serve, che è l'unica cosa cercata qui.
    const res = await timed(start, { method: "GET" }, signal);
    const finalUrl = res.url || start;
    const moved = hostnameOf(finalUrl) !== hostnameOf(start);
    return { status: moved ? "traslocato" : "invariato", finalUrl, checkedAt };
  } catch {
    // Fallito: CORS o server spento, indistinguibili di proposito. Una
    // richiesta opaca non lo distingue meglio, ma almeno separa «c'è ma non
    // parla» da «non c'è».
    try {
      await timed(start, { method: "GET", mode: "no-cors" }, signal);
      return { status: "raggiungibile-ma-opaco", checkedAt };
    } catch {
      return { status: "non-raggiungibile", checkedAt };
    }
  }
}

export const REDIRECT_LABEL: Record<RedirectStatus, string> = {
  invariato: "Risponde dal suo indirizzo",
  traslocato: "Ha traslocato",
  "raggiungibile-ma-opaco": "Risponde, ma non si lascia leggere da qui",
  "non-raggiungibile": "Non risponde",
};

export const REDIRECT_HINT: Record<RedirectStatus, string> = {
  invariato: "L'indirizzo salvato è ancora quello giusto.",
  traslocato: "Il vecchio indirizzo rimanda altrove. Puoi accettare il nuovo o lasciare com'è.",
  "raggiungibile-ma-opaco":
    "Qualcosa a quell'indirizzo c'è, ma non manda gli header CORS: da una pagina web non si può sapere dove porta. Aprilo nel Web Viewer per vederlo con i tuoi occhi.",
  "non-raggiungibile":
    "Nessuna risposta. Può essere spento, può essere il DNS del tuo operatore che non lo risolve — vedi la scheda DNS — o semplicemente un indirizzo scritto male.",
};
