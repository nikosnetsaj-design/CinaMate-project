import { useMemo } from "react";
import { useLibrary } from "../store/useLibrary";
import { useSagas, sagaKey } from "../store/useSagas";
import { useSelectedSaga } from "../store/useSelectedSaga";
import { buildEntries, orderParts, sagaProgress } from "../lib/sagas";
import { PosterArt } from "./PosterArt";
import { RowHeader } from "./RowHeader";

const MAX_SHOWN = 6;

/**
 * Sagas you are in the middle of, with the chapter that comes next. Started and
 * unfinished is the whole filter: a saga you have not begun belongs to Scopri,
 * and one you have finished is not a decision waiting to be made.
 */
export function ContinueSagaRow() {
  const items = useLibrary((s) => s.items);
  const sagas = useSagas((s) => s.sagas);
  const orders = useSagas((s) => s.orders);
  const prefs = useSagas((s) => s.prefs);
  const openSaga = useSelectedSaga((s) => s.open);

  const started = useMemo(() => {
    const owned = new Set(items.map((i) => i.collectionId).filter((id): id is number => typeof id === "number"));
    return Array.from(owned)
      .map((id) => sagas[String(id)])
      .filter((saga) => !!saga && !prefs.hidden.includes(sagaKey(saga.id)))
      .map((saga) => {
        const key = sagaKey(saga.id);
        const entries = buildEntries(orderParts(saga.parts, prefs.order[key] ?? "uscita", orders[key]), items);
        return { saga, key, progress: sagaProgress(entries) };
      })
      .filter(({ progress }) => progress.watched > 0 && progress.next !== null)
      .sort((a, b) => b.progress.pct - a.progress.pct)
      .slice(0, MAX_SHOWN);
  }, [items, sagas, orders, prefs]);

  if (started.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      {/* Every row says why it is here — a suggestion without a reason is an advert. */}
      <RowHeader title="Continua la saga" note="Storie che hai iniziato e non ancora finito" to="/saghe" action="Vedi tutte" />

      <div className="shelf">
        {started.map(({ saga, key, progress }) => {
          const next = progress.next!;
          return (
            <button
              key={saga.id}
              type="button"
              onClick={() => openSaga(key)}
              aria-label={`Continua ${saga.name}: prossimo capitolo ${next.part.title}`}
              className="group w-32 text-left sm:w-36"
            >
              <div className="relative">
                <PosterArt
                  item={{ title: next.part.title, kind: "film", posterPath: next.part.posterPath }}
                  size="sm"
                  showTitle={!next.part.posterPath}
                  className="w-full transition-transform duration-200 group-active:scale-[0.98]"
                />
                <span className="absolute left-1.5 top-1.5 rounded-xs bg-black/65 px-1.5 py-0.5 tabular text-xs font-semibold text-white backdrop-blur-sm">
                  {next.number}
                </span>
              </div>
              <p className="mt-2 line-clamp-1 text-sm font-medium text-text">{saga.name}</p>
              <p className="line-clamp-1 text-xs text-text-faint">{next.part.title}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-surface-hover">
                  <div className="h-full rounded-full" style={{ width: `${progress.pct}%`, background: "var(--accent)" }} />
                </div>
                <span className="tabular text-xs text-text-faint">
                  {progress.watched}/{progress.total}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
