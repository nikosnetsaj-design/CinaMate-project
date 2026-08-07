import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "../lib/useFocusTrap";
import { paletteFor } from "../lib/palette";
import { draftFromTmdb } from "../lib/addFromTmdb";
import { computeSagaOrders } from "../lib/anthropic";
import { useSagaView } from "../lib/useSagaView";
import {
  PART_STATE_META,
  WATCH_ORDERS,
  buildEntries,
  orderParts,
  sagaProgress,
  type SagaEntry,
  type WatchOrder,
} from "../lib/sagas";
import { useLibrary } from "../store/useLibrary";
import { useSettings } from "../store/useSettings";
import { useSettingsSheet } from "../store/useSettingsSheet";
import { useSelectedSaga } from "../store/useSelectedSaga";
import { useSelectedItem } from "../store/useSelectedItem";
import { useEditSheet } from "../store/useEditSheet";
import { useMarathon } from "../store/useMarathon";
import { useSagas, type SagaKey } from "../store/useSagas";
import { PosterArt } from "./PosterArt";
import { SagaTimeline } from "./SagaTimeline";
import { ListIcon, PlayIcon, TimelineIcon } from "./icons";

function ProgressRing({ pct, color }: { pct: number; color: string }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
      <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true" className="-rotate-90">
        <circle cx="32" cy="32" r={radius} fill="none" stroke="var(--border-strong)" strokeWidth="4" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct / 100)}
        />
      </svg>
      <span className="absolute font-mono tabular text-sm font-semibold" style={{ color }}>
        {pct}%
      </span>
    </div>
  );
}

