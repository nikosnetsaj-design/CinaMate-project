import { useSettings } from "../store/useSettings";
import { withProtocol } from "./linkHost";

/**
 * Il **lettore di pagine**: l'unica strada che esista, da dentro un browser,
 * per leggere una pagina che non manda gli header CORS.
 *
 * Il problema, detto una volta e per intero. `fetch` verso un altro dominio
 * riesce solo se *quel* dominio risponde con `Access-Control-Allow-Origin`. È
 * una decisione del sito, non del browser e non di questa app: nessuna opzione,
 * nessun trucco e nessuna versione futura la aggirano da qui. Un sito di
 * streaming quell'header non lo manda mai, quindi "Estrai il flusso" su quei
 * siti non poteva funzionare — e la ricerca automatica sui Siti nemmeno.
 *
 * L'unica cosa che *può* leggerli è qualcosa che non è un browser: un servizio
 * che scarica la pagina al posto tuo e te la ripassa aggiungendoci quell'header.
 * Sono venti righe di Cloudflare Worker, o un `cors-anywhere` su un Raspberry in
 * casa, o una rotta del reverse proxy che hai già davanti al tuo server.
 *
 * CineMate non ne contiene nessuno e non ne propone nessuno, per la stessa
 * ragione per cui non contiene indirizzi di siti (vedi `lib/linkHost.ts`):
 * l'indirizzo lo scrivi tu, resta su questo dispositivo, ed è tuo. Vale la pena
 * dirlo esplicitamente perché la scelta ha un prezzo che va capito prima di
 * pagarlo: **il lettore vede ogni indirizzo che gli passi.** Un servizio
 * pubblico di terzi vede la tua navigazione; uno tuo no. La differenza è tutta
 * lì, ed è il motivo per cui il campo è vuoto finché non lo riempi.
 *
 * Nota su cosa il lettore *non* risolve: `X-Frame-Options`. Quello riguarda il
 * riquadro del Web Viewer, non la lettura — vedi `components/WebViewer.tsx`,
 * che con un lettore configurato smette di incorniciare il sito e disegna la
 * pagina che ha letto.
 */

/** Il segnaposto dell'indirizzo, codificato per stare in un parametro. */
export const READER_TOKEN = "{url}";
/** Lo stesso indirizzo lasciato nudo, per i lettori che se lo aspettano in coda. */
export const READER_TOKEN_RAW = "{url-nudo}";

/**
 * L'indirizzo da chiamare per leggere `url` attraverso `template`, o `null` se
 * non se ne ricava uno valido.
 *
 * Le tre forme in cui i lettori del mondo si presentano, in una riga sola:
 *
 *   - `https://mio-worker.dev/?u={url}` — il segnaposto codificato, la forma
 *     giusta per chi mette l'indirizzo in un parametro;
 *   - `https://mio-proxy.casa/leggi/{url-nudo}` — il segnaposto nudo, per chi lo
 *     vuole come coda del percorso;
 *   - `https://mio-proxy.casa/` — nessun segnaposto: l'indirizzo si attacca in
 *     fondo così com'è, che è come funziona `cors-anywhere` e quasi tutto ciò
 *     che gli somiglia.
 *
 * La terza forma esiste per non costringere nessuno a imparare un vocabolario
 * di segnaposto per incollare un indirizzo che ha già.
 */
export function readerAddress(template: string, url: string): string | null {
  const pattern = template.trim();
  if (!pattern) return null;
  // Solo http(s) in entrata: un `data:` o un `javascript:` non si inoltra a
  // nessuno, e questo è il punto in cui l'indirizzo arriva da fuori.
  if (!isHttp(url)) return null;

  const base = withProtocol(pattern);
  let built: string;
  if (base.includes(READER_TOKEN)) {
    built = base.split(READER_TOKEN).join(encodeURIComponent(url));
  } else if (base.includes(READER_TOKEN_RAW)) {
    built = base.split(READER_TOKEN_RAW).join(url);
  } else {
    built = base + url;
  }

  return isHttp(built) ? built : null;
}

/**
 * Il modello del lettore, costruito da ciò che Cloudflare restituisce dopo il
 * deploy: un indirizzo nudo, tipo `https://qualcosa.tuonome.workers.dev`.
 *
 * Esiste per togliere di mezzo l'unico passaggio in cui si può sbagliare a
 * mano. La forma giusta — `…/?k=parola&u={url}` — ha tre pezzi che vanno
 * scritti nell'ordine e con i simboli giusti, e sbagliarne uno dà un lettore
 * che non risponde e nessun modo di capire perché. Incollato l'indirizzo, il
 * resto lo scrive questa funzione.
 */
