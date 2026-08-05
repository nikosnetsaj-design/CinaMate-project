import { normalizeSite, withProtocol } from "./linkHost";
import { resolveName } from "./doh";

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
  /** Il nome non si risolve nemmeno su un resolver pubblico: non è il sito. */
  | "nome-non-risolto"
  /** Il nome si risolve, ma da qui non risponde niente. */
  | "risolve-ma-muto"
  | "non-raggiungibile";

export interface RedirectProbe {
  status: RedirectStatus;
  /** L'indirizzo finale, solo quando il browser ce l'ha fatto leggere. */
  finalUrl?: string;
  /** Gli indirizzi che un resolver pubblico dà per quel nome, se ce ne sono. */
  addresses?: string[];
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
      // Neanche una richiesta opaca è arrivata. Prima di dire «non
      // raggiungibile» — che è vero ma non dice niente di utile — si chiede a
      // un resolver pubblico se quel nome esista: separa il sito spento dal
      // nome che, sulla risoluzione che stai usando, non diventa un indirizzo.
      // È la differenza fra «aspetta che torni» e «guarda le tue impostazioni
      // di rete», ed è l'unica cosa che il browser lasci ancora scoprire.
      const dns = await resolveName(start, signal);
      if (dns.verdict === "inesistente") return { status: "nome-non-risolto", checkedAt };
      if (dns.verdict === "risolto") {
        return { status: "risolve-ma-muto", addresses: dns.addresses, checkedAt };
      }
      return { status: "non-raggiungibile", checkedAt };
    }
  }
}

// ---------------------------------------------------------------------------
// Euristica dei mirror: lo stesso nome sotto un'altra estensione
// ---------------------------------------------------------------------------

/**
 * Le estensioni provate quando un host sparisce. Non è una lista di siti — è
 * una lista di TLD, gli stessi che userebbe chiunque provi a mano dopo che un
 * indirizzo ha smesso di rispondere.
 */
const ALTERNATIVE_TLDS = [
  "com", "net", "org", "to", "cc", "co", "io", "me", "tv", "it", "eu", "info", "site", "one", "life",
];

export interface MirrorCandidate {
  url: string;
  /** Risolve, e — quando si è potuto scoprire — risponde. */
  resolves: boolean;
  answers: boolean;
}

/**
 * Cerca lo stesso nome sotto un'altra estensione.
 *
 * Prima si chiede al DNS, poi si bussa solo a chi ha risposto: una risoluzione
 * via DoH è una richiesta piccola verso un endpoint che sappiamo veloce, mentre
 * bussare a quindici domini che non esistono vuol dire quindici timeout in
 * fila. Così il costo è una richiesta DNS per candidato più una connessione
 * solo per i pochi che esistono davvero.
 *
 * Quello che trova è **un candidato, non un mirror**: che `esempio.net` esista
 * non dice niente su chi ci sia dietro, e su un'estensione libera c'è spesso un
 * dominio parcheggiato o qualcun altro. Per questo il risultato va in una lista
 * da guardare — nel Web Viewer, con i propri occhi — e non sostituisce mai
 * l'indirizzo salvato da solo.
 */
export async function findMirrors(address: string, signal?: AbortSignal): Promise<MirrorCandidate[]> {
  const start = normalizeSite(address);
  if (!start) return [];

  let host: string;
  let protocol: string;
  try {
    const parsed = new URL(start);
    host = parsed.hostname;
    protocol = parsed.protocol;
  } catch {
    return [];
  }

  // `www.esempio.co.uk` → prefisso `www.esempio`, estensione `co.uk`. Il
  // secondo livello si tiene solo quando è uno dei suffissi composti noti:
  // spezzare `esempio.com` sull'ultimo punto e basta è giusto, spezzare
  // `esempio.co.uk` allo stesso modo darebbe `esempio.co` + `uk`.
  const parts = host.split(".");
  if (parts.length < 2) return [];
  const isCompound = parts.length > 2 && /^(co|com|net|org|ac|gov)$/.test(parts[parts.length - 2]);
  const base = parts.slice(0, isCompound ? -2 : -1).join(".");
  const currentTld = parts.slice(isCompound ? -2 : -1).join(".");
  if (!base) return [];

  const candidates = ALTERNATIVE_TLDS.filter((tld) => tld !== currentTld).map(
    (tld) => `${protocol}//${base}.${tld}`,
  );

  const resolved = await Promise.all(
    candidates.map(async (url) => {
      if (signal?.aborted) return null;
      const dns = await resolveName(url, signal);
      return dns.verdict === "risolto" ? url : null;
    }),
  );

  const live = resolved.filter((u): u is string => u !== null);
  const answered = await Promise.all(
    live.map(async (url) => {
      try {
        await timed(url, { method: "GET", mode: "no-cors" }, signal);
        return true;
      } catch {
        return false;
      }
    }),
  );

  return live.map((url, i) => ({ url, resolves: true, answers: answered[i] }));
}

export const REDIRECT_LABEL: Record<RedirectStatus, string> = {
  invariato: "Risponde dal suo indirizzo",
  traslocato: "Ha traslocato",
  "raggiungibile-ma-opaco": "Risponde, ma non si lascia leggere da qui",
  "nome-non-risolto": "Il nome non esiste",
  "risolve-ma-muto": "Il nome esiste, il server non risponde",
  "non-raggiungibile": "Non risponde",
};

export const REDIRECT_HINT: Record<RedirectStatus, string> = {
  invariato: "L'indirizzo salvato è ancora quello giusto.",
  traslocato: "Il vecchio indirizzo rimanda altrove. Puoi accettare il nuovo o lasciare com'è.",
  "raggiungibile-ma-opaco":
    "Qualcosa a quell'indirizzo c'è, ma non manda gli header CORS: da una pagina web non si può sapere dove porta. Aprilo nel Web Viewer per vederlo con i tuoi occhi.",
  "nome-non-risolto":
    "Anche un resolver pubblico dice che quel nome non esiste. Non è il tuo DNS e non è un blocco: o è scritto male, o il dominio è stato dismesso. Prova a cercarne uno alternativo.",
  "risolve-ma-muto":
    "Il nome si traduce in un indirizzo, ma da qui non risponde nessuno. Il dominio c'è; il server dietro è spento, sovraccarico, o non accetta questa connessione.",
  "non-raggiungibile":
    "Nessuna risposta, e non sono riuscito nemmeno a chiedere a un resolver pubblico che ne fosse del nome. Di solito è la rete di questo dispositivo.",
};
