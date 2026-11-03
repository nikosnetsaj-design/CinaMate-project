import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "../lib/useFocusTrap";
import { paletteFor } from "../lib/palette";
import { useQuickAdd } from "../lib/useQuickAdd";
import { computeSagaOrders } from "../lib/anthropic";
import { useSagaView } from "../lib/useSagaView";
import { backdropSrcSet, backdropUrl } from "../lib/tmdb";
import {
  PART_STATE_META,
  WATCH_ORDERS,
  buildEntries,
  orderParts,
  sagaProgress,
  type PartState,
  type SagaEntry,
  type WatchOrder,
} from "../lib/sagas";
import { useLibrary } from "../store/useLibrary";
import { useSettings } from "../store/useSettings";
import { useSettingsSheet } from "../store/useSettingsSheet";
import { useSelectedSaga } from "../store/useSelectedSaga";
import { useSelectedItem } from "../store/useSelectedItem";
import { useCatalogPreview } from "../store/useCatalogPreview";
import { useMarathon } from "../store/useMarathon";
import { useSagas, type SagaKey } from "../store/useSagas";
import { PosterArt } from "./PosterArt";
import { SagaTimeline } from "./SagaTimeline";
import { BackIcon, CheckIcon, ClockIcon, ListIcon, PlayIcon, PlusIcon, TimelineIcon } from "./icons";
import { t } from "../lib/i18n";


/** Lo stato di un capitolo, in un'icona: visto, in corso, in libreria, assente. */
function PartStateIcon({ state }: { state: PartState }) {
  if (state === "visto") return <CheckIcon size={14} />;
  if (state === "in-visione") return <PlayIcon size={12} />;
  if (state === "in-libreria") return <ClockIcon size={13} />;
  return <PlusIcon size={14} />;
}
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

