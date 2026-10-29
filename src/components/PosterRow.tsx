import type { ReactNode } from "react";
import { PosterArt } from "./PosterArt";
import { VoteBadge } from "./VoteBadge";
import { RowHeader } from "./RowHeader";
import { useSelectedItem } from "../store/useSelectedItem";
import type { Item } from "../types";
import type { Suggestion } from "../lib/recommend";
import type { PosterBadge } from "../lib/homeBadges";

/**
 * A horizontal shelf of titles. Takes suggestions rather than bare items so a
 * row can carry the reason each title is in it — product rule 2, which is also
 * why `reason` is rendered under the poster and not hidden behind a tooltip.
 */
export function PosterRow({
  title,
  entries,
  count,
  moreHref,
  note,
  badges,
}: {
  title: string;
  entries: (Suggestion | { item: Item; reason?: string })[];
  /** Shown next to the heading — usually the true total, not the visible slice. */
  count?: number;
  moreHref?: string;
  /** One line explaining what the whole row is, when the reasons alone don't. */
  note?: ReactNode;
  /** Le pastiglie "Nuova stagione" / "Aggiunto di recente", per id del titolo. */
  badges?: Record<string, PosterBadge>;
}) {
  const openItem = useSelectedItem((s) => s.open);
  if (entries.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <RowHeader title={title} count={count} note={note} to={moreHref} />
      <div className="shelf">
        {entries.map(({ item, reason }) => (
          <button
            key={item.id}
            type="button"
            onClick={() => openItem(item)}
            aria-label={`Apri dettagli di ${item.title}, ${item.year}`}
            className="group w-32 text-left sm:w-36"
          >
            <PosterArt
              item={item}
              size="sm"
              className="w-full transition-transform duration-200 group-active:scale-[0.98]"
              badge={badges?.[item.id]}
            />
            <p className="mt-2 line-clamp-2 text-sm font-medium leading-snug text-text">{item.title}</p>
            {reason ? (
              <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-text-faint">{reason}</p>
            ) : (
              <VoteBadge vote={item.vote} size="sm" />
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
