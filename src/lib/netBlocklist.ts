/**
 * La lista nera di rete, in un posto solo.
 *
 * È l'equivalente della blacklist che un'app nativa carica all'avvio e
 * confronta dentro `shouldInterceptRequest`. Qui la stessa lista serve tre
 * consumatori diversi, e per questo sta in un modulo suo invece che dentro a
 * uno dei tre:
 *
 *   1. il **service worker** (`public/sw.js`), che è il punto in cui una
 *      richiesta si può davvero fermare prima che parta — vedi sotto;
 *   2. l'**estrazione** (`lib/streamExtract.ts`), che scarta i manifest
 *      pubblicitari invece di rischiare di mandarne uno al lettore;
 *   3. lo **script iniettato** (`lib/hookedFrame.ts`), che la applica dentro
 *      alla pagina aperta in lettura hookata.
 *
 * Il worker non può importare da qui — è un file a sé, servito così com'è, non
 * passa dal bundler — quindi la lista gli viene mandata con un `postMessage` a
 * ogni avvio (vedi `lib/serviceWorker.ts`). Una copia incollata nel worker
 * sarebbe andata fuori sincrono al primo aggiornamento.
 */

/**
 * Domini di reti pubblicitarie, di tracciamento e di malvertising.
 *
 * Sono nomi di rete, non di siti: bloccarne uno non rende inaccessibile nessuna
 * pagina, toglie solo quello che quella pagina carica da terzi. La lista è
 * corta e curata a mano invece di essere un file host da centomila righe scaricato
 * all'avvio: le liste enormi servono a un browser che deve coprire tutto il web,
 * mentre qui il traffico da filtrare è quello di un'app che sa già cosa chiede,
 * più le pagine che apri nel Web Viewer. Trenta domini coprono la quasi totalità
 * di quel traffico e costano un `Set` invece di un download e di un parser.
 */
export const BLOCKED_HOSTS: string[] = [
  // Reti display e ad exchange
  "doubleclick.net",
  "googlesyndication.com",
  "googleadservices.com",
  "adservice.google.com",
  "imasdk.googleapis.com",
  "amazon-adsystem.com",
  "adnxs.com",
  "adsrvr.org",
  "rubiconproject.com",
  "pubmatic.com",
  "openx.net",
  "criteo.com",
  "casalemedia.com",
  "onetag-sys.com",
  "smartadserver.com",
  "serving-sys.com",
  "3lift.com",
  "sharethrough.com",
  // Video ad server e VAST
  "spotxchange.com",
  "springserve.com",
  "tremorhub.com",
  "innovid.com",
  // Tracciamento e analytics
  "google-analytics.com",
  "googletagservices.com",
  "scorecardresearch.com",
  "moatads.com",
  "quantserve.com",
  "hotjar.com",
  "mixpanel.com",
  // Raccomandazione a pagamento
  "taboola.com",
  "outbrain.com",
  "revcontent.com",
  "mgid.com",
  // Pop-under e malvertising, il genere che rende inguardabili quelle pagine
  "popads.net",
  "popcash.net",
  "propellerads.com",
  "exoclick.com",
  "juicyads.com",
  "hilltopads.net",
  "adsterra.com",
  "poweredby.jads.co",
  "clickadu.com",
  "trafficjunky.com",
];

/**
 * Se un indirizzo appartiene a un dominio bloccato.
 *
 * Il confronto è sul nome esatto o su un suo sottodominio, mai su
 * sottostringa: `notdoubleclick.net` non è `doubleclick.net`, e un filtro che
 * non facesse questa distinzione bloccherebbe domini innocenti perché
 * contengono le lettere giuste.
 */
export function isBlockedUrl(url: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return isBlockedHost(hostname);
}

export function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return BLOCKED_HOSTS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`));
}
