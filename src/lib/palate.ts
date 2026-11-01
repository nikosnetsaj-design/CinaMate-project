import type { Item } from "../types";
import { intlLocale, lang, t } from "./i18n";

/**
 * Il tuo palato: cosa premi e cosa punisci, calcolato qui dai tuoi voti.
 *
 * Ogni voto pesa per quanto si scosta dalla *tua* media, non da un 5 o un 6
 * assoluti: chi non scende mai sotto il 7 altrimenti sembrerebbe amare tutto
 * allo stesso modo, e un profilo che ama tutto non consiglia niente. Un
 * genere votato sempre 4 spinge i suoi titoli in giù, cosa che un profilo a
 * soli conteggi non saprebbe dire.
 *
 * Cinque dimensioni, quelle che la libreria conosce davvero: genere, decennio,
 * regia, durata (solo film: la durata di una serie è quella di una puntata, e
 * mescolarle non direbbe niente), paese di produzione. Nessuna esce dal
 * dispositivo.
 */

export type Dimension = "genre" | "decade" | "director" | "runtime" | "country";

export interface Facet {
  key: string;
  label: string;
  count: number;
  /** La tua media su questi titoli, 1–10. */
  avg: number;
  /** Quanto la tua media qui si scosta dalla tua media generale. */
  lift: number;
}

export interface Palate {
  rated: number;
  average: number;
  /** Pesi per il motore dei consigli: somma degli scarti dalla tua media. */
  weights: Record<Dimension | "actor" | "studio", Map<string, number>>;
  /** Le stesse dimensioni per la pagina: medie e numeri, dalla più premiata. */
  facets: Record<Dimension, Facet[]>;
  /** Il tuo voto contro quello di TMDB sugli stessi titoli. */
  vsCrowd: { delta: number; count: number } | null;
}

/** Sotto questo numero di voti il palato sarebbe un oroscopo. */
export const PALATE_MIN_VOTES = 5;

export function names(value: string): string[] {
  return value
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
}

export function decadeOf(year: number): string | null {
  if (!year || year < 1880) return null;
  return String(Math.floor(year / 10) * 10);
}

export function decadeLabel(decade: string): string {
  const d = Number(decade);
  if (lang === "en") return d < 2000 ? `'${String(d % 100).padStart(2, "0")}s` : `${d}s`;
  return d < 2000 ? `anni '${String(d % 100).padStart(2, "0")}` : `anni ${d}`;
}

export type RuntimeBucket = "breve" | "classico" | "lungo" | "fiume";

const RUNTIME_LABEL: Record<RuntimeBucket, string> = {
  breve: t("palate.sotto_l_ora_e"),
  classico: t("palate.fra_un_ora_e"),
  lungo: t("palate.fra_due_ore_e"),
  fiume: t("palate.oltre_le_due_ore"),
};

export function runtimeBucket(item: Pick<Item, "kind" | "runtime">): RuntimeBucket | null {
  if (item.kind !== "film" || !item.runtime) return null;
  if (item.runtime < 90) return "breve";
  if (item.runtime <= 120) return "classico";
  if (item.runtime <= 150) return "lungo";
  return "fiume";
}

let regions: Intl.DisplayNames | null | undefined;

export function countryLabel(code: string): string {
  if (regions === undefined) {
    try {
      regions = new Intl.DisplayNames([intlLocale()], { type: "region" });
    } catch {
      regions = null;
    }
  }
  try {
    return regions?.of(code) ?? code;
  } catch {
    return code;
  }
}

function labelFor(dimension: Dimension, key: string): string {
  if (dimension === "decade") return decadeLabel(key);
  if (dimension === "runtime") return RUNTIME_LABEL[key as RuntimeBucket] ?? key;
  if (dimension === "country") return countryLabel(key);
  return key;
}

function keysOf(item: Item, dimension: Dimension): string[] {
  switch (dimension) {
    case "genre":
      return item.genre ? [item.genre] : [];
    case "decade": {
      const d = decadeOf(item.year);
      return d ? [d] : [];
    }
    case "director":
      return names(item.director);
    case "runtime": {
      const b = runtimeBucket(item);
      return b ? [b] : [];
    }
    case "country":
      return item.countries ?? [];
  }
}

const DIMENSIONS: Dimension[] = ["genre", "decade", "director", "runtime", "country"];

