const VOTE_WORDS: Record<number, string> = {
  1: "Disastro",
  2: "Pessimo",
  3: "Brutto",
  4: "Mediocre",
  5: "Insufficiente",
  6: "Discreto",
  7: "Buono",
  8: "Ottimo",
  9: "Eccellente",
  10: "Capolavoro",
};

export function voteWord(vote: number): string {
  return VOTE_WORDS[vote] ?? "";
}

export function voteColor(vote: number | null | undefined): string {
  if (!vote || vote < 1 || vote > 10) return "var(--text-faint)";
  return `var(--vote-${Math.round(vote)})`;
}

export function voteFill(vote: number): string {
  return `var(--vote-fill-${vote})`;
}
