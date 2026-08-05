import { isBlockedUrl } from "./netBlocklist";

/**
 * L'hook su `window.fetch` e `XMLHttpRequest.prototype.open`.
 *
 * È la stessa tecnica dell'app nativa — sostituire i due metodi con cui una
 * pagina chiede qualcosa alla rete, e guardare cosa ci passa — applicata dove
 * un browser la permette: **il nostro documento**. In un `<iframe>` di un altro
 * dominio non si può iniettare niente, ed è la same-origin policy, non una
 * scelta; ma dentro casa nostra l'hook si mette, e da lì si vede più di quanto
 * sembri.
 *
 * Cosa si vede, in pratica: ogni indirizzo che **hls.js** chiede. È la parte
 * che conta. Il player, una volta partito, va a prendere il master, poi le
 * varianti, poi i segmenti, e lo fa con `XMLHttpRequest` — quindi il tap sa
 * dire quale manifest ha davvero funzionato, quali varianti esistevano e a che
 * indirizzo stanno i segmenti, che è precisamente ciò che nell'app nativa si
 * ricava intercettando il traffico della WebView.
 *
 * Due cose che fa oltre a guardare:
 *
 *  - **blocca** quello che è in lista nera, prima che parta. Il service worker
 *    lo fa già per tutto, ma non è detto che ci sia — in sviluppo non è
 *    registrato, e su un browser senza service worker non ci sarà mai — quindi
 *    l'hook è la seconda rete, quella che c'è sempre;
 *  - **registra i media**, così il pannello Siti e la Diagnostica possono
 *    mostrare cosa è passato invece di chiedere all'utente di aprire gli
 *    strumenti di sviluppo.
 */

export interface TappedRequest {
  url: string;
  /** `fetch` o `xhr`, cioè quale dei due metodi l'ha chiesto. */
  via: "fetch" | "xhr";
  /** Vero quando la lista nera l'ha fermata. */
  blocked: boolean;
  at: number;
}

/** Quanti indirizzi si tengono. Oltre, i più vecchi cadono. */
const MAX_ENTRIES = 200;

const MEDIA = /\.(m3u8?|mpd|ts|m4s|mp4|vtt|key)(\?|#|$)/i;

const log: TappedRequest[] = [];
const listeners = new Set<() => void>();
let blockedCount = 0;
let installed = false;

function record(url: string, via: TappedRequest["via"], blocked: boolean): void {
  // Solo i media e i bloccati. Tutto il resto — poster, chunk, font — è rumore
  // che riempirebbe il registro senza dire niente su una riproduzione.
  if (!blocked && !MEDIA.test(url)) return;
  log.push({ url, via, blocked, at: Date.now() });
  if (log.length > MAX_ENTRIES) log.splice(0, log.length - MAX_ENTRIES);
  if (blocked) blockedCount += 1;
  for (const listener of listeners) listener();
}

/** Gli indirizzi visti, dal più recente. */
export function tappedRequests(limit = 50): TappedRequest[] {
  return log.slice(-limit).reverse();
}

/** Gli ultimi manifest richiesti davvero, che è la domanda utile. */
export function tappedManifests(limit = 10): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (let i = log.length - 1; i >= 0 && out.length < limit; i -= 1) {
    const entry = log[i];
    if (entry.blocked || !/\.m3u8?(\?|#|$)/i.test(entry.url)) continue;
    if (seen.has(entry.url)) continue;
    seen.add(entry.url);
    out.push(entry.url);
  }
  return out;
}

export function tappedBlockedCount(): number {
  return blockedCount;
}

export function subscribeTap(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function clearTap(): void {
  log.length = 0;
  blockedCount = 0;
  for (const listener of listeners) listener();
}

/**
 * L'errore restituito a una richiesta bloccata.
 *
 * Un `TypeError` è ciò che `fetch` produce quando la rete fallisce, quindi il
 * chiamante lo gestisce già: uno script pubblicitario che riceve questo si
 * comporta come se non ci fosse rete, che è esattamente il risultato voluto,
 * e nessun codice dell'app va in pezzi per un percorso d'errore mai previsto.
 */
function blockedError(url: string): TypeError {
  return new TypeError(`Richiesta bloccata dalla lista nera: ${url}`);
}

/**
 * Mette i due hook. Idempotente: chiamarlo due volte non incatena due copie
 * dello stesso wrapper, che è il modo in cui un hook di questo tipo di solito
 * si rompe (ogni hot reload aggiungeva uno strato, e dopo dieci ricariche ogni
 * richiesta passava per dieci wrapper).
 */
export function installRequestTap(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const nativeFetch = window.fetch.bind(window);
  window.fetch = function tappedFetch(input: RequestInfo | URL, init?: RequestInit) {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const blocked = isBlockedUrl(url);
    record(url, "fetch", blocked);
    if (blocked) return Promise.reject(blockedError(url));
    return nativeFetch(input as RequestInfo, init);
  };

  // `open` ha due firme sovrapposte (con e senza `async`/credenziali), quindi
  // il wrapper le inoltra così come arrivano invece di riscriverne una: da qui
  // dentro non si sa quale delle due il chiamante ha usato.
  type OpenFn = (this: XMLHttpRequest, ...args: unknown[]) => void;
  const nativeOpen = XMLHttpRequest.prototype.open as unknown as OpenFn;
  // `function` e non una freccia: `this` dev'essere l'XHR su cui è stato
  // chiamato, e una freccia lo prenderebbe dal modulo.
  const tappedOpen: OpenFn = function tappedOpen(this: XMLHttpRequest, ...args: unknown[]) {
    const [method, url, ...rest] = args;
    const target = typeof url === "string" ? url : String(url);
    const blocked = isBlockedUrl(target);
    record(target, "xhr", blocked);
    // Non si può rifiutare un `open` senza rompere il contratto del chiamante,
    // che dopo chiamerà `send()`. Lo si manda su un indirizzo che non serve
    // niente: il `send` fallirà come per un errore di rete, cioè nel modo che
    // ogni client XHR sa già gestire.
    return nativeOpen.call(this, method, blocked ? "about:blank" : target, ...rest);
  };
  XMLHttpRequest.prototype.open = tappedOpen as unknown as typeof XMLHttpRequest.prototype.open;
}
