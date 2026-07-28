import { useLibrary } from "../store/useLibrary";
import { useSagas, sagaKey } from "../store/useSagas";
import { useSelectedSaga } from "../store/useSelectedSaga";
import { useSelectedItem } from "../store/useSelectedItem";
import { buildEntries, orderParts, sagaProgress } from "../lib/sagas";
import { StackIcon } from "./icons";
import type { Item } from "../types";

/**
 * The saga a title belongs to, seen from inside the title: where this chapter
 * sits, how much of the story is already behind you, and one tap to the whole
 * thing. Renders nothing for standalone titles and for sagas not yet downloaded
 * — the background linker fills them in shortly after a title is added.
 */
export function ItemSagaStrip({ item }: { item: Item }) {
  const items = useLibrary((s) => s.items);
  const sagas = useSagas((s) => s.sagas);
  const orders = useSagas((s) => s.orders);
  const prefs = useSagas((s) => s.prefs);
  const openSaga = useSelectedSaga((s) => s.open);
  const closeItem = useSelectedItem((s) => s.close);

  const saga = item.collectionId != null ? sagas[String(item.collectionId)] : undefined;
  if (!saga) return null;

  const key = sagaKey(saga.id);
  const entries = buildEntries(orderParts(saga.parts, prefs.order[key] ?? "uscita", orders[key]), items);
  const here = entries.find((e) => e.item?.id === item.id);
  const progress = sagaProgress(entries);

  return (
    <button
      type="button"
      onClick={() => {
        closeItem();
        openSaga(key);
      }}
      aria-label={`Apri la saga ${saga.name}`}
      className="mt-4 flex w-full items-center gap-3 rounded-md border border-border bg-surface-2 p-3.5 text-left transition-colors hover:bg-surface-hover"
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ background: "color-mix(in srgb, var(--accent) 16%, transparent)", color: "var(--accent-text)" }}
      >
        <StackIcon size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-[0.16em] text-text-faint">
          {here ? `Capitolo ${here.number} di ${progress.total}` : "Fa parte della saga"}
        </p>
        <p className="truncate font-display text-sm font-semibold text-text">{saga.name}</p>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-surface-hover">
            <div className="h-full rounded-full" style={{ width: `${progress.pct}%`, background: "var(--accent)" }} />
          </div>
          <span className="font-mono tabular text-[11px] text-text-faint">
            {progress.watched}/{progress.total}
          </span>
        </div>
      </div>
      <span className="shrink-0 text-text-faint">→</span>
    </button>
  );
}
