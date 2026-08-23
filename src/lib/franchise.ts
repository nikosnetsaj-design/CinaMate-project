import type { Item } from "../types";
import type { PartState } from "./sagas";
import type { TmdbFranchiseEntry, TmdbSagaPart } from "./tmdb";

/**
 * La **collezione** di un titolo: tutto quello che sta nella stessa storia,
 * film e serie insieme.
 *
 * TMDB una collezione ce l'ha davvero, ma solo per i film: `belongs_to_collection`
 * tiene insieme i tre Captain America e non sa niente di *The Falcon and the
 * Winter Soldier*. Per le serie non esiste proprio niente — «La casa di carta»,
 * «Berlino», «La casa di carta: Corea» e i due documentari sono cinque schede
 * che non si conoscono fra loro, e chi apre la prima non ha nessun modo di
 * arrivare alle altre. È il buco che questo file chiude.
 *
 * Tre indizi, in ordine di quanto ci si può fidare:
 *
 *   1. **La collezione TMDB**, quando c'è. È un dato, non una somiglianza: i
 *      capitoli li ha messi lì qualcuno che sapeva cosa stava facendo.
 *   2. **La parola chiave che porta il nome del titolo.** Le keyword di TMDB
 *      sono community, e la stragrande maggioranza descrive il *tema*
 *      («rapina», «ostaggi»): quelle non servono e anzi farebbero danno.
 *      Quella che si chiama come il titolo — `la casa de papel` — è un'altra
 *      cosa: è l'etichetta con cui la comunità ha marcato la famiglia, ed è
 *      l'unica strada per arrivare a uno spin-off che ha cambiato nome.
 *   3. **Il nome che comincia uguale.** «La casa di carta: Corea», «La casa di
 *      carta - Il fenomeno»: i seguiti che il nome se lo sono tenuto e che
 *      nessuno ha etichettato. Deve essere un prolungamento a parola intera —
 *      «Berlinale» non è un seguito di «Berlino».
 *
 * Quello che qui **non** si fa è indovinare per somiglianza: due gialli con lo
 * stesso attore non sono una collezione, e metterceli dentro avrebbe reso la
 * sezione un secondo «correlati» con un nome più sicuro di sé. I titoli simili
 * hanno già la loro fila, e dice di essere una proposta.
 */

/** Minuscolo, senza accenti e senza punteggiatura: il confronto fra due nomi. */
export function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Dove finisce il nome della famiglia e comincia quello del capitolo. */
const SUBTITLE = /\s*[:–—]\s+|\s+[-–—]\s+|\s*[:]\s*/;

/**
 * Il nome della famiglia, ricavato dal titolo di un capitolo.
 *
 * «Captain America - Il primo vendicatore» → `captain america`; «Iron Man 3» →
 * `iron man`; «La casa di carta» → sé stesso, che è il caso più comune.
 *
 * Torna `null` quando quello che resta è troppo corto o è una parola sola:
 * cercare `loki` o `dune` in un catalogo di un milione di schede non restituisce
 * una collezione, restituisce un elenco di omonimi — e un elenco di omonimi
 * spacciato per «la collezione» è peggio di nessuna collezione.
 */
export function franchiseRoot(title: string): string | null {
  const head = title.split(SUBTITLE)[0] ?? "";
  const root = fold(head)
    // I numeri di coda sono il capitolo, non la famiglia: arabi («3»), romani
    // («IV») o scritti («parte 2»).
    .replace(/\s+(parte|part|capitolo|chapter|volume|vol|stagione|season)?\s*(\d{1,2}|[ivx]{1,5})$/, "")
    .trim();

  if (root.length < 5) return null;
  const words = root.split(" ").length;
  if (words < 2 && root.length < 10) return null;
  return root;
}

/**
 * Se una parola chiave TMDB è il nome della famiglia invece che un tema.
 *
 * Il confronto passa dai nomi del titolo *e* dalle loro radici, perché il nome
 * italiano e quello originale quasi mai coincidono e la keyword è quasi sempre
 * l'originale: «La casa di carta» non somiglia a `la casa de papel`, ma il suo
 * titolo originale sì.
 */
export function isFranchiseKeyword(keyword: string, aliases: string[]): boolean {
  const k = fold(keyword);
  // Sotto le sei lettere sono parole come «heist» o «crime»: temi, non famiglie.
  if (k.length < 6) return false;

  return aliases.some((alias) => {
    for (const candidate of [fold(alias), franchiseRoot(alias) ?? ""]) {
      if (!candidate) continue;
      if (candidate === k) return true;
      if (candidate.startsWith(`${k} `)) return true;
      if (k.startsWith(`${candidate} `)) return true;
    }
    return false;
  });
}

/** Se un titolo è lo stesso nome, o quel nome più qualcosa. */
export function belongsByTitle(candidate: string, root: string): boolean {
  const c = fold(candidate);
  if (c === root) return true;
  // Parola intera: senza questo «Berlinale» entrerebbe nella collezione di
  // «Berlino», e «It Follows» in quella di «It».
  return c.startsWith(`${root} `);
}

/** I capitoli di una collezione TMDB, nella forma comune a film e serie. */
export function fromSagaParts(parts: TmdbSagaPart[]): TmdbFranchiseEntry[] {
  return parts.map((p) => ({
    tmdbId: p.tmdbId,
    mediaType: "movie" as const,
    kind: "film" as const,
    title: p.title,
    releaseDate: p.releaseDate,
    year: p.year,
    overview: p.overview,
    posterPath: p.posterPath,
    popularity: 0,
  }));
}