function EntryRow({ entry, onOpen, onAdd, adding }: {
  entry: SagaEntry;
  onOpen: (entry: SagaEntry) => void;
  onAdd: (entry: SagaEntry) => void;
  adding: boolean;
}) {
  const meta = PART_STATE_META[entry.state];
  const watched = entry.state === "visto";

  return (
    <li>
      <div
        className="flex items-center gap-3 rounded-md border p-2.5 transition-colors"
        style={{
          // Watched chapters are lit rather than dimmed: the point of the list
          // is to see how much of the saga is already behind you.
          borderColor: watched ? "color-mix(in srgb, var(--status-done) 34%, transparent)" : "var(--border)",
          background: watched ? "color-mix(in srgb, var(--status-done) 9%, transparent)" : "var(--surface)",
        }}
      >
        <span
          className="w-6 shrink-0 text-center font-mono tabular text-base font-semibold"
          style={{ color: watched ? "var(--status-done)" : "var(--text-faint)" }}
        >
          {entry.number}
        </span>
        <button
          type="button"
          onClick={() => (entry.item ? onOpen(entry) : onAdd(entry))}
          disabled={adding}
          aria-label={
            entry.item
              ? `Apri dettagli di ${entry.part.title}`
              : `Aggiungi ${entry.part.title} alla libreria`
          }
          className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:opacity-60"
        >
          <PosterArt
            item={{ title: entry.part.title, kind: "film", posterPath: entry.part.posterPath }}
            size="sm"
            showTitle={false}
            className="w-11 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-semibold text-text">{entry.part.title}</p>
            <p className="mt-0.5 font-mono tabular text-[11px] text-text-faint">
              {entry.part.year ?? "in arrivo"}
              {entry.item?.vote != null ? ` · ${entry.item.vote}/10` : ""}
            </p>
            {entry.pct !== null && entry.state === "in-visione" && (
              <div className="mt-1.5 h-[3px] w-full max-w-40 overflow-hidden rounded-full bg-surface-hover">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${entry.pct}%`, background: "var(--status-watching)" }}
                />
              </div>
            )}
          </div>
        </button>
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
          title={meta.label}
          style={{
            background: entry.item ? `color-mix(in srgb, ${meta.color} 18%, transparent)` : "transparent",
            border: entry.item ? "none" : "1px dashed var(--border-strong)",
            color: meta.color,
          }}
        >
          {adding ? "…" : meta.icon}
        </span>
      </div>
    </li>
  );
}

function SagaDetail({ sagaKey }: { sagaKey: SagaKey }) {
  const close = useSelectedSaga((s) => s.close);
  const containerRef = useFocusTrap(close);

  const items = useLibrary((s) => s.items);
  const pushToast = useLibrary((s) => s.pushToast);
  const { apiKey, model, tmdbApiKey } = useSettings();
  const openSettings = useSettingsSheet((s) => s.open);
  const openItem = useSelectedItem((s) => s.open);
  const openNew = useEditSheet((s) => s.openNew);
  const startMarathon = useMarathon((s) => s.start);
  const marathon = useMarathon((s) => s.marathon);

  const orders = useSagas((s) => s.orders[sagaKey]);
  const setOrders = useSagas((s) => s.setOrders);
  const preferred = useSagas((s) => s.prefs.order[sagaKey]);
  const setPreferredOrder = useSagas((s) => s.setPreferredOrder);

  const { view, loading, error } = useSagaView(sagaKey);
  const [mode, setMode] = useState<"lista" | "timeline">("lista");
  const [computing, setComputing] = useState(false);
  const [adding, setAdding] = useState<number | null>(null);

  const order: WatchOrder = preferred ?? "uscita";

  const entries = useMemo(
    () => (view ? buildEntries(orderParts(view.parts, order, orders), items) : []),
    [view, order, orders, items],
  );
  const progress = useMemo(() => sagaProgress(entries), [entries]);

  const titleId = `saga-${sagaKey}`;
  const [a, b] = paletteFor(view?.name ?? sagaKey);
  const accent = view?.accent ?? "var(--accent)";
  const needsOrders = order !== "uscita" && !orders;
  const isRunning = marathon?.key === sagaKey;

  async function computeOrders() {
    if (!view) return;
    if (!apiKey) {
      openSettings();
      return;
    }
    setComputing(true);
    try {
      setOrders(sagaKey, await computeSagaOrders(view.name, view.parts, apiKey, model));
      pushToast("success", "Ordini di visione calcolati.");
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Calcolo non riuscito.");
    }
    setComputing(false);
  }

  async function addEntry(entry: SagaEntry) {
    if (!tmdbApiKey) {
      openSettings();
      return;
    }
    setAdding(entry.part.tmdbId);
    try {
      openNew(
        await draftFromTmdb(entry.part.tmdbId, "movie", "film", tmdbApiKey, {
          title: entry.part.title,
          year: entry.part.year,
          posterPath: entry.part.posterPath,
        }),
      );
      close();
    } catch {
      pushToast("error", "Non è stato possibile leggere questo titolo da TMDB.");
    }
    setAdding(null);
  }

  function openEntry(entry: SagaEntry) {
    if (!entry.item) return;
    close();
    openItem(entry.item);
  }

  function beginMarathon() {
    if (!view) return;
    startMarathon({
      key: sagaKey,
      name: view.name,
      posterPath: view.posterPath,
      order,
      queue: entries.map((e) => e.part.tmdbId),
      // Resume where the saga actually stands rather than at chapter one.
      index: Math.max(0, entries.findIndex((e) => e.state !== "visto")),
    });
    pushToast("success", `Maratona avviata: ${view.name}.`);
    close();
  }

  return createPortal(
    <div
      className="fixed inset-0 z-70 overflow-y-auto bg-bg"
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="relative h-44 overflow-hidden">
        <div className="absolute inset-0" style={{ background: `linear-gradient(150deg, ${b}, ${a})` }} />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to bottom, transparent 25%, var(--bg) 100%)" }}
        />
      </div>

      <button
        type="button"
        onClick={close}
        aria-label="Torna indietro"
        className="tap-target fixed left-3.5 top-3.5 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur-md"
      >
        ←
      </button>

      {/* `relative` so this paints above the positioned banner it overlaps:
          without it the poster pulled up by the negative margin is clipped. */}
      <div className="relative mx-auto -mt-20 max-w-3xl px-4 pb-28 sm:px-6">
        <div className="flex items-end gap-4">
          {view && (
            <PosterArt
              item={{ title: view.name, kind: "film", posterPath: view.posterPath }}
              size="lg"
              showTitle={false}
              className="w-20 shrink-0 shadow-[var(--shadow-lg)] sm:w-24"
            />
          )}
          <div className="min-w-0 flex-1 pb-1">
            <p className="text-xs uppercase tracking-[0.18em] text-text-faint">
              {view?.isUniverse ? "Universo" : "Saga"}
            </p>
            <h1 id={titleId} className="mt-0.5 font-display text-2xl font-semibold leading-tight text-text">
              {view?.name ?? "Caricamento…"}
            </h1>
          </div>
          {view && <ProgressRing pct={progress.pct} color={accent} />}
        </div>

        {loading && !view && <p className="mt-6 text-sm text-text-faint">Caricamento della raccolta…</p>}
        {error && !view && <p className="mt-6 text-sm" style={{ color: "var(--danger)" }}>{error}</p>}

        {view && (
          <>
            <p className="mt-3 text-sm text-text-muted">
              <span className="font-mono tabular">{progress.watched}</span> di{" "}
              <span className="font-mono tabular">{progress.total}</span> capitoli visti ·{" "}
              <span className="font-mono tabular">{progress.owned}</span> in libreria
            </p>

            {view.overview && (
              <p className="mt-3 text-sm leading-relaxed text-text-muted">{view.overview}</p>
            )}

            {/* Ordine di visione */}
            <div className="mt-5">
              <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-text-faint">
                Ordine di visione
              </span>
              <div className="flex flex-wrap gap-2">
                {WATCH_ORDERS.map((o) => {
                  const active = order === o.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setPreferredOrder(sagaKey, o.id)}
                      aria-pressed={active}
                      title={o.hint}
                      className="rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
                      style={
                        active
                          ? { borderColor: "transparent", background: accent, color: "var(--accent-contrast)" }
                          : { borderColor: "var(--border-strong)", color: "var(--text-muted)" }
                      }
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-text-faint">
                {orders?.note && !needsOrders
                  ? orders.note
                  : WATCH_ORDERS.find((o) => o.id === order)?.hint}
              </p>

              {needsOrders && (
                <button
                  type="button"
                  onClick={computeOrders}
                  disabled={computing}
                  className="mt-2.5 w-full rounded-md border py-2.5 text-sm font-semibold disabled:opacity-60"
                  style={{
                    borderColor: "color-mix(in srgb, var(--cyan) 35%, transparent)",
                    background: "color-mix(in srgb, var(--cyan) 12%, transparent)",
                    color: "var(--cyan)",
                  }}
                >
                  {computing ? "Claude sta ordinando la saga…" : "Calcola l'ordine con Claude"}
                </button>
              )}
              {needsOrders && !apiKey && (
                <p className="mt-1.5 text-xs text-text-faint">
                  Ordine di uscita mostrato nel frattempo: serve la chiave Anthropic per gli altri due.
                </p>
              )}
            </div>

            {/* Maratona */}
            <button
              type="button"
              onClick={beginMarathon}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-md py-3 text-sm font-semibold"
              style={{ background: accent, color: "var(--accent-contrast)" }}
            >
              <PlayIcon size={16} />
              {isRunning
                ? "Riavvia la maratona"
                : progress.watched > 0
                  ? "Continua la saga"
                  : `Guarda tutta la ${view.isUniverse ? "raccolta" : "saga"}`}
            </button>

            {/* Lista / timeline */}
            <div className="mt-6 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-text-faint">
                {progress.total} capitoli
              </span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setMode("lista")}
                  aria-pressed={mode === "lista"}
                  aria-label="Vista elenco"
                  className="flex h-8 w-8 items-center justify-center rounded-sm border border-border-strong"
                  style={mode === "lista" ? { color: accent, borderColor: accent } : { color: "var(--text-faint)" }}
                >
                  <ListIcon size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setMode("timeline")}
                  aria-pressed={mode === "timeline"}
                  aria-label="Vista timeline"
                  className="flex h-8 w-8 items-center justify-center rounded-sm border border-border-strong"
                  style={mode === "timeline" ? { color: accent, borderColor: accent } : { color: "var(--text-faint)" }}
                >
                  <TimelineIcon size={15} />
                </button>
              </div>
            </div>

            {mode === "lista" ? (
              <ul className="mt-2.5 flex flex-col gap-2">
                {entries.map((entry) => (
                  <EntryRow
                    key={entry.part.tmdbId}
                    entry={entry}
                    onOpen={openEntry}
                    onAdd={addEntry}
                    adding={adding === entry.part.tmdbId}
                  />
                ))}
              </ul>
            ) : (
              <SagaTimeline entries={entries} accent={accent} onSelect={(e) => (e.item ? openEntry(e) : addEntry(e))} />
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function SagaSheetPortal() {
  const key = useSelectedSaga((s) => s.key);
  return key ? <SagaDetail key={key} sagaKey={key} /> : null;
}