export function readerTemplateFor(workerAddress: string, secret: string): string | null {
  const raw = workerAddress.trim();
  if (!raw || !secret) return null;
  let base: string;
  try {
    const parsed = new URL(withProtocol(raw));
    if (!/^https?:$/.test(parsed.protocol) || !parsed.hostname) return null;
    // Solo origine e percorso: quello che Cloudflare dà è un indirizzo nudo, e
    // un eventuale `?` già scritto lì confonderebbe i nostri parametri.
    base = `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, "");
  } catch {
    return null;
  }
  return `${base}/?k=${encodeURIComponent(secret)}&u=${READER_TOKEN}`;
}

/**
 * Una parola segreta per il Worker, diversa su ogni dispositivo.
 *
 * Serve a non lasciare in giro un proxy aperto: senza, chiunque trovi
 * l'indirizzo del Worker può usarlo per scaricare qualunque cosa, e le
 * richieste risultano fatte da chi l'ha acceso. Generarla qui invece di
 * chiederla evita l'unica risposta che si dà quando un campo del genere è
 * vuoto e si ha fretta, cioè `123456`.
 */
export function makeReaderSecret(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function isHttp(url: string): boolean {
  try {
    return /^https?:$/.test(new URL(url).protocol);
  } catch {
    return false;
  }
}

/**
 * La pagina letta, preparata per essere *mostrata* invece che incorniciata.
 *
 * Questa è la risposta a `X-Frame-Options`, che è un problema diverso da CORS e
 * che il lettore da solo non risolve: un sito può vietare di essere messo in un
 * riquadro, e allora il riquadro resta bianco qualunque cosa si faccia. Ma il
 * divieto vale per *quel sito dentro un riquadro* — non per un documento nostro
 * che contiene il testo che abbiamo letto. È la differenza fra incorniciare una
 * pagina e ridisegnarla.
 *
 * Due iniezioni, e nessuna riscrittura del contenuto:
 *
 *   - un `<base>` che punta alla pagina originale, senza il quale ogni immagine,
 *     foglio di stile e collegamento relativo si risolverebbe sul nulla (il
 *     documento non ha un indirizzo suo: vive in un `srcdoc`);
 *   - una riga di stile che spegne i clic sui collegamenti. Un collegamento
 *     premuto qui porterebbe il riquadro sul sito vero, cioè di nuovo contro il
 *     divieto di prima, con l'aria di essersi rotto qualcosa. Per spostarsi
 *     c'è la barra dell'indirizzo, e i collegamenti che il Web Viewer estrae
 *     dalla pagina e mostra come pulsanti suoi.
 *
 * Il `<meta viewport>` si aggiunge solo se non c'è: senza, una pagina scritta
 * per il desktop arriva su un telefono larga il doppio dello schermo.
 *
 * **Da leggere sempre con `sandbox=""`.** In un `srcdoc`, `allow-same-origin`
 * significa *la nostra* origine: HTML di terzi con gli script accesi ci
 * girerebbe dentro casa. Il Web Viewer lo impone e non lo rende scegliibile.
 */
export function readableDocument(html: string, pageUrl: string): string {
  // Un `<base>` già scritto nella pagina vincerebbe sul nostro — è il primo a
  // valere — e punterebbe dove dice lui.
  const body = html.replace(/<base\b[^>]*>/gi, "");
  const viewport = /<meta[^>]+name\s*=\s*["']?viewport/i.test(body)
    ? ""
    : '<meta name="viewport" content="width=device-width, initial-scale=1">';
  const head =
    `<base href="${escapeAttribute(pageUrl)}">` +
    viewport +
    "<style>a,area{pointer-events:none!important}</style>";

  const openHead = body.match(/<head\b[^>]*>/i);
  if (openHead) return body.replace(openHead[0], openHead[0] + head);
  // Senza `<head>` va in testa comunque: il browser costruisce l'albero
  // sistemando quello che trova, e il `<base>` deve valere prima di tutto.
  return head + body;
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** Se un lettore è stato configurato su questo dispositivo. */
export function hasPageReader(): boolean {
  return useSettings.getState().pageReader.trim().length > 0;
}

/**
 * L'indirizzo del lettore per una pagina, letto dalle impostazioni. `null`
 * quando non c'è nessun lettore configurato: il chiamante deve poter dire
 * «direttamente non si può, e non c'è una seconda strada» — che è una risposta
 * diversa da «non si può e basta».
 */
export function readerFor(url: string): string | null {
  return readerAddress(useSettings.getState().pageReader, url);
}
