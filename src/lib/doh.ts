import { RESOLVERS } from "./dnsGuide";
import { withProtocol } from "./linkHost";

/**
 * Risolvere un nome via DNS-over-HTTPS, dal browser.
 *
 * Questa è la sorpresa del livello DNS, ed è il motivo per cui la scheda
 * `dnsGuide.ts` non è rimasta solo documentazione: Cloudflare e Google
 * pubblicano il resolver anche in JSON su HTTPS, **con `Access-Control-Allow-
 * Origin: *`**. Una pagina web può interrogarli. Il DoH binario (RFC 8484,
 * `application/dns-message`) richiederebbe di comporre e leggere un pacchetto
 * DNS a mano; la variante JSON dà lo stesso dato già strutturato, e le due
 * risposte vengono dallo stesso resolver.
 *
 * **Cosa questo non fa, che è la parte che conta.** Non cambia come il browser
 * risolve i nomi: quello lo decide il sistema operativo, o il browser stesso se
 * ha il DoH acceso nelle sue impostazioni. Una pagina non può dirottare la
 * propria risoluzione dei nomi, e nessun `fetch` scritto qui passerà dal
 * resolver interrogato qui.
 *
 * **Cosa fa, che è comunque molto.** Risponde a una domanda che finora l'app
 * poteva solo girare all'utente: *un host che non risponde è spento, o è il
 * nome che non viene tradotto?* Sono due guasti diversi con due rimedi diversi,
 * e prima di questo file l'unica cosa onesta da scrivere era «può essere l'uno o
 * può essere l'altro». Ora l'app lo sa: se un resolver pubblico restituisce un
 * indirizzo e il tuo browser non arriva da nessuna parte, la risoluzione dei
 * nomi che stai usando e quella pubblica non concordano — e la scheda DNS
 * spiega cosa farne.
 */

const DOH_TIMEOUT_MS = 6000;

/** I codici di risposta DNS che vale la pena distinguere (RFC 1035 §4.1.1). */
const RCODE = { NOERROR: 0, SERVFAIL: 2, NXDOMAIN: 3 } as const;

export type DohVerdict =
  /** Il nome esiste e ha un indirizzo. */
  | "risolto"
  /** Il nome non esiste, secondo il resolver pubblico. */
  | "inesistente"
  /** Il nome esiste ma non ha un record di indirizzo. */
  | "senza-indirizzo"
  /** Il resolver ha risposto con un errore proprio. */
  | "errore-resolver"
  /** Non si è riusciti a interrogare il resolver. */
  | "irraggiungibile";

export interface DohResult {
  verdict: DohVerdict;
  /** Gli indirizzi trovati, quando `verdict === "risolto"`. */
  addresses: string[];
  /** Quale resolver ha risposto. */
  resolver: string;
  /** Quanto ci ha messo, in millisecondi. */
  ms: number;
}

/**
 * Gli endpoint JSON. Non sono gli stessi della tabella della scheda: quelli
 * sono gli endpoint DoH standard, `application/dns-message`, che è il protocollo
 * vero e che un browser non sa comporre. Questi due sono la variante JSON che
 * gli stessi due operatori pubblicano accanto, ed è quella che si può chiamare
 * da qui.
 *
 * Solo Cloudflare e Google: sono i due che mandano gli header CORS. Gli altri
 * della tabella servono il DoH standard e vanno benissimo per il dispositivo,
 * ma da una pagina web non si interrogano.
 */
interface JsonResolver {
  name: string;
  url: (name: string, type: string) => string;
  headers?: Record<string, string>;
}

const JSON_RESOLVERS: JsonResolver[] = [
  {
    name: "Cloudflare",
    url: (n, t) => `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(n)}&type=${t}`,
    headers: { Accept: "application/dns-json" },
  },
  {
    name: "Google",
    url: (n, t) => `https://dns.google/resolve?name=${encodeURIComponent(n)}&type=${t}`,
  },
];

/** Quali della tabella si possono interrogare da qui, per la scheda. */
export const JSON_CAPABLE = new Set(
  RESOLVERS.filter((r) => JSON_RESOLVERS.some((j) => r.name.startsWith(j.name))).map((r) => r.name),
);

