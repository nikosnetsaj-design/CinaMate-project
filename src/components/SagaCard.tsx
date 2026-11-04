import { buildEntries, sagaProgress } from "../lib/sagas";
import type { TmdbSagaPart } from "../lib/tmdb";
import { useLibrary } from "../store/useLibrary";
import { useSelectedSaga } from "../store/useSelectedSaga";
import type { SagaKey } from "../store/useSagas";
import { PosterArt } from "./PosterArt";
import { t } from "../lib/i18n";

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
      aria-label={t("SagaCard.apri_di_capitoli_visti", { v0: name, v1: progress.watched, v2: progress.total })}
      className="list-row gap-4"
    >
      <PosterArt
        item={{ title: name, kind: "film", posterPath }}
        size="sm"
        showTitle={!posterPath}
        className="w-14 shrink-0 rounded-xs"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-medium text-text">{name}</p>
        <p className="mt-0.5 truncate text-sm text-text-muted">
          {subtitle ?? t("SagaCard.in_libreria_su_capitoli", { v0: progress.owned, v1: progress.total })}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-surface-hover">
            <div className="h-full rounded-full" style={{ width: `${progress.pct}%`, background: accent }} />
          </div>
          <span className="tabular text-xs font-medium text-text-muted">
            {progress.pct}%
          </span>
        </div>
      </div>
    </button>
  );
}
