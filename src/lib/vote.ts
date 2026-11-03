import { t } from "./i18n";

const VOTE_WORDS: Record<number, () => string> = {
  1: () => t("vote.disastro"),
  2: () => t("vote.pessimo"),
  3: () => t("vote.brutto"),
  4: () => t("vote.mediocre"),
  5: () => t("vote.insufficiente"),
  6: () => t("vote.discreto"),
  7: () => t("vote.buono"),
  8: () => t("vote.ottimo"),
  9: () => t("vote.eccellente"),
  10: () => t("vote.capolavoro"),
};

/** La parola di un voto, nella lingua dell'app: «Ottimo», «Capolavoro». */
export function voteWord(vote: number): string {
  return VOTE_WORDS[vote]?.() ?? "";
}

export function voteColor(vote: number | null | undefined): string {
  if (!vote || vote < 1 || vote > 10) return "var(--text-faint)";
  return `var(--vote-${Math.round(vote)})`;
}

export function voteFill(vote: number): string {
  return `var(--vote-fill-${vote})`;
}
