import { voteColor } from "../lib/vote";

export function VoteBadge({ vote, size = "md" }: { vote: number | null; size?: "sm" | "md" | "lg" }) {
  if (!vote) return null;
  const cls = size === "lg" ? "text-3xl" : size === "sm" ? "text-sm" : "text-base";
  return (
    <span className={`font-display font-extrabold ${cls}`} style={{ color: voteColor(vote) }} aria-label={`Voto ${vote} su 10`}>
      {vote}
      {size === "lg" && <span className="text-sm font-normal text-text-faint">/10</span>}
    </span>
  );
}
