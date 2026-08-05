export type Kind = "film" | "serie" | "anime" | "doc";

/**
 * Lo stato di un titolo. Sei valori, e il sesto è arrivato per ultimo con una
 * ragione precisa: togliere qualcosa dalla watchlist non aveva un posto dove
 * farlo atterrare. *Abbandonato* dice «ci ho rinunciato» e *In pausa* dice «lo
 * riprendo», mentre quello che serviva è «sta sullo scaffale, non l'ho visto e
 * non l'ho promesso a nessuno» — cioè lo stato in cui un titolo si trova prima
 * che tu decida qualcosa.
 */
export type Status = "In visione" | "Visto" | "Da vedere" | "Abbandonato" | "In pausa" | "Sullo scaffale";

export const PLATFORMS = [
  "Netflix",
  "Prime Video",
  "Disney+",
  "Apple TV+",
  "Sky / NOW",
  "HBO Max",
  "Paramount+",
  "Crunchyroll",
  "MUBI",
  "RaiPlay",
  "Cinema",
  "Altro",
] as const;

export type Platform = (typeof PLATFORMS)[number];

export interface Item {
  id: string;
  title: string;
  kind: Kind;
  year: number;
  genre: string;
  status: Status;
  vote: number | null;
  platform: Platform;
  runtime: number;
  episodes: number | null;
  seen: number;
  seasons: number | null;
  fav: boolean;
  rewatch: number;
  overview: string;
  director: string;
  cast: string[];
  similar: string[];
  notes: string;
  added: string;
  tmdbId: number | null;
  tmdbMediaType: "movie" | "tv" | null;
  posterPath: string | null;
  /**
   * L'immagine orizzontale, usata come intestazione della scheda. Opzionale
   * come i campi qui sotto: arriva ai titoli aggiunti o ricollegati dopo che
   * questa esisteva, e quando manca l'intestazione resta la sfumatura generata
   * dal titolo, che è sempre stata la resa predefinita.
   */
  backdropPath?: string | null;
  trailerUrl: string | null;
  links: string[];
  /**
   * TMDB collection the title belongs to — what the app calls a *saga*. Absent
   * on records written before sagas existed, and `null` once a title has been
   * checked and turned out to be standalone: the two states are distinct so the
   * background linker knows what it still has to look at.
   */
  collectionId?: number | null;
  collectionName?: string | null;

  // --- Catalogue facts the advanced filters search on -----------------------
  // All optional: they arrive with titles added or re-linked after this
  // existed, and every filter treats "absent" as unknown rather than as a
  // miss, so an older library keeps showing up in its own search results.

  /** Lead production company, e.g. "A24". */
  studio?: string;
  /** Production countries as ISO 3166-1 codes, e.g. ["US", "GB"]. */
  countries?: string[];
  /** TMDB's own average, 0–10 — a different question from `vote`, which is yours. */
  tmdbRating?: number | null;
  /** Spoken languages as ISO 639-1 codes, e.g. ["it", "en"]. */
  audioLangs?: string[];
  /**
   * Age rating as the board wrote it — "VM14", "R", "TV-MA". Kept verbatim
   * rather than as a number so it can be shown as issued; lib/parental does
   * the translation to an age, where the imprecision can be admitted.
   */
  certification?: string;
  /**
   * Le avvertenze come le scriveresti tu — "linguaggio forte, consumo di
   * tabacco" — mostrate nel cartello che il player apre nei primi secondi.
   *
   * Scritte a mano e non dedotte: nessun catalogo pubblico le espone in modo
   * affidabile, e ricavarle dal genere ("è un horror, quindi violenza")
   * significherebbe inventarle. Assente vuol dire assente, e il cartello mostra
   * solo la sigla.
   */
  contentWarnings?: string;
  /**
   * The quality of the copy *you* have. Set by hand rather than detected: no
   * catalogue knows what is on your server, and a manifest only reveals its
   * renditions once something plays it.
   */
  quality?: Quality | null;
}

export const QUALITIES = ["SD", "720p", "1080p", "4K", "HDR"] as const;
export type Quality = (typeof QUALITIES)[number];

export type ToastKind = "success" | "error" | "info";

export interface ToastMessage {
  id: string;
  kind: ToastKind;
  text: string;
}

export type HistoryAction = "watched" | "episode" | "rewatch";

export interface HistoryEntry {
  id: string;
  itemId: string;
  title: string;
  kind: Kind;
  date: string;
  action: HistoryAction;
  /**
   * Episodes covered by this entry. Lets a binge stay a single record instead
   * of one per episode, which matters for long-running series. Absent in
   * entries written before this field existed — always read it as `?? 1`.
   */
  count?: number;
}
