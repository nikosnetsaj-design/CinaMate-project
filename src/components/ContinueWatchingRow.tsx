import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLibrary } from "../store/useLibrary";
import { useSelectedItem } from "../store/useSelectedItem";
import { useWatchProgress } from "../store/useWatchProgress";
import { useVisibleItems } from "../lib/useVisibleItems";
import { continueWatching, lastSeenDates, type ResumeEntry } from "../lib/continueWatching";
import { formatRuntime } from "../lib/format";
import { PosterArt } from "./PosterArt";
import { PlayIcon } from "./icons";

const MAX_SHOWN = 12;

/** "3 min", "1h 12min", or the honest nothing when the runtime is unknown. */
function remainingText(entry: ResumeEntry): string | null {
  if (!entry.remainingMin) return null;
  if (entry.hasPlayhead) return `restano ${formatRuntime(entry.remainingMin)}`;
  const left = entry.item.episodes ? (entry.item.episodes - (entry.item.seen || 0)) : 0;
  if (left > 0) return `${left} episod${left === 1 ? "io" : "i"} · ${formatRuntime(entry.remainingMin)}`;
  return formatRuntime(entry.remainingMin);
}

export function ContinueWatchingCard({ entry }: { entry: ResumeEntry }) {
  const navigate = useNavigate();
  const openItem = useSelectedItem((s) => s.open);
  const forget = useWatchProgress((s) => s.forget);
  const { item, pct } = entry;
  const left = remainingText(entry);

  return (
    <div className="group relative w-40 shrink-0 sm:w-44">
      <button
        type="button"
        onClick={() => navigate(`/player?titolo=${encodeURIComponent(item.id)}`)}
        aria-label={
          entry.hasPlayhead
            ? `Riprendi ${item.title} da ${Math.floor(entry.positionSec / 60)} minuti`
            : `Guarda ${item.title}`
        }
        className="block w-full text-left"
      >
        <div className="relative overflow-hidden rounded-sm">
          <PosterArt item={item} size="sm" className="w-full" />

          {/* The play affordance sits on the art itself: this row exists to be
              tapped, not browsed, so the action must be visible before hover —
              which on a phone never arrives. */}
          <span
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <span
              className="flex h-11 w-11 items-center justify-center rounded-full shadow-[var(--shadow-md)]"
              style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
            >
              <PlayIcon size={18} />
            </span>
          </span>

          {/* Progress is drawn on the poster rather than under it, so the row
              reads as "how far in am I" at a glance down the whole shelf. */}
          <span
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-9 bg-gradient-to-t from-black/80 to-transparent"
          />
          <span className="absolute inset-x-2 bottom-2 flex items-center gap-1.5">
            <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25">
              <span
                className="block h-full rounded-full"
                style={{ width: `${Math.max(pct, 2)}%`, background: "var(--accent)" }}
              />
            </span>
            <span className="font-mono tabular text-[10px] font-semibold text-white/90">{pct}%</span>
          </span>
        </div>

        <p className="mt-1.5 line-clamp-1 text-xs font-semibold text-text">{item.title}</p>
        <p className="line-clamp-1 text-[11px] text-text-faint">
          {entry.label}
          {left ? ` · ${left}` : ""}
        </p>
      </button>

      {/* Two escapes from the row: the details sheet, and forgetting the point
          entirely. Without the second, a title you have given up on would sit
          at the top of the home page until you deleted it from the library. */}
      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          onClick={() => openItem(item)}
          className="text-[11px] text-text-faint underline-offset-2 hover:text-text-muted hover:underline"
        >
          dettagli
        </button>
        {entry.hasPlayhead && (
          <button
            type="button"
            onClick={() => forget(item.id)}
            aria-label={`Togli ${item.title} da Continua a guardare`}
            className="text-[11px] text-text-faint underline-offset-2 hover:text-text-muted hover:underline"
          >
            rimuovi
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * "Continua a guardare": what you left half-watched, most recent first, one tap
 * from the exact second you stopped.
 *
 * Distinct from *Riprendi*, which lists series by episode counter — this one is
 * driven by the playhead, so it also holds films, and it knows the minute.
 */
export function ContinueWatchingRow() {
  const items = useVisibleItems();
  const history = useLibrary((s) => s.history);
  const progress = useWatchProgress((s) => s.progress);

  const entries = useMemo(
    () => continueWatching(items, progress, lastSeenDates(history)).slice(0, MAX_SHOWN),
    [items, progress, history],
  );

  if (entries.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-text">
            Continua a guardare <span className="text-sm font-normal text-text-faint">· {entries.length}</span>
          </h2>
          <p className="mt-0.5 text-xs text-text-faint">Riparte dal punto esatto in cui hai smesso</p>
        </div>
        <Link to="/profilo" className="shrink-0 text-sm font-medium text-accent-text">
          profilo
        </Link>
      </div>

      <div className="flex gap-3.5 overflow-x-auto pb-1">
        {entries.map((entry) => (
          <ContinueWatchingCard key={entry.item.id} entry={entry} />
        ))}
      </div>
    </section>
  );
}
