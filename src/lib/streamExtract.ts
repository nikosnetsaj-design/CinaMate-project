import type { Item } from "../types";
import { slugify } from "./sourceTemplate";

/**
 * Isolare il flusso da una pagina: leggerne il sorgente e tirarne fuori
 * l'indirizzo `.m3u8` che il lettore della pagina userebbe.
 *
 * Nessuna magia e nessun motore di ricerca: è testo. Un manifest HLS finisce
 * nella pagina in tre forme sole — un `<source src>`, una stringa dentro alla
 * configurazione di un player JavaScript, o un pezzo di JSON — e tutte e tre
 * contengono la stessa sottostringa `.m3u8`. Il lavoro vero è ripulire le due
 * codifiche con cui quella stringa arriva (`\/` del JSON, `&amp;` dell'HTML) e
 * decidere quale indirizzo prendere quando ce n'è più d'uno.
 *
 * **Il limite, che è grosso e va detto qui.** Questo gira in un browser, non in
 * una WebView di un'app nativa: leggere il sorgente di una pagina di un altro
 * dominio richiede che quel dominio mandi gli header CORS, e i siti non li
 * mandano. Su un tuo host — la tua pagina, il tuo server, un tuo Jellyfin
 * dietro un reverse proxy che aggiunge l'header — funziona. Su un sito di
 * terzi quasi sempre no, e il chiamante riceve `bloccato-cors` invece di un
 * fallimento generico, perché la risposta giusta in quel caso è «aprilo nel
 * Web Viewer», non «riprova».
 */

/** Quanto sorgente si legge. Una pagina è ~200 KB; oltre è un file. */
const MAX_PAGE_BYTES = 900_000;
const PAGE_TIMEOUT_MS = 8000;

export type FetchFailure = "bloccato-cors" | "non-raggiungibile" | "non-e-una-pagina";

export type PageResult =
  | { ok: true; html: string; finalUrl: string }
  | { ok: false; reason: FetchFailure };

/**
 * Scarica una pagina come testo.
 *
 * `fetch` fallisce con lo stesso `TypeError` opaco sia per CORS sia per un
 * server spento — il browser lo fa apposta, per non trasformare la fetch in
 * uno scanner di porte. Quindi non si distingue *dal fallimento*: si distingue
 * da un secondo tentativo in `no-cors`, che una risposta opaca la ottiene
 * comunque se qualcosa dall'altra parte c'è. Risposta opaca = il sito è vivo e
 * ci ha detto di no; niente = il sito non c'è.
 */
