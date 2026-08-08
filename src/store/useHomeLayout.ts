import { create } from "zustand";
import { isRecord, readJson, writeJson } from "../lib/localStore";

const KEY = "cinemate:home-layout:v1";

/**
 * The rows the Home page can show, in their default order.
 *
 * `maxRows` in PRODUCT.md §3.1 caps the page at six rows precisely so it never
 * becomes the wall of carousels the doc calls the anti-Netflix rule. Letting
 * the user reorder and hide rows serves that rule rather than breaking it: the
 * cap stays, and this decides *which* six are worth the space.
 */
export type HomeSectionId =
  | "vetrina"
  | "nastro"
  | "maratona"
  | "statistiche"
  | "riprendi"
  | "saga"
  | "arrivo"
  | "perTe"
  | "perche"
  | "preferiti"
  | "piuVisti"
  | "ultimiAggiunti"
  | "watchlist";

export const HOME_SECTIONS: { id: HomeSectionId; label: string; description: string }[] = [
  { id: "vetrina", label: "In vetrina", description: "Un titolo solo, grande, con il perché" },
  { id: "nastro", label: "Il Nastro", description: "La tua visione come oggetto visivo" },
  { id: "maratona", label: "Maratona in corso", description: "La saga che stai attraversando" },
  { id: "statistiche", label: "Statistiche", description: "Titoli, voto medio, ore, preferiti" },
  // Keeps the id `riprendi` although the row is now called "Continua a
  // guardare": the id is what stored layouts hold, and renaming it would have
  // reset the row order of every install to win nothing.
  { id: "riprendi", label: "Continua a guardare", description: "Riparte dal punto esatto in cui hai smesso" },
  { id: "saga", label: "Continua la saga", description: "Il prossimo capitolo, già scelto" },
  { id: "arrivo", label: "In arrivo", description: "Nuovi episodi e uscite che segui" },
  { id: "perTe", label: "Per te", description: "Consigli dal tuo scaffale, con il perché" },
  { id: "perche", label: "Perché hai guardato…", description: "Somiglianze con l'ultimo titolo finito" },
  { id: "preferiti", label: "I tuoi preferiti", description: "Quelli che hai segnato col cuore" },
  { id: "piuVisti", label: "Più visti", description: "Dove sono finite le tue ore" },
  { id: "ultimiAggiunti", label: "Ultimi aggiunti", description: "Le ultime cose entrate in libreria" },
  { id: "watchlist", label: "Watchlist", description: "Da vedere" },
];

/**
 * L'ordine di partenza, dichiarato e non ereditato.
 *
 * Era `HOME_SECTIONS.map(...)`, cioè l'ordine in cui le sezioni erano state
 * scritte nel file — che è un ordine storico, non una scelta. Qui invece è
 * una sequenza di domande, dalla più urgente alla più oziosa: *cosa guardo
 * adesso* (vetrina), *dov'ero rimasto* (riprendi), *e della saga?* (saga),
 * *cosa sta per uscire* (arrivo), *cosa mi somiglia* (perTe). Il Nastro
 * chiude, perché è l'unica riga che non chiede una decisione: si guarda e
 * basta, ed è il posto giusto per finire una pagina.
 */
const DEFAULT_ORDER: HomeSectionId[] = [
  "vetrina",
  "riprendi",
  "saga",
  "arrivo",
  "perTe",
  "nastro",
  // Spente di partenza, nell'ordine in cui conviene accenderle.
  "maratona",
  "perche",
  "watchlist",
  "preferiti",
  "piuVisti",
  "ultimiAggiunti",
  "statistiche",
];

/**
 * Il tetto, finalmente una costante.
 *
 * «Massimo 6 righe in Home» era la regola più citata di PRODUCT.md §3.1, ed
 * era ripetuta nel commento in cima a questo file. Non era applicata da
 * nessuna parte: `DEFAULT_ORDER` conteneva tutte e tredici le sezioni e
 * `hidden` nasceva vuoto, quindi la regola anti-Netflix valeva per chiunque
 * *tranne* per chi la Home la usava davvero — un utente con preferiti,
 * watchlist e una maratona in corso ne vedeva undici o dodici.
 *
 * Adesso il numero esiste, e `canShowMore` lo fa rispettare al selettore in
 * Impostazioni. Un vincolo dichiarato e applicato è una funzione: costringe a
 * scegliere quali sei righe valgono lo spazio, che è esattamente la decisione
 * che la regola voleva far prendere.
 */