export interface FranchiseTarget {
  tmdbId: number | null;
  mediaType: "movie" | "tv" | null;
  title: string;
}

function idOf(entry: { mediaType: string; tmdbId: number }): string {
  return `${entry.mediaType}:${entry.tmdbId}`;
}

/** Se una voce è il titolo da cui si è aperta la collezione. */
export function isCurrent(entry: TmdbFranchiseEntry, target: FranchiseTarget): boolean {
  if (target.tmdbId != null && target.mediaType != null) {
    return entry.tmdbId === target.tmdbId && entry.mediaType === target.mediaType;
  }
  return fold(entry.title) === fold(target.title);
}

/**
 * I tre elenchi in uno solo: senza doppioni, in ordine di uscita, e con il
 * titolo aperto dentro comunque.
 *
 * L'ordine dei gruppi è l'ordine della fiducia (collezione, keyword, nome), e
 * conta: a parità di id vince la voce del gruppo precedente, che è quella
 * arrivata dalla fonte migliore. Le schede senza locandina restano fuori — su
 * TMDB sono quasi sempre abbozzi mai completati — tranne quella del titolo
 * aperto, che deve esserci per forza: è il «sei qui».
 */
export function mergeFranchise(
  groups: TmdbFranchiseEntry[][],
  target: FranchiseTarget,
  limit = 30,
): TmdbFranchiseEntry[] {
  const byId = new Map<string, TmdbFranchiseEntry>();
  for (const group of groups) {
    for (const entry of group) {
      if (!entry.title) continue;
      if (!entry.posterPath && !isCurrent(entry, target)) continue;
      const id = idOf(entry);
      if (!byId.has(id)) byId.set(id, entry);
    }
  }

  const sorted = [...byId.values()].sort(
    (a, b) =>
      (a.releaseDate ?? "9999").localeCompare(b.releaseDate ?? "9999") || b.popularity - a.popularity,
  );

  if (sorted.length <= limit) return sorted;
  // Tagliare in fondo può buttare via proprio il titolo aperto (una collezione
  // lunga, un capitolo recente): quello si rimette dentro e si taglia il resto.
  const kept = sorted.slice(0, limit);
  const current = sorted.find((e) => isCurrent(e, target));
  if (current && !kept.includes(current)) {
    kept[kept.length - 1] = current;
    kept.sort((a, b) => (a.releaseDate ?? "9999").localeCompare(b.releaseDate ?? "9999"));
  }
  return kept;
}

export interface FranchiseEntry {
  part: TmdbFranchiseEntry;
  /** Il titolo in libreria, quando ce l'hai. */
  item: Item | null;
  state: PartState;
  /** Il titolo da cui si è aperta la collezione: sotto la locandina, SEI QUI. */
  current: boolean;
  /** Percentuale di episodi visti, per le serie che hai. `null` per i film. */
  pct: number | null;
}

function stateOf(item: Item | null): PartState {
  if (!item) return "assente";
  if (item.status === "Visto") return "visto";
  if (item.status === "In visione") return "in-visione";
  return "in-libreria";
}

/** Il titolo in libreria che corrisponde a una voce: per id, o per nome. */
export function findInLibrary(entry: TmdbFranchiseEntry, items: Item[]): Item | null {
  const byId = items.find((i) => i.tmdbId === entry.tmdbId && i.tmdbMediaType === entry.mediaType);
  if (byId) return byId;
  // I titoli scritti a mano non hanno un id da confrontare, e sono
  // esattamente quelli che sparirebbero dalla propria collezione.
  const target = fold(entry.title);
  return items.find((i) => i.tmdbId == null && fold(i.title) === target) ?? null;
}

export function buildFranchise(
  parts: TmdbFranchiseEntry[],
  items: Item[],
  target: FranchiseTarget,
): FranchiseEntry[] {
  return parts.map((part) => {
    const item = findInLibrary(part, items);
    const pct = item && item.episodes ? Math.round(((item.seen || 0) / item.episodes) * 100) : null;
    return { part, item, state: stateOf(item), current: isCurrent(part, target), pct };
  });
}

export interface FranchiseProgress {
  total: number;
  watched: number;
  owned: number;
  pct: number;
  /**
   * Cosa guardare dopo: la prima voce non vista *dopo* quella aperta, e se sei
   * all'ultimo capitolo la prima non vista in assoluto — che è quasi sempre un
   * buco lasciato indietro.
   */
  next: FranchiseEntry | null;
}

export function franchiseProgress(entries: FranchiseEntry[]): FranchiseProgress {
  const here = entries.findIndex((e) => e.current);
  const unseen = (e: FranchiseEntry) => !e.current && e.state !== "visto";
  // In quasi ogni collezione c'è un documentario sul dietro le quinte, e per
  // data di uscita finisce spesso subito dopo la stagione che hai appena
  // finito. «Continua con» quello sarebbe una risposta sbagliata a una domanda
  // giusta: il seguito della storia viene prima del making of, che resta nella
  // griglia sopra per chi lo vuole.
  const pick = (list: FranchiseEntry[]) =>
    list.find((e) => unseen(e) && e.part.kind !== "doc") ?? list.find(unseen);
  const after = here >= 0 ? entries.slice(here + 1) : [];
  const next = pick(after) ?? pick(entries) ?? null;

  const watched = entries.filter((e) => e.state === "visto").length;
  return {
    total: entries.length,
    watched,
    owned: entries.filter((e) => e.item !== null).length,
    pct: entries.length ? Math.round((watched / entries.length) * 100) : 0,
    next,
  };
}
