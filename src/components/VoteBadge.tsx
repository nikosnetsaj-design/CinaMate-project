/**
 * Il voto, in cifre.
 *
 * Era colorato con la scala da freddo a caldo, su ogni copertina: un 9 e un 10
 * in arancio e rosso si leggevano come avvisi, e una fila di voti era una fila
 * di semafori. La cifra basta a dire il voto; la scala di colore resta dove
 * serve a confrontarli — il Nastro e il selettore.
 */
export function VoteBadge({ vote, size = "md" }: { vote: number | null; size?: "sm" | "md" | "lg" }) {
  if (!vote) return null;
  const cls = size === "lg" ? "text-3xl" : size === "sm" ? "text-sm" : "text-base";
  return (
    <span className={`tabular font-semibold text-text ${cls}`} aria-label={`Voto ${vote} su 10`}>
      {vote}
      {size === "lg" && <span className="text-sm font-normal text-text-faint">/10</span>}
    </span>
  );
}
