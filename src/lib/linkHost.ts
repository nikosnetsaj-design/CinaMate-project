import type { Item } from "../types";
import { slugify } from "./sourceTemplate";

/**
 * Il **Link Host**: l'indirizzo di un *sito* su cui cercare, invece
 * dell'indirizzo di una *cartella* da cui leggere.
 *
 * È la differenza con `lib/sourceTemplate.ts`, ed è tutta la ragione per cui
 * questo file esiste separato. Là l'indirizzo è il tuo server e il titolo
 * diventa un percorso — `mio-server/film/il-padrino.m3u8`. Qui l'indirizzo è un
 * sito con una sua ricerca, e il titolo diventa una *domanda*:
 * `sito.tld/?s=Il%20Padrino%201972`. La prima strada indovina dove sta il file;
 * la seconda chiede al sito di dirtelo.
 *
 * Come là, gli indirizzi non stanno nel codice. CineMate non ne conosce
 * nessuno, non ne propone nessuno e non ne contiene nessuno: la lista è vuota
 * finché non ci scrivi qualcosa tu, e quello che ci scrivi resta su questo
 * dispositivo.
 */

/** Quanto del titolo finisce nella domanda. */
export type QueryRecipe = "titolo" | "titolo-anno" | "titolo-episodio" | "completo";

export const QUERY_RECIPES: { id: QueryRecipe; label: string; hint: string }[] = [
  { id: "titolo", label: "Solo il titolo", hint: "Il Padrino" },
  { id: "titolo-anno", label: "Titolo e anno", hint: "Il Padrino 1972" },
  { id: "titolo-episodio", label: "Titolo ed episodio", hint: "Breaking Bad S01E04" },
  { id: "completo", label: "Tutto", hint: "Breaking Bad 2008 S01E04" },
];

export interface LinkHost {
  id: string;
  /** Come lo chiami tu. Serve solo a distinguerlo nell'elenco. */
  name: string;
  /** L'indirizzo che hai scritto: nudo (`https://sito.tld`) o con `{query}`. */
  url: string;
  /**
   * Il percorso della ricerca, quando lo conosci: `/?s={query+}`.
   * Vuoto significa «provali tu» — vedi `SEARCH_LAYOUTS`.
   */
  searchPattern: string;
  recipe: QueryRecipe;
  enabled: boolean;
  addedAt: number;
  /**
   * L'indirizzo a cui il sito ha risposto l'ultima volta che è stato
   * controllato, quando è diverso da `url`. Vedi `lib/hostRedirect.ts`: non
   * viene mai applicato da solo, è una proposta che devi accettare.
   */
  movedTo?: string;
  lastCheckedAt?: number;
}

// ---------------------------------------------------------------------------
// Concatenazione dei metadati
// ---------------------------------------------------------------------------

// La libreria conta gli episodi visti come un totale unico, non per stagione,
// quindi non esiste un modo onesto di ricavarne la stagione corrente. `{s}` è
// un 1 fisso — stessa scelta, e stessa ragione, di `lib/sourceTemplate.ts`.
const SEASON = 1;

