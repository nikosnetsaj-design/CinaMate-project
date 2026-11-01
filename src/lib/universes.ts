import { t } from "./i18n";
/**
 * Universes are the layer above sagas: a single story world told across several
 * collections plus standalone entries, which TMDB models as neither. What it
 * does have is a keyword applied to every film in the world, so each universe is
 * declared by the keyword to look up rather than by a hardcoded list of ids that
 * would go stale with the next release.
 *
 * A universe whose keyword resolves to fewer than `MIN_ENTRIES` films is hidden
 * instead of shown half-empty: TMDB keywords are community-maintained and can
 * change name, and a broken row is worse than an absent one.
 */
export interface UniverseDef {
  id: string;
  name: string;
  /** Exact TMDB keyword to resolve at runtime. */
  keyword: string;
  blurb: string;
  /** CSS variable used for the timeline spine and the card wash. */
  accent: string;
}

export const MIN_ENTRIES = 4;

export const UNIVERSES: UniverseDef[] = [
  {
    id: "mcu",
    name: "Marvel Cinematic Universe",
    keyword: "marvel cinematic universe",
    blurb: t("universes.una_sola_linea_temporale"),
    accent: "var(--danger)",
  },
  {
    id: "dceu",
    name: "DC Extended Universe",
    keyword: "dc extended universe",
    blurb: t("universes.l_universo_condiviso_dc"),
    accent: "var(--status-watching)",
  },
  {
    id: "wizarding",
    name: "Wizarding World",
    keyword: "wizarding world",
    blurb: t("universes.harry_potter_e_animali"),
    accent: "var(--yellow)",
  },
  {
    id: "middle-earth",
    name: t("universes.terra_di_mezzo"),
    keyword: "middle-earth",
    blurb: t("universes.lo_hobbit_e_il"),
    accent: "var(--status-done)",
  },
  {
    id: "monsterverse",
    name: "MonsterVerse",
    keyword: "monsterverse",
    blurb: t("universes.godzilla_kong_e_il"),
    accent: "var(--cyan)",
  },
  {
    id: "conjuring",
    name: "The Conjuring Universe",
    keyword: "the conjuring universe",
    blurb: t("universes.gli_warren_annabelle_e"),
    accent: "var(--accent)",
  },
];

export function universeById(id: string): UniverseDef | undefined {
  return UNIVERSES.find((u) => u.id === id);
}
