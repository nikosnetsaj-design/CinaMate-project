import { buildEntries, sagaProgress } from "../lib/sagas";
import type { TmdbSagaPart } from "../lib/tmdb";
import { useLibrary } from "../store/useLibrary";
import { useSelectedSaga } from "../store/useSelectedSaga";
import type { SagaKey } from "../store/useSagas";
import { PosterArt } from "./PosterArt";

export function SagaCard({
  sagaKey,
  name,
  parts,
  posterPath,
  accent = "var(--accent)",
  subtitle,
}: {
  sagaKey: SagaKey;
  name: string;
  parts: TmdbSagaPart[];
  posterPath: string | null;
  accent?: string;
  subtitle?: string;
}) {
  const items = useLibrary((s) => s.items);
  const open = useSelectedSaga((s) => s.open);
  const progress = sagaProgress(buildEntries(parts, items));

  return (
    <button
      type="button"
      onClick={() => open(sagaKey)}
      aria-label={`Apri ${name}, ${progress.watched} di ${progress.total} capitoli visti`}
      className="flex items-center gap-3.5 rounded-md border border-border bg-surface p-3 text-left transition-colors hover:bg-surface-hover"
    >
      <PosterArt
        item={{ title: name, kind: "film", posterPath }}
        size="sm"
        showTitle={!posterPath}
        className="w-14 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-sm font-semibold text-text">{name}</p>
        <p className="mt-0.5 truncate text-xs text-text-faint">
          {subtitle ?? `${progress.owned} in libreria su ${progress.total} capitoli`}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-surface-hover">
            <div className="h-full rounded-full" style={{ width: `${progress.pct}%`, background: accent }} />
          </div>
          <span className="font-mono tabular text-[11px] font-semibold" style={{ color: accent }}>
            {progress.pct}%
          </span>
        </div>
      </div>
    </button>
  );
}