function episodeOf(item: Item): number {
  return (item.seen || 0) + 1;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** `S01E04`, la forma che quasi ogni sito riconosce. */
export function episodeTag(item: Item): string {
  return `S${pad(SEASON)}E${pad(episodeOf(item))}`;
}

/**
 * I metadati messi in fila, così come li leggerebbe un umano nella casella di
 * ricerca del sito. Da qui in poi è solo questione di come vanno codificati.
 *
 * L'episodio si aggiunge solo a ciò che ne ha uno: `Il Padrino S01E01` è una
 * ricerca che non trova niente, e la ricetta «completo» su un film deve
 * comportarsi come «titolo e anno» invece che sporcare la domanda.
 */
export function buildQuery(item: Item, recipe: QueryRecipe): string {
  const parts = [item.title.trim()];
  const wantsYear = recipe === "titolo-anno" || recipe === "completo";
  const wantsEpisode = recipe === "titolo-episodio" || recipe === "completo";
  if (wantsYear && item.year) parts.push(String(item.year));
  if (wantsEpisode && item.kind !== "film") parts.push(episodeTag(item));
  return parts.filter(Boolean).join(" ");
}

/**
 * Le tre codifiche, perché i siti non sono d'accordo fra loro: chi vuole la
 * domanda in un parametro con i `+`, chi la vuole percentuale, chi la vuole
 * come segmento di percorso con i trattini. Il segnaposto che scrivi nel
 * modello decide quale delle tre, e sono tutte e tre lo stesso testo.
 */
const ENCODERS: Record<string, (raw: string) => string> = {
  "{query}": (raw) => encodeURIComponent(raw),
  "{query+}": (raw) => encodeURIComponent(raw).replace(/%20/g, "+"),
  "{query-}": (raw) => slugify(raw),
};

export interface TokenDoc {
  token: string;
  label: string;
  example: string;
}

export const LINK_HOST_TOKENS: TokenDoc[] = [
  { token: "{query}", label: "I metadati concatenati, codificati", example: "Il%20Padrino%201972" },
  { token: "{query+}", label: "Gli stessi, con i più al posto degli spazi", example: "Il+Padrino+1972" },
  { token: "{query-}", label: "Gli stessi, come segmento di percorso", example: "il-padrino-1972" },
  { token: "{titolo}", label: "Solo il titolo, codificato", example: "Il%20Padrino" },
  { token: "{slug}", label: "Solo il titolo, coi trattini", example: "il-padrino" },
  { token: "{anno}", label: "Anno di uscita", example: "1972" },
  { token: "{tmdb}", label: "Id TMDB, quando il titolo è collegato", example: "238" },
  { token: "{s}", label: "Stagione — sempre 1: la libreria conta gli episodi, non le stagioni", example: "1" },
  { token: "{e}", label: "Episodio: il prossimo da vedere", example: "4" },
  { token: "{ss}", label: "Stagione a due cifre", example: "01" },
  { token: "{ee}", label: "Episodio a due cifre", example: "04" },
];

/** Riempie un modello di ricerca con i metadati del titolo. */
export function fillSearchPattern(pattern: string, item: Item, recipe: QueryRecipe): string {
  const query = buildQuery(item, recipe);
  let out = pattern;
  for (const [token, encode] of Object.entries(ENCODERS)) {
    // I segnaposto sono letterali con le graffe: `split`/`join` evita di
    // costruire una regex intorno a `{query+}`, dove il `+` andrebbe protetto.
    out = out.split(token).join(encode(query));
  }
  return out
    .replace(/\{titolo\}/gi, encodeURIComponent(item.title))
    .replace(/\{slug\}/gi, slugify(item.title))
    .replace(/\{anno\}/gi, item.year ? String(item.year) : "")
    .replace(/\{tmdb\}/gi, item.tmdbId == null ? "" : String(item.tmdbId))
    .replace(/\{ss\}/gi, pad(SEASON))
    .replace(/\{ee\}/gi, pad(episodeOf(item)))
    .replace(/\{s\}/gi, String(SEASON))
    .replace(/\{e\}/gi, String(episodeOf(item)));
}

const QUERY_PLACEHOLDER = /\{(query[+-]?|titolo|slug|anno|tmdb|ss|ee|s|e)\}/i;

/** Se l'indirizzo dice già dov'è la domanda, o è solo il sito. */
export function hasQueryPlaceholder(address: string): boolean {
  return QUERY_PLACEHOLDER.test(address);
}

/**
 * I percorsi di ricerca provati quando non ne hai scritto uno, dal più comune
 * al più raro.
 *
 * L'ordine non è un'opinione: `?s=` è WordPress, che è quello che c'è sotto la
 * maggioranza dei siti scritti da qualcun altro; `search?q=` è quello che
 * scrive chiunque parta da zero. Il resto sono varianti che si incontrano, e
 * l'ultima è per i siti italiani che hanno tradotto anche la rotta.
 */
export const SEARCH_LAYOUTS = [
  "/?s={query+}",
  "/search?q={query+}",
  "/?q={query+}",
  "/search/{query-}",
  "/search?query={query+}",
  "/ricerca?q={query+}",
  "/cerca/{query-}",
  "/cerca?q={query+}",
];

/**
 * `sito.tld` scritto nella casella significa `https://sito.tld`. Nessuno scrive
 * il protocollo, e un indirizzo senza non è un URL: la casella resterebbe
 * silenziosamente inerte, che è la risposta peggiore possibile.
 */
export function withProtocol(address: string): string {
  const raw = address.trim();
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
}

/** L'indirizzo senza barre finali, pronto per appenderci un percorso. */
export function normalizeSite(address: string): string {
  const withScheme = withProtocol(address);
  try {
    if (!new URL(withScheme).hostname) return "";
  } catch {
    return "";
  }
  return withScheme.replace(/\/+$/, "");
}

/** Solo `http(s)`: questi indirizzi finiscono in `fetch` e in un iframe. */
function isHttpUrl(url: string): boolean {
  try {
    return /^https?:$/.test(new URL(url).protocol);
  } catch {
    return false;
  }
}

/**
 * Tutti gli indirizzi di ricerca da provare per un titolo su un host, in
 * ordine. Un modello scritto da te ne dà uno solo — sai già com'è fatta quella
 * ricerca, provarne altri otto sarebbe rumore. Un indirizzo nudo li dà tutti.
 */
export function searchUrlsFor(host: LinkHost, item: Item): string[] {
  const address = host.url.trim();
  if (!address) return [];

  if (hasQueryPlaceholder(address)) {
    const url = fillSearchPattern(withProtocol(address), item, host.recipe);
    return isHttpUrl(url) ? [url] : [];
  }

  const root = normalizeSite(address);
  if (!root) return [];

  const layouts = host.searchPattern.trim()
    ? [host.searchPattern.trim()]
    : SEARCH_LAYOUTS;

  const seen = new Set<string>();
  const out: string[] = [];
  for (const layout of layouts) {
    const path = fillSearchPattern(layout, item, host.recipe);
    const url = `${root}${path.startsWith("/") ? "" : "/"}${path}`;
    if (!isHttpUrl(url) || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

/** L'indirizzo effettivo dell'host: quello nuovo se ne ha traslocato uno. */
export function effectiveUrl(host: LinkHost): string {
  return (host.movedTo || host.url).trim();
}

/** Il nome di dominio, per le etichette. */
export function hostLabel(address: string): string {
  try {
    return new URL(withProtocol(address)).hostname.replace(/^www\./, "");
  } catch {
    return address;
  }
}

const SAMPLE: Pick<Item, "title" | "year" | "tmdbId" | "seen" | "kind"> = {
  title: "Il Padrino",
  year: 1972,
  tmdbId: 238,
  seen: 3,
  kind: "film",
};

const SAMPLE_SERIES: Pick<Item, "title" | "year" | "tmdbId" | "seen" | "kind"> = {
  title: "Breaking Bad",
  year: 2008,
  tmdbId: 1396,
  seen: 3,
  kind: "serie",
};

/**
 * L'anteprima sotto la casella. Un titolo con episodi quando la ricetta ne
 * usa uno, altrimenti un film: mostrare `Il Padrino S01E04` per spiegare
 * «titolo ed episodio» insegnerebbe la cosa sbagliata.
 */
export function previewSearchUrl(host: LinkHost): string {
  const sample = host.recipe === "titolo" || host.recipe === "titolo-anno" ? SAMPLE : SAMPLE_SERIES;
  return searchUrlsFor(host, sample as Item)[0] ?? "";
}

/** Quanti indirizzi prova, così «ne provo altri» non è una promessa vaga. */
export function previewSearchCount(host: LinkHost): number {
  const sample = host.recipe === "titolo" || host.recipe === "titolo-anno" ? SAMPLE : SAMPLE_SERIES;
  return searchUrlsFor(host, sample as Item).length;
}