function EntryRow({ entry, onOpen, onPreview, onQuickAdd, adding }: {
  entry: SagaEntry;
  onOpen: (entry: SagaEntry) => void;
  onPreview: (entry: SagaEntry) => void;
  onQuickAdd: (entry: SagaEntry) => void;
  adding: boolean;
}) {
  const meta = PART_STATE_META[entry.state];
  const watched = entry.state === "visto";

  return (
    <li>
      <div
        className="flex items-center gap-3 rounded-md bg-surface-2 p-2.5 transition-colors"
      >
        {/* Il capitolo visto si riconosce dal suo segno, a destra, e dal
            numero pieno: non da una scheda verde fra schede grigie. */}
        <span
          className={`w-6 shrink-0 text-center tabular text-base font-semibold ${watched ? "text-text" : "text-text-faint"}`}
        >
          {entry.number}
        </span>
        <button
          type="button"
          onClick={() => (entry.item ? onOpen(entry) : onPreview(entry))}
          aria-label={t("SagaSheet.apri_dettagli_di", { v0: entry.part.title })}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <PosterArt
            item={{ title: entry.part.title, kind: "film", posterPath: entry.part.posterPath }}
            size="sm"
            showTitle={false}
            className="w-11 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-semibold text-text">{entry.part.title}</p>
            <p className="mt-0.5 font-mono tabular text-xs text-text-faint">
              {entry.part.year ?? t("SagaSheet.in_arrivo")}
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
        {entry.item ? (
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
            title={meta.label}
            style={{ background: `color-mix(in srgb, ${meta.color} 18%, transparent)`, color: meta.color }}
          >
            <PartStateIcon state={entry.state} />
          </span>
        ) : (
          // Il capitolo che manca: il «+» lo mette in Da vedere al volo.
          <button
            type="button"
            onClick={() => onQuickAdd(entry)}
            disabled={adding}
            aria-label={t("SagaSheet.aggiungi_alla_libreria", { v0: entry.part.title })}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-transform active:scale-90"
            style={{ border: "1px dashed var(--border-strong)", color: meta.color }}
          >
            {adding ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current" /> : <PartStateIcon state={entry.state} />}
          </button>
        )}
      </div>
    </li>
  );
}

function SagaDetail({ sagaKey }: { sagaKey: SagaKey }) {
  const close = useSelectedSaga((s) => s.close);
  const containerRef = useFocusTrap(close);

  const items = useLibrary((s) => s.items);
  const pushToast = useLibrary((s) => s.pushToast);
  const { apiKey, model } = useSettings();
  const openSettings = useSettingsSheet((s) => s.open);
  const openItem = useSelectedItem((s) => s.open);
  const openPreview = useCatalogPreview((s) => s.open);
  const { quickAdd, pending } = useQuickAdd();
  const startMarathon = useMarathon((s) => s.start);
  const marathon = useMarathon((s) => s.marathon);

  const orders = useSagas((s) => s.orders[sagaKey]);
  const setOrders = useSagas((s) => s.setOrders);
  const preferred = useSagas((s) => s.prefs.order[sagaKey]);
  const setPreferredOrder = useSagas((s) => s.setPreferredOrder);

  const { view, loading, error } = useSagaView(sagaKey);
  const [mode, setMode] = useState<"lista" | "timeline">("lista");
  const [computing, setComputing] = useState(false);

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
      pushToast("success", t("SagaSheet.ordini_di_visione_calcolati"));
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : t("SagaSheet.calcolo_non_riuscito"));
    }
    setComputing(false);
  }

  // Un capitolo che non hai: prima si legge di cosa parla, sopra la saga —
  // «indietro» riporta qui. Il «+» della riga è la scorciatoia.
  function partTitle(entry: SagaEntry) {
    return {
      tmdbId: entry.part.tmdbId,
      mediaType: "movie" as const,
      kind: "film" as const,
      title: entry.part.title,
      year: entry.part.year,
      posterPath: entry.part.posterPath,
    };
  }
  function previewEntry(entry: SagaEntry) {
    openPreview(partTitle(entry));
  }
  function quickAddEntry(entry: SagaEntry) {
    void quickAdd(partTitle(entry));
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
    pushToast("success", t("SagaSheet.maratona_avviata", { v0: view.name }));
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
      {/* La copertina larga della collezione, come nella scheda di un titolo.
          TMDB la manda già con la saga e prima non la usava nessuno; quando
          manca — e per gli universi, che non ne hanno — resta la sfumatura. */}
      <div className="relative aspect-video max-h-[42vh] min-h-44 w-full overflow-hidden">
        <div className="absolute inset-0" style={{ background: `linear-gradient(150deg, ${b}, ${a})` }} />
        {view?.backdropPath && (
          <img
            src={backdropUrl(view.backdropPath, "w1280") ?? undefined}
            srcSet={backdropSrcSet(view.backdropPath)}
            sizes="100vw"
            alt=""
            aria-hidden="true"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 35%, var(--bg) 100%)" }}
        />
      </div>

      <button
        type="button"
        onClick={close}
        aria-label={t("SagaSheet.torna_indietro")}
        className="icon-btn fixed left-3 top-3 z-20 bg-black/45 text-white backdrop-blur-md hover:bg-black/65 hover:text-white"
      >
        <BackIcon />
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
            <p className="text-sm text-text-muted">
              {view?.isUniverse ? t("SagaSheet.universo") : t("SagaSheet.saga")}
            </p>
            <h1 id={titleId} className="t-display mt-0.5 text-text">
              {view?.name ?? (
                <span role="status" className="block">
                  <span className="sr-only">{t("SagaSheet.caricamento")}</span>
                  <span aria-hidden="true" className="skeleton mt-1 block h-7 w-48 rounded-xs" />
                </span>
              )}
            </h1>
          </div>
          {view && <ProgressRing pct={progress.pct} color={accent} />}
        </div>

        {/* L'attesa della raccolta ha la forma dei suoi capitoli. */}
        {loading && !view && (
          <div aria-hidden="true" className="mt-6 flex flex-col gap-3">
            <div className="skeleton h-4 w-2/3 rounded-xs" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="skeleton aspect-2/3 w-10 shrink-0 rounded-xs" />
                <div className="flex flex-1 flex-col gap-2">
                  <div className="skeleton h-4 w-1/2 rounded-xs" />
                  <div className="skeleton h-3 w-1/4 rounded-xs" />
                </div>
              </div>
            ))}
          </div>
        )}
        {error && !view && <p className="mt-6 text-sm" style={{ color: "var(--danger)" }}>{error}</p>}

        {view && (
          <>
            <p className="mt-3 text-sm text-text-muted">
              <span className="font-mono tabular">{progress.watched}</span> {t("SagaSheet.di")}{" "}
              <span className="font-mono tabular">{progress.total}</span> {t("SagaSheet.capitoli_visti")}{" "}
              <span className="font-mono tabular">{progress.owned}</span> {t("SagaSheet.in_libreria")}
            </p>

            {view.overview && (
              <p className="mt-3 text-sm leading-relaxed text-text-muted">{view.overview}</p>
            )}

            {/* Ordine di visione */}
            <div className="mt-5">
              <span className="mb-2 block text-xs font-medium text-text-faint">
                {t("SagaSheet.ordine_di_visione")}
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
                      className="chip"
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
                  className="btn btn-secondary mt-2.5 w-full"
                >
                  {computing ? t("SagaSheet.claude_sta_ordinando_la") : t("SagaSheet.calcola_l_ordine_con")}
                </button>
              )}
              {needsOrders && !apiKey && (
                <p className="mt-1.5 text-xs text-text-faint">
                  {t("SagaSheet.ordine_di_uscita_mostrato")}
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
                ? t("SagaSheet.riavvia_la_maratona")
                : progress.watched > 0
                  ? t("SagaSheet.continua_la_saga")
                  : t("SagaSheet.guarda_tutta_la", { v0: view.isUniverse ? t("SagaSheet.raccolta") : t("SagaSheet.saga_2") })}
            </button>

            {/* Lista / timeline */}
            <div className="mt-6 flex items-center justify-between">
              <span className="text-xs font-medium text-text-faint">
                {progress.total} {t("SagaSheet.capitoli")}
              </span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setMode("lista")}
                  aria-pressed={mode === "lista"}
                  aria-label={t("SagaSheet.vista_elenco")}
                  className="btn btn-secondary"
                  style={mode === "lista" ? { color: accent, borderColor: accent } : { color: "var(--text-faint)" }}
                >
                  <ListIcon size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setMode("timeline")}
                  aria-pressed={mode === "timeline"}
                  aria-label={t("SagaSheet.vista_timeline")}
                  className="btn btn-secondary"
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
                    onPreview={previewEntry}
                    onQuickAdd={quickAddEntry}
                    adding={pending.has(`movie-${entry.part.tmdbId}`)}
                  />
                ))}
              </ul>
            ) : (
              <SagaTimeline entries={entries} accent={accent} onSelect={(e) => (e.item ? openEntry(e) : previewEntry(e))} />
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