export function buildPalate(items: Item[]): Palate {
  const rated = items.filter((i) => i.vote != null);
  const average = rated.length ? rated.reduce((sum, i) => sum + (i.vote ?? 0), 0) / rated.length : 6;

  const weights = {
    genre: new Map<string, number>(),
    decade: new Map<string, number>(),
    director: new Map<string, number>(),
    runtime: new Map<string, number>(),
    country: new Map<string, number>(),
    actor: new Map<string, number>(),
    studio: new Map<string, number>(),
  };
  const votes: Record<Dimension, Map<string, number[]>> = {
    genre: new Map(),
    decade: new Map(),
    director: new Map(),
    runtime: new Map(),
    country: new Map(),
  };
  const bump = (map: Map<string, number>, key: string, weight: number) => {
    if (key) map.set(key, (map.get(key) ?? 0) + weight);
  };

  let crowdDelta = 0;
  let crowdCount = 0;

  for (const item of rated) {
    const vote = item.vote ?? 0;
    const weight = vote - average;
    for (const dimension of DIMENSIONS) {
      const keys = keysOf(item, dimension);
      for (const key of keys) {
        // Più paesi o più registi si dividono il peso: una coproduzione a
        // quattro non conta quattro volte.
        bump(weights[dimension], key, weight / keys.length);
        votes[dimension].set(key, [...(votes[dimension].get(key) ?? []), vote]);
      }
    }
    bump(weights.studio, item.studio ?? "", weight * 0.5);
    // Il cast si divide, perché cinque nomi non pesino più di una regia.
    for (const name of item.cast) bump(weights.actor, name, weight / item.cast.length);
    if (typeof item.tmdbRating === "number" && item.tmdbRating > 0) {
      crowdDelta += vote - item.tmdbRating;
      crowdCount++;
    }
  }

  const facets = Object.fromEntries(
    DIMENSIONS.map((dimension) => {
      const list: Facet[] = [...votes[dimension].entries()]
        .filter(([, v]) => v.length >= 2)
        .map(([key, v]) => {
          const avg = v.reduce((a, b) => a + b, 0) / v.length;
          return { key, label: labelFor(dimension, key), count: v.length, avg, lift: avg - average };
        })
        .sort((a, b) => b.lift - a.lift || b.count - a.count);
      return [dimension, list];
    }),
  ) as Record<Dimension, Facet[]>;

  return {
    rated: rated.length,
    average,
    weights,
    facets,
    vsCrowd: crowdCount >= 3 ? { delta: crowdDelta / crowdCount, count: crowdCount } : null,
  };
}

/** Quelli che premi: sopra la tua media di almeno mezzo punto. */
export function loved(facets: Facet[], limit = 3): Facet[] {
  return facets.filter((f) => f.lift >= 0.5).slice(0, limit);
}

/** Quelli che punisci: sotto la tua media di almeno mezzo punto. */
export function disliked(facets: Facet[], limit = 2): Facet[] {
  return facets
    .filter((f) => f.lift <= -0.5)
    .slice(-limit)
    .reverse();
}

/*
 * Il genere detto come si dice: «la fantascienza», «gli horror», «i film
 * d'azione». Prima la frase era «voti alto i animazione».
 */
const GENRE_PHRASE: Record<string, string> = {
  Azione: t("palate.i_film_d_azione"),
  Avventura: t("palate.i_film_d_avventura"),
  Animazione: t("palate.l_animazione"),
  Commedia: t("palate.le_commedie"),
  Crime: t("palate.i_crime"),
  Documentario: t("palate.i_documentari"),
  Dramma: t("palate.i_drammi"),
  Drammatico: t("palate.i_drammi"),
  Famiglia: t("palate.i_film_per_famiglie"),
  Fantasy: t("palate.il_fantasy"),
  Storia: t("palate.i_film_storici"),
  Horror: t("palate.gli_horror"),
  Musica: t("palate.i_film_musicali"),
  Mistero: t("palate.i_gialli"),
  Romantico: t("palate.i_film_romantici"),
  Fantascienza: t("palate.la_fantascienza"),
  "Film TV": t("palate.i_film_per_la"),
  Thriller: t("palate.i_thriller"),
  Guerra: t("palate.i_film_di_guerra"),
  Western: t("palate.i_western"),
  "Action & Adventure": t("palate.l_azione_e_l"),
  Kids: t("palate.i_titoli_per_ragazzi"),
  Reality: t("palate.i_reality"),
  "Sci-Fi & Fantasy": t("palate.la_fantascienza_e_il"),
  Soap: t("palate.le_soap"),
  "War & Politics": t("palate.la_guerra_e_la"),
  // I nomi con cui TMDB risponde in inglese, per chi usa l'app in inglese.
  Action: t("palate.i_film_d_azione"),
  Adventure: t("palate.i_film_d_avventura"),
  Animation: t("palate.l_animazione"),
  Comedy: t("palate.le_commedie"),
  Documentary: t("palate.i_documentari"),
  Drama: t("palate.i_drammi"),
  Family: t("palate.i_film_per_famiglie"),
  History: t("palate.i_film_storici"),
  Music: t("palate.i_film_musicali"),
  Mystery: t("palate.i_gialli"),
  Romance: t("palate.i_film_romantici"),
  "Science Fiction": t("palate.la_fantascienza"),
  "TV Movie": t("palate.i_film_per_la"),
  War: t("palate.i_film_di_guerra"),
};

export function genrePhrase(genre: string): string {
  return GENRE_PHRASE[genre] ?? t("palate.il_genere", { v0: genre.toLowerCase() });
}

/** Il motivo, scritto, per un contributo di una dimensione a un consiglio. */
export function palateReason(dimension: Dimension, key: string): string {
  switch (dimension) {
    case "genre":
      return t("palate.perche_voti_alto", { v0: genrePhrase(key) });
    case "decade":
      return t("palate.perche_gli_sono_il", { v0: decadeLabel(key) });
    case "director":
      return t("palate.perche_ti_e_piaciuto", { v0: key });
    case "runtime":
      return t("palate.della_durata_che_premi", { v0: RUNTIME_LABEL[key as RuntimeBucket] ?? key });
    case "country":
      return t("palate.dal_paese_che_premi", { v0: countryLabel(key) });
  }
}

export { keysOf as palateKeys };
