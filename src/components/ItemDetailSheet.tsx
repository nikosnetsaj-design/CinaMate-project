import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useFocusTrap } from "../lib/useFocusTrap";
import { paletteFor } from "../lib/palette";
import { formatRuntime } from "../lib/format";
import { STATUSES } from "../lib/status";
import { voteColor } from "../lib/vote";
import { PosterArt } from "./PosterArt";
import { StatusChip } from "./StatusChip";
import { WatchAndLinks } from "./WatchAndLinks";
import { LinkToTmdb } from "./LinkToTmdb";
import { ItemSagaStrip } from "./ItemSagaStrip";
import { PeopleLinks } from "./PeopleLinks";
import { HeartIcon } from "./icons";
import { useSelectedItem } from "../store/useSelectedItem";
import { useLibrary } from "../store/useLibrary";
import { useEditSheet } from "../store/useEditSheet";
import { useAddSheet } from "../store/useAddSheet";
import { useCriticDraft } from "../store/useCriticDraft";
import type { Item, Status } from "../types";

function ItemDetail({ item }: { item: Item }) {
  const close = useSelectedItem((s) => s.close);
  const setStatus = useLibrary((s) => s.setStatus);
  const toggleFav = useLibrary((s) => s.toggleFav);
  const incrementEpisode = useLibrary((s) => s.incrementEpisode);
  const decrementEpisode = useLibrary((s) => s.decrementEpisode);
  const setEpisodesSeen = useLibrary((s) => s.setEpisodesSeen);
  const setRewatch = useLibrary((s) => s.setRewatch);
  const removeItem = useLibrary((s) => s.removeItem);
  const openEdit = useEditSheet((s) => s.openEdit);
  const openAddSheet = useAddSheet((s) => s.open);
  const setCriticQuestion = useCriticDraft((s) => s.setQuestion);
  const navigate = useNavigate();

  const containerRef = useFocusTrap(close);
  const titleId = `item-detail-${item.id}`;
  const [a, b] = paletteFor(item.title);
  const pct = item.kind !== "film" && item.episodes ? Math.round(((item.seen || 0) / item.episodes) * 100) : null;
  const watchedMinutes = item.kind === "film" ? (item.status === "Visto" ? item.runtime : 0) : (item.seen || 0) * item.runtime;

  return createPortal(
    <div className="fixed inset-0 z-70 overflow-y-auto bg-bg" ref={containerRef} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="relative h-56 overflow-hidden">
        <div className="absolute inset-0" style={{ background: `linear-gradient(150deg, ${b}, ${a})` }} />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-30 mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.35'/%3E%3C/svg%3E\")",
          }}
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 20%, var(--bg) 100%)" }} />
        <div className="absolute bottom-3.5 left-4 flex items-end gap-3.5 sm:left-6">
          <PosterArt item={item} size="lg" showTitle={false} className="w-20 shrink-0 shadow-[var(--shadow-lg)] sm:w-24" />
          {item.vote != null && (
            <div className="pb-1">
              <span className="font-mono tabular text-4xl font-semibold leading-none" style={{ color: voteColor(item.vote) }}>
                {item.vote}
              </span>
              <span className="text-sm text-white/60">/10</span>
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={close}
        aria-label="Torna indietro"
        className="fixed left-3.5 top-3.5 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur-md"
      >
        ←
      </button>

      <div className="mx-auto max-w-3xl px-4 pb-28 pt-4 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <h1 id={titleId} className="font-display text-2xl font-semibold leading-tight text-text">
            {item.title}
          </h1>
          <button
            type="button"
            onClick={() => toggleFav(item.id)}
            aria-pressed={item.fav}
            aria-label={item.fav ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}
            className="shrink-0 pt-0.5"
            style={{ color: item.fav ? "var(--accent)" : "var(--text-faint)" }}
          >
            <HeartIcon size={22} filled={item.fav} />
          </button>
        </div>

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {[item.year, item.genre, item.runtime ? formatRuntime(item.runtime) + (item.kind !== "film" ? "/ep" : "") : null, item.seasons ? `${item.seasons} stagioni` : null]
            .filter(Boolean)
            .map((v) => (
              <span key={String(v)} className="rounded-full border border-border-strong px-2.5 py-0.5 text-xs text-text-muted">
                {v}
              </span>
            ))}
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={{ background: "var(--surface-2)", color: "var(--text)" }}
          >
            {item.platform}
          </span>
        </div>

        {item.overview && <p className="mt-3.5 text-sm leading-relaxed text-text-muted">{item.overview}</p>}
        <PeopleLinks item={item} />

        <ItemSagaStrip item={item} />

        <div className="mt-5">
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-text-faint">Stato</span>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s: Status) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(item.id, s)}
                aria-pressed={item.status === s}
                className={`rounded-full transition-opacity ${item.status === s ? "opacity-100" : "opacity-45 hover:opacity-75"}`}
              >
                <StatusChip status={s} />
              </button>
            ))}
          </div>
        </div>

        {item.kind !== "film" && item.episodes ? (
          <div className="mt-4 rounded-md border border-border bg-surface-2 p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-text-faint">Avanzamento</span>
              <span className="font-mono tabular text-sm font-semibold" style={{ color: "var(--status-watching)" }}>
                {pct}%
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-hover">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "var(--status-watching)" }} />
            </div>
            <input
              type="range"
              min={0}
              max={item.episodes}
              value={item.seen || 0}
              onChange={(e) => setEpisodesSeen(item.id, Number(e.target.value))}
              aria-label="Episodi visti"
              className="mt-3 w-full accent-[var(--status-watching)]"
            />
            <div className="mt-1.5 flex justify-between text-[11px] text-text-faint">
              <span>
                {item.seen || 0} di {item.episodes} episodi
              </span>
              <span>{formatRuntime(watchedMinutes)} guardate</span>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => decrementEpisode(item.id)}
                className="flex-1 rounded-sm border border-border-strong bg-surface py-2 text-xs text-text-muted"
              >
                − 1 ep
              </button>
              <button
                type="button"
                onClick={() => incrementEpisode(item.id)}
                className="flex-[2] rounded-sm border py-2 text-xs font-semibold"
                style={{ borderColor: "color-mix(in srgb, var(--status-watching) 45%, transparent)", background: "color-mix(in srgb, var(--status-watching) 16%, transparent)", color: "var(--status-watching)" }}
              >
                Segna episodio visto
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex gap-3">
          <div className="flex-1 rounded-md border border-border bg-surface-2 p-3.5">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-text-faint">Rivisto</span>
            <div className="flex items-center justify-between">
              <span className="font-mono tabular text-xl font-semibold" style={{ color: "var(--accent-text)" }}>
                {item.rewatch || 0}×
              </span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setRewatch(item.id, (item.rewatch || 0) - 1)}
                  className="h-7 w-7 rounded-sm border border-border-strong text-text-muted"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() => setRewatch(item.id, (item.rewatch || 0) + 1)}
                  className="h-7 w-7 rounded-sm border text-sm"
                  style={{ borderColor: "color-mix(in srgb, var(--accent) 40%, transparent)", background: "color-mix(in srgb, var(--accent) 16%, transparent)", color: "var(--accent-text)" }}
                >
                  +
                </button>
              </div>
            </div>
          </div>
          {item.vote == null && (
            <button
              type="button"
              onClick={() => openEdit(item)}
              className="flex-1 rounded-md border border-dashed border-border-strong text-xs text-text-muted"
            >
              ★ Dai un voto
            </button>
          )}
        </div>

        {item.notes && (
          <div className="mt-4 rounded-md border border-border bg-surface-2 p-4">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-faint">Le tue note</span>
            <p className="text-sm italic leading-relaxed text-text">{item.notes}</p>
          </div>
        )}

        <WatchAndLinks item={item} />
        <LinkToTmdb item={item} />

        {item.similar.length > 0 && (
          <div className="mt-4">
            <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-text-faint">Se ti è piaciuto</span>
            <div className="flex flex-wrap gap-1.5">
              {item.similar.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    close();
                    openAddSheet(s);
                  }}
                  className="rounded-full border border-border-strong px-3 py-1.5 text-xs text-text-muted hover:bg-surface-hover"
                >
                  {s} <span style={{ color: "var(--accent-text)" }}>＋</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            setCriticQuestion(`Parlami di "${item.title}" e consigliami cosa guardare dopo`);
            close();
            navigate("/critico");
          }}
          className="mt-4 w-full rounded-md border py-3 text-sm font-semibold"
          style={{ borderColor: "color-mix(in srgb, var(--cyan) 35%, transparent)", background: "color-mix(in srgb, var(--cyan) 12%, transparent)", color: "var(--cyan)" }}
        >
          Chiedi al critico IA
        </button>

        <div className="mt-2.5 flex gap-2.5">
          <button
            type="button"
            onClick={() => openEdit(item)}
            className="flex-1 rounded-md border border-border-strong bg-surface-hover py-2.5 text-sm text-text"
          >
            Modifica
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Eliminare "${item.title}"?`)) {
                removeItem(item.id);
                close();
              }
            }}
            className="flex-1 rounded-md border py-2.5 text-sm"
            style={{ borderColor: "color-mix(in srgb, var(--danger) 35%, transparent)", background: "color-mix(in srgb, var(--danger) 10%, transparent)", color: "var(--danger)" }}
          >
            Elimina
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function ItemDetailSheetPortal() {
  const selected = useSelectedItem((s) => s.item);
  // Follow the live record rather than the snapshot captured on open, so edits
  // made from inside the sheet are reflected immediately. Falls back to the
  // snapshot for the frame between deleting an item and the sheet closing.
  const live = useLibrary((s) => (selected ? s.items.find((i) => i.id === selected.id) : undefined));
  const item = live ?? selected;
  return item ? <ItemDetail key={item.id} item={item} /> : null;
}
