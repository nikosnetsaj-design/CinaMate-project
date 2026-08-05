import type { Item } from "../types";
import type { LinkHost } from "../lib/linkHost";
import { effectiveUrl, searchUrlsFor } from "../lib/linkHost";
import { bestStreamIn, readPage, titleLinksIn } from "../lib/streamExtract";
import type { FoundLink } from "../lib/streamExtract";

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

export type SearchOutcome =
  /** Trovato: l'indirizzo del flusso è pronto per il lettore. */
  | { kind: "flusso"; url: string; pageUrl: string; hostId: string }
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
): Promise<SearchOutcome | null> {
  const address = effectiveUrl(host);
  if (!address) return null;
  const urls = searchUrlsFor({ ...host, url: address }, item);

  let blocked: SearchOutcome | null = null;
  let empty: SearchOutcome | null = null;

  for (const searchUrl of urls) {
    if (signal?.aborted) return null;
    const page = await readPage(searchUrl, signal);

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
    if (direct && direct.kind === "hls") {
      return { kind: "flusso", url: direct.url, pageUrl: page.finalUrl, hostId: host.id };
    }

    const candidates = titleLinksIn(page.html, page.finalUrl, item);
    if (!candidates.length) {
      if (!empty) empty = { kind: "nessun-risultato", searchUrl, hostId: host.id };
      continue;
    }

    for (const candidate of candidates.slice(0, MAX_PAGES_TRIED)) {
      if (signal?.aborted) return null;
      const titlePage = await readPage(candidate.url, signal);
      if (!titlePage.ok) {
        if (titlePage.reason === "bloccato-cors" && !blocked) {
          blocked = { kind: "bloccato", searchUrl: candidate.url, hostId: host.id };
        }
        continue;
      }
      const stream = bestStreamIn(titlePage.html, titlePage.finalUrl);
      if (stream && stream.kind === "hls") {
        return { kind: "flusso", url: stream.url, pageUrl: titlePage.finalUrl, hostId: host.id };
      }
    }

    // La pagina del titolo c'è, il manifest no: quasi sempre perché il player
    // del sito lo carica da JavaScript, che qui non gira. Vale la pena
    // restituirla lo stesso — è l'indirizzo giusto da aprire nel Web Viewer.
    return { kind: "solo-pagina", pageUrl: candidates[0].url, hostId: host.id, candidates };
  }

  return blocked ?? empty;
}

/**
 * Cerca il titolo sugli host abilitati, nell'ordine in cui li hai messi, e si
 * ferma al primo che dà un flusso. Un host che non risponde non blocca gli
 * altri: il suo esito peggiore si tiene da parte e si passa al successivo.
 */
export async function searchOnLinkHosts(
  item: Item,
  hosts: LinkHost[],
  signal?: AbortSignal,
): Promise<SearchOutcome> {
  const usable = hosts.filter((h) => h.enabled && h.url.trim());
  if (!usable.length) return { kind: "niente-host" };

  let fallback: SearchOutcome | null = null;
  for (const host of usable) {
    if (signal?.aborted) return fallback ?? { kind: "niente-host" };
    const outcome = await searchOneHost(host, item, signal);
    if (!outcome) continue;
    if (outcome.kind === "flusso") return outcome;
    // Fra due mezzi fallimenti vince quello che ti lascia più vicino al
    // risultato: una pagina da aprire batte un muro CORS, che batte un
    // «non c'era».
    if (!fallback || rank(outcome) > rank(fallback)) fallback = outcome;
  }
  return fallback ?? { kind: "niente-host" };
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
