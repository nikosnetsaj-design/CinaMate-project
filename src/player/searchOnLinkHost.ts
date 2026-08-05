import type { Item } from "../types";
import type { EpisodePosition, LinkHost } from "../lib/linkHost";
import { effectiveUrl, searchUrlsFor } from "../lib/linkHost";
import { bestStreamConfirmed, bestStreamIn, readPage, titleLinksIn } from "../lib/streamExtract";
import type { FoundLink } from "../lib/streamExtract";
import { parseMaster } from "./services/hlsManifest";

/**
 * La ricerca automatica: da «Guarda» al flusso, passando per il sito che hai
 * indicato.
 *
 * Tre passi, e ognuno può finire lì:
 *
 *   1. **la domanda** — i metadati concatenati diventano l'indirizzo di ricerca
 *      del sito (`lib/linkHost.ts`);
 *   2. **il risultato** — la pagina dei risultati si legge e si sceglie il
 *      collegamento che risponde al titolo (`lib/streamExtract.ts`);
 *   3. **il flusso** — la pagina del titolo si legge e se ne isola l'`.m3u8`,
 *      che va nel lettore.
 *
 * Se il flusso c'è, il player parte e la pagina non la vedi mai. Se manca un
 * pezzo, il risultato dice *quale*, perché le due strade che restano sono
 * diverse: senza risultati si cambia ricetta o modello di ricerca; con il
 * browser che blocca la lettura si apre il Web Viewer e si guarda a mano.
 *
 * **CORS, di nuovo.** Il passo 2 e il passo 3 leggono il sorgente di pagine di
 * un altro dominio. Un'app nativa lo fa e basta; un browser lo permette solo se
 * quel dominio manda gli header. Quindi questa catena funziona per intero su un
 * host che è tuo, e sulla maggior parte dei siti di terzi si ferma al primo
 * `bloccato-cors`. Non è una funzione rotta: è il motivo per cui il Web Viewer
 * esiste, ed è scritto nell'interfaccia invece che scoperto dall'utente.
 */

/** Quanto vale un flusso trovato, per scegliere fra più host che rispondono. */
export interface StreamQuality {
  /** Millisecondi dall'inizio della ricerca su quell'host al flusso. */
  ms: number;
  /** L'altezza massima dichiarata nel master, quando è leggibile. */
  height: number | null;
  /** Il bitrate massimo dichiarato, in bit al secondo. */
  bandwidth: number | null;
}

export type SearchOutcome =
  /** Trovato: l'indirizzo del flusso è pronto per il lettore. */
  | { kind: "flusso"; url: string; pageUrl: string; hostId: string; quality?: StreamQuality }
  /** La pagina del titolo c'è, il flusso dentro no: si apre a mano. */
  | { kind: "solo-pagina"; pageUrl: string; hostId: string; candidates: FoundLink[] }
  /** Il sito risponde ma il browser non ci lascia leggere. */
  | { kind: "bloccato"; searchUrl: string; hostId: string }
  /** La ricerca è andata, il titolo non c'era. */
  | { kind: "nessun-risultato"; searchUrl: string; hostId: string }
  /** Nessun host abilitato, o nessuno raggiungibile. */
  | { kind: "niente-host" };

/** Quante pagine di titolo si aprono prima di arrendersi, per host. */
const MAX_PAGES_TRIED = 2;