export const MAX_ROWS = 6;

/**
 * Le sette righe spente di partenza.
 *
 * Restano tutte accendibili in Impostazioni: quello che cambia è cosa trova
 * chi non è mai andato a guardare. Le sei che restano rispondono in ordine a
 * «cosa guardo adesso» (vetrina), «dov'ero rimasto» (riprendi), «e della
 * saga?» (saga), «cosa sta per uscire» (arrivo), «cosa mi somiglia» (perTe),
 * e chiude il Nastro, che non è una statistica ma l'unica cosa della lista
 * che si guarda invece di leggerla.
 *
 * Le statistiche escono dalla Home perché adesso hanno una pagina intera —
 * **Tu** — e perché la Home serve a decidere stasera, non a fare il bilancio.
 */
const DEFAULT_HIDDEN: HomeSectionId[] = [
  "statistiche",
  "maratona",
  "perche",
  "preferiti",
  "piuVisti",
  "ultimiAggiunti",
  "watchlist",
];

export interface HomeLayout {
  order: HomeSectionId[];
  hidden: HomeSectionId[];
}

function isLayout(value: unknown): value is HomeLayout {
  return isRecord(value) && Array.isArray(value.order) && Array.isArray(value.hidden);
}

/**
 * Reconciles a stored layout against the current section list, which matters
 * every time a release adds a row: an id the user has never seen is appended
 * in its default position rather than silently dropped, and an id that no
 * longer exists is discarded rather than rendering nothing forever.
 */
function normalise(layout: HomeLayout): HomeLayout {
  const known = new Set(DEFAULT_ORDER);
  const stored = layout.order.filter((id) => known.has(id));
  const missing = DEFAULT_ORDER.filter((id) => !stored.includes(id));
  return {
    order: [...stored, ...missing],
    hidden: layout.hidden.filter((id) => known.has(id)),
  };
}

interface HomeLayoutState extends HomeLayout {
  toggle: (id: HomeSectionId) => void;
  move: (id: HomeSectionId, direction: -1 | 1) => void;
  reset: () => void;
  /** True when the section should render at all. */
  isVisible: (id: HomeSectionId) => boolean;
  /** Quante righe sono accese adesso. */
  shownCount: () => number;
  /** Se c'è ancora posto sotto il tetto — falso quando le righe accese sono già sei. */
  canShowMore: () => boolean;
}

function persist(layout: HomeLayout): HomeLayout {
  writeJson(KEY, layout);
  return layout;
}

const initial = normalise(
  readJson<HomeLayout>(KEY, isLayout, { order: DEFAULT_ORDER, hidden: DEFAULT_HIDDEN }),
);

export const useHomeLayout = create<HomeLayoutState>((set, get) => ({
  ...initial,

  shownCount: () => get().order.filter((id) => !get().hidden.includes(id)).length,

  canShowMore: () => get().shownCount() < MAX_ROWS,

  toggle: (id) => {
    const on = get().hidden.includes(id);
    // Accendere una settima riga non fa niente: il tetto è la funzione, e
    // lasciarlo aggirare dal pannello che dovrebbe farlo rispettare sarebbe
    // riscrivere la regola in prosa una terza volta. Spegnere è sempre
    // permesso — un vincolo che impedisce di *togliere* sarebbe una gabbia.
    if (on && !get().canShowMore()) return;
    const hidden = on ? get().hidden.filter((h) => h !== id) : [...get().hidden, id];
    set(persist({ order: get().order, hidden }));
  },

  move: (id, direction) => {
    const order = [...get().order];
    const from = order.indexOf(id);
    const to = from + direction;
    if (from === -1 || to < 0 || to >= order.length) return;
    [order[from], order[to]] = [order[to], order[from]];
    set(persist({ order, hidden: get().hidden }));
  },

  reset: () => set(persist({ order: DEFAULT_ORDER, hidden: DEFAULT_HIDDEN })),

  isVisible: (id) => !get().hidden.includes(id),
}));