interface DnsJsonAnswer {
  name: string;
  type: number;
  data: string;
}

interface DnsJsonResponse {
  Status: number;
  Answer?: DnsJsonAnswer[];
}

/** Il nome di dominio nudo, da qualunque cosa l'utente abbia scritto. */
export function hostnameOf(input: string): string {
  const raw = input.trim();
  if (!raw) return "";
  try {
    return new URL(withProtocol(raw)).hostname;
  } catch {
    // Un nome scritto senza niente intorno è già un nome.
    return /^[a-z0-9.-]+$/i.test(raw) ? raw : "";
  }
}

// A = IPv4 (1), AAAA = IPv6 (28). Si chiede A: un sito senza IPv4 è raro
// abbastanza da non giustificare due richieste per ogni controllo, e la
// domanda a cui questo file risponde è "questo nome si traduce in qualcosa",
// non "in quante famiglie di indirizzi".
const TYPE_A = 1;

async function askOne(resolver: JsonResolver, name: string, signal?: AbortSignal): Promise<DohResult> {
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOH_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    const res = await fetch(resolver.url(name, "A"), {
      headers: resolver.headers,
      signal: controller.signal,
      cache: "no-store",
      referrerPolicy: "no-referrer",
    });
    const ms = Math.round(performance.now() - started);
    if (!res.ok) return { verdict: "irraggiungibile", addresses: [], resolver: resolver.name, ms };

    const body = (await res.json()) as DnsJsonResponse;
    const addresses = (body.Answer ?? []).filter((a) => a.type === TYPE_A).map((a) => a.data);

    if (body.Status === RCODE.NXDOMAIN) {
      return { verdict: "inesistente", addresses: [], resolver: resolver.name, ms };
    }
    if (body.Status !== RCODE.NOERROR) {
      return { verdict: "errore-resolver", addresses: [], resolver: resolver.name, ms };
    }
    return {
      verdict: addresses.length ? "risolto" : "senza-indirizzo",
      addresses,
      resolver: resolver.name,
      ms,
    };
  } catch {
    return {
      verdict: "irraggiungibile",
      addresses: [],
      resolver: resolver.name,
      ms: Math.round(performance.now() - started),
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

/**
 * Risolve un nome, chiedendo a Cloudflare e ripiegando su Google.
 *
 * In sequenza e non in parallelo: la seconda richiesta serve solo quando la
 * prima non è arrivata a destinazione, e sparare a entrambi ogni volta
 * raddoppierebbe le richieste per non aggiungere niente nel caso normale. Un
 * *disaccordo* fra i due sarebbe interessante, ma è raro abbastanza da non
 * pagarlo su ogni controllo — `resolveEverywhere` esiste per quando lo si
 * vuole davvero.
 */
export async function resolveName(input: string, signal?: AbortSignal): Promise<DohResult> {
  const name = hostnameOf(input);
  if (!name) return { verdict: "irraggiungibile", addresses: [], resolver: "—", ms: 0 };

  for (const resolver of JSON_RESOLVERS) {
    if (signal?.aborted) break;
    const result = await askOne(resolver, name, signal);
    if (result.verdict !== "irraggiungibile") return result;
  }
  return { verdict: "irraggiungibile", addresses: [], resolver: "—", ms: 0 };
}

/**
 * Lo stesso nome su tutti i resolver interrogabili, in parallelo. Serve alla
 * scheda DNS, dove il confronto *è* il punto: due resolver pubblici che danno
 * risposte diverse per lo stesso nome è esattamente ciò che si sta cercando di
 * vedere.
 */
export async function resolveEverywhere(input: string, signal?: AbortSignal): Promise<DohResult[]> {
  const name = hostnameOf(input);
  if (!name) return [];
  return Promise.all(JSON_RESOLVERS.map((r) => askOne(r, name, signal)));
}

export const DOH_LABEL: Record<DohVerdict, string> = {
  risolto: "Il nome si risolve",
  inesistente: "Il nome non esiste",
  "senza-indirizzo": "Il nome esiste ma non ha indirizzo",
  "errore-resolver": "Il resolver ha risposto con un errore",
  irraggiungibile: "Non ho potuto chiedere",
};