async function searchOneHost(
  host: LinkHost,
  item: Item,
  signal?: AbortSignal,
  position?: Partial<EpisodePosition>,
): Promise<SearchOutcome | null> {
  const address = effectiveUrl(host);
  if (!address) return null;
  const started = performance.now();
  const urls = searchUrlsFor({ ...host, url: address }, item, position);
  const found = (url: string, pageUrl: string): SearchOutcome => ({
    kind: "flusso",
    url,
    pageUrl,
    hostId: host.id,
    quality: { ms: Math.round(performance.now() - started), height: null, bandwidth: null },
  });

  let blocked: SearchOutcome | null = null;
  let empty: SearchOutcome | null = null;

  for (const searchUrl of urls) {
    if (signal?.aborted) return null;
    const page = await readPage(searchUrl, signal, { sendCookies: host.sendCookies });

    if (!page.ok) {
      // Un blocco CORS si ricorda ma non ferma il giro: gli altri percorsi di
      // ricerca sono sullo stesso dominio e daranno lo stesso muro, ma un
      // modello scritto a mano può puntare altrove.
      if (page.reason === "bloccato-cors" && !blocked) {
        blocked = { kind: "bloccato", searchUrl, hostId: host.id };
      }
      continue;
    }

    // Certi siti mostrano il titolo e il suo player nella stessa pagina dei
    // risultati. Se il flusso è già lì, non c'è motivo di aprire altro.
    const direct = bestStreamIn(page.html, page.finalUrl);
    if (direct && direct.kind === "hls") return found(direct.url, page.finalUrl);

    const candidates = titleLinksIn(page.html, page.finalUrl, item);
    if (!candidates.length) {
      if (!empty) empty = { kind: "nessun-risultato", searchUrl, hostId: host.id };
      continue;
    }

    for (const candidate of candidates.slice(0, MAX_PAGES_TRIED)) {
      if (signal?.aborted) return null;
      const titlePage = await readPage(candidate.url, signal, { sendCookies: host.sendCookies });
      if (!titlePage.ok) {
        if (titlePage.reason === "bloccato-cors" && !blocked) {
          blocked = { kind: "bloccato", searchUrl: candidate.url, hostId: host.id };
        }
        continue;
      }
      // Qui si paga la conferma dei candidati senza estensione: è la pagina
      // del titolo, l'ultima in cui il manifest può essere, e arrendersi
      // perché l'indirizzo non finisce in `.m3u8` sarebbe arrendersi presto.
      const stream = await bestStreamConfirmed(titlePage.html, titlePage.finalUrl, signal, {
        sendCookies: host.sendCookies,
      });
      if (stream && stream.kind === "hls") return found(stream.url, titlePage.finalUrl);
    }

    // La pagina del titolo c'è, il manifest no: quasi sempre perché il player
    // del sito lo carica da JavaScript, che qui non gira. Vale la pena
    // restituirla lo stesso — è l'indirizzo giusto da aprire nel Web Viewer.
    return { kind: "solo-pagina", pageUrl: candidates[0].url, hostId: host.id, candidates };
  }

  return blocked ?? empty;
}

/**
 * Cerca il titolo su tutti gli host abilitati **in parallelo**, e sceglie il
 * risultato migliore invece del primo che arriva.
 *
 * In parallelo perché il costo di un host che non risponde è un timeout intero,
 * e in fila tre host lenti sono tre timeout sommati prima di dire qualcosa. In
 * parallelo il tempo totale è quello del più lento, non della somma.
 *
 * «Migliore» e non «primo» perché con più mirror la risposta più veloce non è
 * quella che si vuole guardare: un host che risponde in 200ms con un master a
 * 480p perde contro uno che ci mette un secondo e ne ha uno a 1080p. La qualità
 * dichiarata pesa più della latenza, che sotto la soglia in cui il video parte
 * comunque non si sente — vedi `scoreStream`.
 */
export async function searchOnLinkHosts(
  item: Item,
  hosts: LinkHost[],
  signal?: AbortSignal,
  position?: Partial<EpisodePosition>,
): Promise<SearchOutcome> {
  const usable = hosts.filter((h) => h.enabled && h.url.trim());
  if (!usable.length) return { kind: "niente-host" };

  const outcomes = (
    await Promise.all(usable.map((host) => searchOneHost(host, item, signal, position)))
  ).filter((o): o is SearchOutcome => o !== null);

  const streams = outcomes.filter((o) => o.kind === "flusso");
  if (streams.length === 1) return await withQuality(streams[0], signal);
  if (streams.length > 1) {
    // Un solo host che risponde è il caso normale e non merita di leggere un
    // master per niente: le qualità si vanno a chiedere solo quando c'è
    // davvero una scelta da fare.
    const measured = await Promise.all(streams.map((s) => withQuality(s, signal)));
    return measured.reduce((best, s) => (scoreStream(s) > scoreStream(best) ? s : best));
  }

  // Nessun flusso. Fra due mezzi fallimenti vince quello che lascia più vicino
  // al risultato: una pagina da aprire batte un muro CORS, che batte un
  // «non c'era».
  let fallback: SearchOutcome | null = null;
  for (const outcome of outcomes) {
    if (!fallback || rank(outcome) > rank(fallback)) fallback = outcome;
  }
  return fallback ?? { kind: "niente-host" };
}

