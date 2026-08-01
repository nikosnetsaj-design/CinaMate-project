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
  | "nastro"
  | "maratona"
  | "statistiche"
  | "riprendi"
  | "saga"
  | "arrivo"
  | "perTe"
  | "preferiti"
  | "piuVisti"
  | "ultimiAggiunti"
  | "watchlist";

export const HOME_SECTIONS: { id: HomeSectionId; label: string; description: string }[] = [
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
  { id: "preferiti", label: "I tuoi preferiti", description: "Quelli che hai segnato col cuore" },
  { id: "piuVisti", label: "Più visti", description: "Dove sono finite le tue ore" },
  { id: "ultimiAggiunti", label: "Ultimi aggiunti", description: "Le ultime cose entrate in libreria" },
  { id: "watchlist", label: "Watchlist", description: "Da vedere" },
];

const DEFAULT_ORDER: HomeSectionId[] = HOME_SECTIONS.map((s) => s.id);

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
}

function persist(layout: HomeLayout): HomeLayout {
  writeJson(KEY, layout);
  return layout;
}

const initial = normalise(readJson<HomeLayout>(KEY, isLayout, { order: DEFAULT_ORDER, hidden: [] }));

export const useHomeLayout = create<HomeLayoutState>((set, get) => ({
  ...initial,

  toggle: (id) => {
    const hidden = get().hidden.includes(id)
      ? get().hidden.filter((h) => h !== id)
      : [...get().hidden, id];
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

  reset: () => set(persist({ order: DEFAULT_ORDER, hidden: [] })),

  isVisible: (id) => !get().hidden.includes(id),
}));
