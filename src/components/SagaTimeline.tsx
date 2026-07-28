import { PART_STATE_META, type SagaEntry } from "../lib/sagas";
import { PosterArt } from "./PosterArt";

/**
 * The same chapters as the list, drawn as one thread instead of rows. It exists
 * for universes, where the question is not "what have I seen" but "how does
 * this fit together" — the spine carries the reading order and each node states
 * its year, so a jump backwards in time is visible at a glance.
 */
export function SagaTimeline({
  entries,
  accent,
  onSelect,
}: {
  entries: SagaEntry[];
  accent: string;
  onSelect: (entry: SagaEntry) => void;
}) {
  return (
    <ol className="relative mt-3 flex flex-col">
      {/* The spine sits behind the nodes and stops at the last one. */}
      <span
        aria-hidden="true"
        className="absolute bottom-8 left-[13px] top-3 w-px"
        style={{ background: `linear-gradient(to bottom, ${accent}, color-mix(in srgb, ${accent} 20%, transparent))` }}
      />
      {entries.map((entry) => {
        const meta = PART_STATE_META[entry.state];
        const watched = entry.state === "visto";
        return (
          <li key={entry.part.tmdbId} className="relative flex gap-3.5 pb-4 last:pb-0">
            <span
              aria-hidden="true"
              className="relative z-10 mt-2 flex h-[27px] w-[27px] shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-semibold"
              style={{
                background: watched ? meta.color : "var(--bg)",
                borderColor: entry.item ? meta.color : "var(--border-strong)",
                color: watched ? "var(--accent-contrast)" : meta.color,
              }}
            >
              {watched ? "✓" : entry.number}
            </span>
            <button
              type="button"
              onClick={() => onSelect(entry)}
              aria-label={entry.item ? `Apri dettagli di ${entry.part.title}` : `Aggiungi ${entry.part.title} alla libreria`}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-md border border-border bg-surface p-2.5 text-left transition-colors hover:bg-surface-hover"
            >
              <PosterArt
                item={{ title: entry.part.title, kind: "film", posterPath: entry.part.posterPath }}
                size="sm"
                showTitle={false}
                className="w-9 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-sm font-semibold text-text">{entry.part.title}</p>
                <p className="mt-0.5 font-mono tabular text-[11px] text-text-faint">
                  {entry.part.year ?? "in arrivo"} · {meta.label}
                </p>
              </div>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