/**
 * Legge il master del flusso trovato per sapere che qualità offre.
 *
 * È una richiesta in più, e serve solo a scegliere fra più host. Se il master
 * non si lascia leggere — CORS di nuovo, o è già una media playlist senza
 * varianti — il flusso resta valido con la qualità sconosciuta: il punteggio la
 * tratta come neutra invece che come zero, così un host leggibile a 480p non
 * batte per forfait uno illeggibile che magari aveva il 4K.
 */
async function withQuality(outcome: SearchOutcome, signal?: AbortSignal): Promise<SearchOutcome> {
  if (outcome.kind !== "flusso" || !outcome.quality) return outcome;
  try {
    const res = await fetch(outcome.url, { signal, cache: "no-store", referrerPolicy: "no-referrer" });
    if (!res.ok) return outcome;
    const variants = parseMaster(await res.text(), outcome.url);
    if (!variants.length) return outcome;
    return {
      ...outcome,
      quality: {
        ...outcome.quality,
        height: Math.max(...variants.map((v) => v.height)),
        bandwidth: Math.max(...variants.map((v) => v.bandwidth)),
      },
    };
  } catch {
    return outcome;
  }
}

/** Neutro quando la qualità non si è potuta leggere — vedi `withQuality`. */
const NEUTRAL_HEIGHT = 720;
/** Oltre questa latenza la differenza si sente davvero. */
const SLOW_MS = 4000;

function scoreStream(outcome: SearchOutcome): number {
  if (outcome.kind !== "flusso" || !outcome.quality) return 0;
  const { ms, height } = outcome.quality;
  // La risoluzione domina: 2160 contro 720 sono tre punti pieni di differenza,
  // mentre la latenza al massimo ne toglie uno. È l'ordine giusto per qualcosa
  // che si guarda per due ore e si apre una volta.
  const picture = Math.min((height ?? NEUTRAL_HEIGHT) / 720, 3);
  const speed = 1 - Math.min(ms / SLOW_MS, 1);
  return picture * 3 + speed;
}

function rank(outcome: SearchOutcome): number {
  switch (outcome.kind) {
    case "flusso":
      return 4;
    case "solo-pagina":
      return 3;
    case "bloccato":
      return 2;
    case "nessun-risultato":
      return 1;
    default:
      return 0;
  }
}

/** Cosa scrivere all'utente, per ogni esito che non è un flusso. */
export function outcomeMessage(outcome: SearchOutcome): string {
  switch (outcome.kind) {
    case "flusso":
      return "Flusso trovato.";
    case "solo-pagina":
      return "Ho trovato la pagina del titolo ma non il flusso: quasi sempre vuol dire che il player del sito lo carica da JavaScript, che qui non gira. Aprila nel Web Viewer.";
    case "bloccato":
      return "Il sito risponde ma non lascia che questa pagina ne legga il contenuto (CORS). È il limite di un'app che gira nel browser: aprilo nel Web Viewer e cerca a mano.";
    case "nessun-risultato":
      return "La ricerca è andata a buon fine ma non ha restituito questo titolo. Prova a cambiare la ricetta della domanda o a scrivere il percorso di ricerca del sito.";
    case "niente-host":
      return "Nessun Link Host abilitato. Aggiungine uno in Impostazioni → Link Host.";
  }
}