export async function readPage(url: string, signal?: AbortSignal): Promise<PageResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      redirect: "follow",
      // Molti siti servono una pagina diversa a chi arriva da fuori. Non
      // mandare il referrer è anche la scelta più discreta.
      referrerPolicy: "no-referrer",
    });
    if (!res.ok) return { ok: false, reason: "non-raggiungibile" };
    const type = res.headers.get("content-type") ?? "";
    if (type && !/text\/|json|xml/i.test(type)) return { ok: false, reason: "non-e-una-pagina" };
    const html = (await res.text()).slice(0, MAX_PAGE_BYTES);
    return { ok: true, html, finalUrl: res.url || url };
  } catch {
    return { ok: false, reason: (await isAlive(url, signal)) ? "bloccato-cors" : "non-raggiungibile" };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

/** Se qualcosa risponde a quell'indirizzo, anche senza lasciarcelo leggere. */
async function isAlive(url: string, signal?: AbortSignal): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    await fetch(url, { mode: "no-cors", signal: controller.signal, cache: "no-store", referrerPolicy: "no-referrer" });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

// ---------------------------------------------------------------------------
// Estrazione del flusso
// ---------------------------------------------------------------------------

/**
 * Le due codifiche con cui un indirizzo arriva dentro una pagina, disfatte.
 * `\/` è JSON incorporato in uno `<script>`; `/` è la stessa cosa scritta
 * dai serializzatori che scappano anche le barre; `&amp;` è HTML, e senza
 * questo passaggio ogni indirizzo con più di un parametro esce rotto.
 */
function unescapeUrls(text: string): string {
  return text
    .replace(/\\u002[fF]/g, "/")
    .replace(/\\\//g, "/")
    .replace(/&amp;/gi, "&");
}

const ABSOLUTE_MANIFEST = /https?:\/\/[^\s"'<>\\)\]]+\.m3u8[^\s"'<>\\)\]]*/gi;
const QUOTED_RELATIVE = /["'](\/[^"'<>\s]+\.m3u8[^"'<>\s]*)["']/gi;
const ABSOLUTE_OTHER = /https?:\/\/[^\s"'<>\\)\]]+\.(mpd|mp4)[^\s"'<>\\)\]]*/gi;

export interface FoundStream {
  url: string;
  /** `hls` è quello che il lettore sa suonare; gli altri sono ripieghi. */
  kind: "hls" | "dash" | "file";
}

/**
 * Quale manifest prendere quando la pagina ne contiene più d'uno.
 *
 * Succede sempre: un player HLS serio pubblica il master e le varianti, e a
 * volte anche l'anteprima o la pubblicità pre-roll. Il master è quello giusto —
 * è quello che porta con sé tutte le qualità e le tracce audio — quindi il nome
 * lo dice quasi sempre, e quando non lo dice vale la regola opposta: un
 * indirizzo che nomina una risoluzione (`720p/index.m3u8`) è una variante, non
 * il master, e va sotto.
 */
function scoreManifest(url: string): number {
  const lower = url.toLowerCase();
  let score = 0;
  if (/\bmaster\b/.test(lower)) score += 6;
  if (/\bplaylist\b/.test(lower)) score += 3;
  if (/\bindex\b/.test(lower)) score += 2;
  if (/\b(240|360|480|720|1080|2160)p?\b/.test(lower)) score -= 3;
  if (/\b(ad|ads|advert|preroll|promo|trailer|teaser)\b/.test(lower)) score -= 8;
  if (lower.startsWith("https://")) score += 1;
  // Un indirizzo firmato (token, scadenza) è quello che il sito userebbe
  // davvero: quello nudo accanto è spesso un esempio nella configurazione.
  if (/[?&](token|expires|signature|hash|md5)=/.test(lower)) score += 2;
  return score;
}

/**
 * Ogni flusso che una pagina nomina, dal più probabile al meno.
 *
 * `pageUrl` serve a risolvere i relativi: metà dei player scrive
 * `/hls/xyz/master.m3u8` e senza la base quell'indirizzo non è raggiungibile.
 */
export function streamsIn(html: string, pageUrl: string): FoundStream[] {
  const text = unescapeUrls(html);
  const seen = new Set<string>();
  const hls: { url: string; score: number }[] = [];
  const others: FoundStream[] = [];

  const add = (raw: string, kind: FoundStream["kind"]) => {
    let absolute: string;
    try {
      absolute = new URL(raw, pageUrl).toString();
      if (!/^https?:$/.test(new URL(absolute).protocol)) return;
    } catch {
      return;
    }
    if (seen.has(absolute)) return;
    seen.add(absolute);
    if (kind === "hls") hls.push({ url: absolute, score: scoreManifest(absolute) });
    else others.push({ url: absolute, kind });
  };

  for (const match of text.matchAll(ABSOLUTE_MANIFEST)) add(match[0], "hls");
  for (const match of text.matchAll(QUOTED_RELATIVE)) add(match[1], "hls");
  for (const match of text.matchAll(ABSOLUTE_OTHER)) {
    add(match[0], /\.mpd/i.test(match[0]) ? "dash" : "file");
  }

  return [
    ...hls.sort((a, b) => b.score - a.score).map((h) => ({ url: h.url, kind: "hls" as const })),
    ...others,
  ];
}

/** Il flusso migliore di una pagina, o niente. */
export function bestStreamIn(html: string, pageUrl: string): FoundStream | null {
  return streamsIn(html, pageUrl)[0] ?? null;
}

// ---------------------------------------------------------------------------
// Dalla pagina dei risultati alla pagina del titolo
// ---------------------------------------------------------------------------

/** Parole su cui vale la pena confrontare — «il», «the», «di» non dicono nulla. */
function significantWords(title: string): string[] {
  return slugify(title)
    .split("-")
    .filter((word) => word.length > 2);
}

const ANCHOR = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]{0,300}?)<\/a>/gi;
const TAGS = /<[^>]+>/g;

/**
 * Quanto un collegamento risponde a un titolo.
 *
 * Il testo del collegamento conta più dell'indirizzo — un sito può scrivere
 * `/watch/48213` e chiamarlo «Il Padrino (1972)» — ma nessuno dei due basta da
 * solo, quindi si guardano tutti e due e vince la somma. La soglia è dura di
 * proposito: **tutte** le parole significative devono esserci da qualche parte,
 * perché mezzo titolo che combacia è il modo in cui si finisce a guardare il
 * film sbagliato.
 */
function scoreLink(href: string, text: string, item: Item): number {
  const label = slugify(text.replace(TAGS, " "));
  const path = slugify(decodeURIComponent(href));
  const words = significantWords(item.title);
  if (!words.length) return 0;

  const inLabel = words.every((w) => label.includes(w));
  const inPath = words.every((w) => path.includes(w));
  if (!inLabel && !inPath) return 0;

  let score = 8 + words.length;
  if (inLabel) score += 5;
  if (inPath) score += 3;
  if (item.year && (label.includes(String(item.year)) || path.includes(String(item.year)))) score += 4;

  if (item.kind !== "film") {
    const ep = String((item.seen || 0) + 1).padStart(2, "0");
    if (new RegExp(`(s01e${ep}|1x${ep}|-e?${ep}(-|$))`).test(path)) score += 6;
  }

  // Le pagine di servizio somigliano a tutto e non sono niente.
  if (/\b(login|register|registrati|accedi|privacy|contatti|dmca|tag|categoria|category|feed|rss)\b/.test(path)) {
    score -= 12;
  }
  // Un percorso corto è la scheda; uno lungo è di solito un commento o un tag.
  return score - Math.min(path.length / 60, 3);
}

export interface FoundLink {
  url: string;
  label: string;
  score: number;
}

/**
 * I collegamenti di una pagina di risultati che sembrano il titolo cercato,
 * dal più convincente al meno. La pagina di partenza è esclusa: un sito che si
 * autolinka manderebbe la ricerca in tondo.
 */
export function titleLinksIn(html: string, pageUrl: string, item: Item, limit = 5): FoundLink[] {
  const found = new Map<string, FoundLink>();
  for (const match of html.matchAll(ANCHOR)) {
    const [, href, inner] = match;
    if (!href || /^(#|javascript:|mailto:|tel:)/i.test(href.trim())) continue;
    let absolute: string;
    try {
      absolute = new URL(href, pageUrl).toString();
      if (!/^https?:$/.test(new URL(absolute).protocol)) continue;
    } catch {
      continue;
    }
    if (absolute === pageUrl) continue;
    const score = scoreLink(href, inner, item);
    if (score <= 0) continue;
    const label = inner.replace(TAGS, " ").replace(/\s+/g, " ").trim().slice(0, 80);
    const existing = found.get(absolute);
    if (!existing || existing.score < score) found.set(absolute, { url: absolute, label, score });
  }
  return [...found.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}
