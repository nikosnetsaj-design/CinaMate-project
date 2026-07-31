import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { PosterArt } from "./PosterArt";
import { VoteBadge } from "./VoteBadge";
import { useSelectedItem } from "../store/useSelectedItem";
import type { Item } from "../types";
import type { Suggestion } from "../lib/recommend";

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
}: {
  title: string;
  entries: (Suggestion | { item: Item; reason?: string })[];
  /** Shown next to the heading — usually the true total, not the visible slice. */
  count?: number;
  moreHref?: string;
  /** One line explaining what the whole row is, when the reasons alone don't. */
  note?: ReactNode;
}) {
  const openItem = useSelectedItem((s) => s.open);
  if (entries.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-text">
          {title}
          {count !== undefined && <span className="text-sm font-normal text-text-faint"> · {count}</span>}
        </h2>
        {moreHref && (
          <Link to={moreHref} className="shrink-0 text-sm font-medium text-accent-text">
            tutti
          </Link>
        )}
      </div>
      {note && <p className="-mt-1 text-xs text-text-faint">{note}</p>}
      <div className="flex gap-3.5 overflow-x-auto pb-1">
        {entries.map(({ item, reason }) => (
          <button
            key={item.id}
            type="button"
            onClick={() => openItem(item)}
            aria-label={`Apri dettagli di ${item.title}, ${item.year}`}
            className="w-28 shrink-0 text-left"
          >
            <PosterArt item={item} size="sm" className="w-28" />
            <p className="mt-1.5 line-clamp-2 text-xs font-medium text-text">{item.title}</p>
            {reason ? (
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-text-faint">{reason}</p>
            ) : (
              <VoteBadge vote={item.vote} size="sm" />
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
