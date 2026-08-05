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

/**
 * Come è fatto il sito: si interroga la sua ricerca, o si costruisce
 * direttamente l'indirizzo della scheda?
 *
 * Sono due strutture diverse e vanno provate diversamente. Un sito con la
 * ricerca risponde a `/?s=inception+2010`; uno a percorsi diretti pubblica la
 * scheda a `/film/interstellar-2014/` e una ricerca non ce l'ha proprio. Il
 * valore predefinito le prova entrambe perché a monte non si sa quale sia, ma
 * chi conosce il proprio sito può dimezzare i tentativi.
 */
export type LayoutFamily = "entrambi" | "ricerca" | "percorso";

export const LAYOUT_FAMILIES: { id: LayoutFamily; label: string; hint: string }[] = [
  { id: "entrambi", label: "Provali entrambi", hint: "Prima la ricerca del sito, poi i percorsi diretti." },
  { id: "ricerca", label: "Solo la ricerca", hint: "/?s=… , /search?q=… — il sito ha una casella di ricerca." },
  { id: "percorso", label: "Solo i percorsi", hint: "/film/titolo-anno/ , /serie/titolo/stagione-2/episodio-5/ — la scheda ha un indirizzo prevedibile." },
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
  /** Quali famiglie di percorsi provare. Assente sui record più vecchi. */
  layout?: LayoutFamily;
  /**
   * Manda i cookie di sessione alle richieste verso questo sito
   * (`credentials: "include"`).
   *
   * È l'unico dei quattro header di sessione che un'app nativa riusa —
   * `Cookie`, `Referer`, `Origin`, `User-Agent` — ad avere un equivalente qui.
   * Gli altri tre sono *forbidden headers*: il browser se li riserva e `fetch`
   * rifiuta di impostarli, quindi un sito che controlla il `Referer` per
   * bloccare l'hotlinking non si serve da una pagina web, punto. I cookie
   * invece il browser li ha già — se il sito l'hai aperto nel Web Viewer, la
   * sessione sta nel suo barattolo — e chiederglieli è legittimo.
   *
   * Spento di default: `credentials: "include"` richiede che il sito risponda
   * con `Access-Control-Allow-Credentials` e con un `Allow-Origin` esatto
   * invece di `*`, e senza quelli la richiesta **fallisce dove prima
   * funzionava**. Va acceso quando serve, non per scaramanzia.
   */
  sendCookies?: boolean;
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

/**
 * Quale episodio chiedere al sito.
 *
 * La libreria conta gli episodi visti come un totale unico, non per stagione:
 * `seen: 27` non dice se sia la stagione 2 episodio 3 o la stagione 3 episodio
 * 1, e nessun calcolo lo ricava senza inventare. Quindi il valore predefinito è
 * l'unica cosa onesta — stagione 1, episodio `visti + 1` — **ed è
 * sovrascrivibile**: il pannello Siti del player ha due caselle, e per una
 * serie oltre la prima stagione basta scriverci dentro.
 *
 * Senza questa possibilità i percorsi gerarchici del tipo
 * `/serie/the-boys/stagione-3/episodio-1/` non sarebbero mai stati
 * raggiungibili, perché il `3` non c'era da nessuna parte.
 */
export interface EpisodePosition {
  season: number;
  episode: number;
}

export function defaultPosition(item: Item): EpisodePosition {
  return { season: 1, episode: (item.seen || 0) + 1 };
}

function positionFor(item: Item, override?: Partial<EpisodePosition>): EpisodePosition {
  const base = defaultPosition(item);
  return {
    season: override?.season && override.season > 0 ? Math.floor(override.season) : base.season,
    episode: override?.episode && override.episode > 0 ? Math.floor(override.episode) : base.episode,
  };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** `S02E05`, la forma che quasi ogni sito riconosce. */
export function episodeTag(item: Item, position?: Partial<EpisodePosition>): string {
  const { season, episode } = positionFor(item, position);
  return `S${pad(season)}E${pad(episode)}`;
}

/** `2x05`, l'altra notazione diffusa. */
export function episodeTagX(item: Item, position?: Partial<EpisodePosition>): string {
  const { season, episode } = positionFor(item, position);
  return `${season}x${pad(episode)}`;
}

/**
 * I metadati messi in fila, così come li leggerebbe un umano nella casella di
 * ricerca del sito. Da qui in poi è solo questione di come vanno codificati.
 *
 * L'episodio si aggiunge solo a ciò che ne ha uno: `Il Padrino S01E01` è una
 * ricerca che non trova niente, e la ricetta «completo» su un film deve
 * comportarsi come «titolo e anno» invece che sporcare la domanda.
 */
export function buildQuery(
  item: Item,
  recipe: QueryRecipe,
  position?: Partial<EpisodePosition>,
): string {
  const parts = [item.title.trim()];
  const wantsYear = recipe === "titolo-anno" || recipe === "completo";
  const wantsEpisode = recipe === "titolo-episodio" || recipe === "completo";
  if (wantsYear && item.year) parts.push(String(item.year));
  if (wantsEpisode && item.kind !== "film") parts.push(episodeTag(item, position));
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
  { token: "{s}", label: "Stagione — 1, o quella scritta nel pannello Siti", example: "2" },
  { token: "{e}", label: "Episodio: il prossimo da vedere, o quello scritto", example: "5" },
  { token: "{ss}", label: "Stagione a due cifre", example: "02" },
  { token: "{ee}", label: "Episodio a due cifre", example: "05" },
  { token: "{sxe}", label: "L'altra notazione diffusa", example: "2x05" },
  { token: "{sNeN}", label: "La notazione compatta", example: "S02E05" },
];

/** Riempie un modello di ricerca con i metadati del titolo. */
export function fillSearchPattern(
  pattern: string,
  item: Item,
  recipe: QueryRecipe,
  position?: Partial<EpisodePosition>,
): string {
  const query = buildQuery(item, recipe, position);
  const { season, episode } = positionFor(item, position);
  let out = pattern;
  for (const [token, encode] of Object.entries(ENCODERS)) {
    // I segnaposto sono letterali con le graffe: `split`/`join` evita di
    // costruire una regex intorno a `{query+}`, dove il `+` andrebbe protetto.
    out = out.split(token).join(encode(query));
  }
  return (
    out
      .replace(/\{titolo\}/gi, encodeURIComponent(item.title))
      .replace(/\{slug\}/gi, slugify(item.title))
      .replace(/\{anno\}/gi, item.year ? String(item.year) : "")
      .replace(/\{tmdb\}/gi, item.tmdbId == null ? "" : String(item.tmdbId))
      // I composti prima dei semplici: `{sNeN}` contiene `{s}` come
      // sottostringa solo se lo si sostituisce nell'ordine sbagliato.
      .replace(/\{sNeN\}/gi, `S${pad(season)}E${pad(episode)}`)
      .replace(/\{sxe\}/gi, `${season}x${pad(episode)}`)
      .replace(/\{ss\}/gi, pad(season))
      .replace(/\{ee\}/gi, pad(episode))
      .replace(/\{s\}/gi, String(season))
      .replace(/\{e\}/gi, String(episode))
  );
}

const QUERY_PLACEHOLDER = /\{(query[+-]?|titolo|slug|anno|tmdb|sNeN|sxe|ss|ee|s|e)\}/i;

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
 * I percorsi diretti alla scheda, per i siti che non hanno una ricerca da
 * interrogare ma un indirizzo prevedibile.
 *
 * Sono più fragili delle ricerche — un solo carattere di differenza nello slug
 * e il percorso è un 404, mentre una ricerca perdona — ma quando indovinano
 * saltano un passaggio intero: la pagina del titolo si apre direttamente, senza
 * leggere prima quella dei risultati.
 */
export const FILM_PATH_LAYOUTS = [
  "/film/{slug}-{anno}/",
  "/film/{slug}/",
  "/movie/{slug}-{anno}/",
  "/movies/{slug}/",
  "/{slug}-{anno}/",
  "/{slug}/",
];

/**
 * Gli stessi per qualcosa con episodi, e qui la nidificazione è il punto: un
 * sito che pubblica per stagione ed episodio ha un percorso a più livelli, e
 * `{s}`/`{e}` ci vanno dentro. La stagione la scrivi tu nel pannello Siti
 * quando non è la prima — vedi `EpisodePosition`.
 */
export const EPISODE_PATH_LAYOUTS = [
  "/serie/{slug}/stagione-{s}/episodio-{e}/",
  "/serie/{slug}/{s}x{ee}/",
  "/serie/{slug}-{sNeN}/",
  "/tv/{slug}/season-{s}/episode-{e}/",
  "/tv/{slug}/{sNeN}/",
  "/{slug}/stagione-{s}/episodio-{e}/",
  "/{slug}/{sNeN}/",
  "/episodio/{slug}-{sxe}/",
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
export function searchUrlsFor(
  host: LinkHost,
  item: Item,
  position?: Partial<EpisodePosition>,
): string[] {
  const address = host.url.trim();
  if (!address) return [];

  if (hasQueryPlaceholder(address)) {
    const url = fillSearchPattern(withProtocol(address), item, host.recipe, position);
    return isHttpUrl(url) ? [url] : [];
  }

  const root = normalizeSite(address);
  if (!root) return [];

  const seen = new Set<string>();
  const out: string[] = [];
  for (const layout of layoutsFor(host, item)) {
    const path = fillSearchPattern(layout, item, host.recipe, position);
    const url = `${root}${path.startsWith("/") ? "" : "/"}${path}`;
    if (!isHttpUrl(url) || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

/**
 * Quali percorsi provare, e in che ordine.
 *
 * La ricerca viene prima dei percorsi diretti anche quando si provano entrambi:
 * perdona gli slug approssimativi, e uno slug approssimativo è la norma appena
 * un titolo ha un sottotitolo, un numero romano o un accento. I percorsi
 * diretti sono la seconda mano — più veloci quando indovinano, muti quando no.
 */
function layoutsFor(host: LinkHost, item: Item): string[] {
  if (host.searchPattern.trim()) return [host.searchPattern.trim()];
  const paths = item.kind === "film" ? FILM_PATH_LAYOUTS : EPISODE_PATH_LAYOUTS;
  switch (host.layout ?? "entrambi") {
    case "ricerca":
      return SEARCH_LAYOUTS;
    case "percorso":
      return paths;
    default:
      return [...SEARCH_LAYOUTS, ...paths];
  }
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
  seen: 4,
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
