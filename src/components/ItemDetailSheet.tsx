import { useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useFocusTrap } from "../lib/useFocusTrap";
import { paletteFor } from "../lib/palette";
import { formatRuntime } from "../lib/format";
import { STATUSES } from "../lib/status";
import { voteColor } from "../lib/vote";
import { backdropSrcSet, backdropUrl } from "../lib/tmdb";
import { PosterArt } from "./PosterArt";
import { StatusChip } from "./StatusChip";
import { WatchAndLinks } from "./WatchAndLinks";
import { WatchButton } from "./WatchButton";
import { LinkToTmdb } from "./LinkToTmdb";
import { ItemSagaStrip } from "./ItemSagaStrip";
import { CastRow } from "./CastRow";
import { ShareSheet } from "./ShareSheet";
import { SimilarTitles } from "./SimilarTitles";
import { EpisodeList } from "./EpisodeList";
import { DownloadButton } from "./DownloadButton";
import { SpoilerFreeRecap, TranslateOverview } from "./AiItemExtras";
import { HeartIcon, PlayIcon } from "./icons";
import { useSelectedItem } from "../store/useSelectedItem";
import { useLibrary } from "../store/useLibrary";
import { useEditSheet } from "../store/useEditSheet";
import { useCriticDraft } from "../store/useCriticDraft";
import { useTitleLogo } from "../lib/useTitleLogo";
import type { Item, Status } from "../types";

/**
 * Un'azione tonda della riga sotto ai pulsanti: icona grande, parola sotto.
 *
 * È la forma che usano tutte le app di streaming per lo stesso motivo — sono
 * cinque cose che si fanno *al* titolo, e messe in fila come pulsanti pieni
 * sembrerebbero tutte l'azione principale, che è invece una sola: Guarda.
 */
function RoundAction({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="flex min-w-14 flex-col items-center gap-1.5 text-[11px] font-medium"
      style={{ color: active ? "var(--accent-text)" : "var(--text-muted)" }}
    >
      <span
        className="flex h-11 w-11 items-center justify-center rounded-full border transition-colors"
        style={{
          borderColor: active ? "var(--accent)" : "var(--border-strong)",
          background: active ? "color-mix(in srgb, var(--accent) 16%, transparent)" : "transparent",
        }}
      >
        {children}
      </span>
      {label}
    </button>
  );
}

type Tab = "episodi" | "dettagli" | "saga" | "simili";

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
  const setCriticQuestion = useCriticDraft((s) => s.setQuestion);
  const navigate = useNavigate();

  const containerRef = useFocusTrap(close);
  const titleId = `item-detail-${item.id}`;
  const logo = useTitleLogo(item);
  const [sharing, setSharing] = useState(false);
  const [a, b] = paletteFor(item.title);
  const isSeries = item.kind !== "film" && item.kind !== "doc";
  const [tab, setTab] = useState<Tab>(isSeries ? "episodi" : "dettagli");
  const pct = isSeries && item.episodes ? Math.round(((item.seen || 0) / item.episodes) * 100) : null;
  const watchedMinutes = item.kind === "film" ? (item.status === "Visto" ? item.runtime : 0) : (item.seen || 0) * item.runtime;

  const TABS: { id: Tab; label: string }[] = [
    ...(isSeries ? [{ id: "episodi" as const, label: "Episodi" }] : []),
    { id: "dettagli", label: "Dettagli" },
    ...(item.collectionId != null ? [{ id: "saga" as const, label: "Saga" }] : []),
    { id: "simili", label: "Simili" },
  ];

  return createPortal(
    <div className="fixed inset-0 z-70 overflow-y-auto bg-bg" ref={containerRef} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      {/* L'intestazione larga, con il play sopra: è la prima cosa che si vede e
          la prima cosa che si vuole fare. La locandina verticale resta in
          basso a sinistra, perché è quella che rende il titolo riconoscibile. */}
      <div className="relative aspect-video max-h-[46vh] w-full overflow-hidden">
        <div className="absolute inset-0" style={{ background: `linear-gradient(150deg, ${b}, ${a})` }} />
        {item.backdropPath && (
          <img
            src={backdropUrl(item.backdropPath, "w1280") ?? undefined}
            srcSet={backdropSrcSet(item.backdropPath)}
            sizes="100vw"
            alt=""
            aria-hidden="true"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-30 mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.35'/%3E%3C/svg%3E\")",
          }}
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 35%, var(--bg) 100%)" }} />

        <button
          type="button"
          onClick={() => {
            close();
            navigate(`/player?titolo=${encodeURIComponent(item.id)}`);
          }}
          aria-label={`Riproduci ${item.title}`}
          className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white/85 bg-black/35 text-white backdrop-blur-[2px] transition-transform hover:scale-105"
        >
          <PlayIcon size={26} />
        </button>

        <div className="absolute bottom-3.5 left-4 flex items-end gap-3.5 sm:left-6">
          <PosterArt item={item} size="lg" showTitle={false} priority className="w-20 shrink-0 shadow-[var(--shadow-lg)] sm:w-24" />
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
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--accent-text)" }}>
          {item.platform}
        </span>
        <div className="mt-0.5 flex items-start justify-between gap-3">
          {/* Il logo disegnato quando TMDB ce l'ha, il titolo scritto quando
              non c'è. L'`h1` resta in entrambi i casi: l'immagine porta il
              testo nell'`alt`, così l'intestazione della pagina esiste anche
              per chi non la vede. */}
          <h1 id={titleId} className="font-display text-2xl font-semibold leading-tight text-text">
            {logo ? (
              <img src={logo} alt={item.title} className="max-h-16 w-auto max-w-[min(100%,20rem)] object-contain" />
            ) : (
              item.title
            )}
          </h1>
        </div>

        {/* La riga dei dati: anno, classificazione, quanto dura. Testo nudo
            separato da punti invece di sei pastiglie — sono fatti, non filtri,
            e incasellarli li faceva sembrare cliccabili. */}
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-muted">
          {[
            item.year || null,
            item.certification || null,
            isSeries && item.seasons ? `${item.seasons} stagion${item.seasons === 1 ? "e" : "i"}` : null,
            item.runtime ? formatRuntime(item.runtime) + (isSeries ? "/ep" : "") : null,
            item.genre || null,
            item.quality || null,
          ]
            .filter(Boolean)
            .map((value, i) => (
              <span key={String(value)} className="flex items-center gap-2">
                {i > 0 && <span aria-hidden="true" className="text-text-faint">·</span>}
                {value === item.certification || value === item.quality ? (
                  <span className="rounded-xs border border-border-strong px-1.5 py-px font-mono text-[11px]">{value}</span>
                ) : (
                  value
                )}
              </span>
            ))}
        </p>

        {/* Alto di proposito: "guardalo adesso" è il motivo per cui la scheda si
            apre dopo una ricerca, e stava sotto le note. */}
        <WatchButton item={item} onNavigate={close} />
        <DownloadButton item={item} />

        {/* Cinque azioni, tutte reversibili e tutte con un effetto visibile.
            "La mia lista" non c'è: in CineMate la lista *è* lo stato, che ha
            la sua riga di pastiglie in Dettagli, e un interruttore a due valori
            avrebbe dovuto inventare uno stato "non in lista" che non esiste. */}
        <div className="mt-4 flex flex-wrap justify-around gap-2 border-y border-border py-3">
          {item.trailerUrl && (
            <RoundAction label="Trailer" onClick={() => window.open(item.trailerUrl!, "_blank", "noopener")}>
              <PlayIcon size={17} />
            </RoundAction>
          )}
          <RoundAction label="Preferito" active={item.fav} onClick={() => toggleFav(item.id)}>
            <HeartIcon size={17} filled={item.fav} />
          </RoundAction>
          <RoundAction label="Voto" active={item.vote != null} onClick={() => openEdit(item)}>
            <span className="text-base leading-none">★</span>
          </RoundAction>
          <RoundAction
            label="Guardato"
            active={item.status === "Visto"}
            // Coppia onesta: "l'ho visto" e "voglio vederlo" sono i due stati
            // fra cui questo pulsante può spostarti senza inventare nulla.
            onClick={() => setStatus(item.id, item.status === "Visto" ? "Da vedere" : "Visto")}
          >
            <span className="text-base leading-none">👁</span>
          </RoundAction>
          <RoundAction label="Condividi" onClick={() => setSharing(true)}>
            <span className="text-base leading-none">↗</span>
          </RoundAction>
        </div>

        {item.overview && <p className="mt-4 text-sm leading-relaxed text-text-muted">{item.overview}</p>}

        {/* Il voto di TMDB sta qui e non accanto al tuo, in cima: sono due
            giudizi diversi e affiancarli suggerirebbe un confronto che non
            interessa a nessuno. Qui è un dato del titolo fra gli altri. */}
        {item.tmdbRating != null && (
          <p className="mt-2.5 flex items-center gap-2 text-sm text-text-muted">
            <span className="text-base leading-none" style={{ color: "var(--accent-text)" }}>
              ★
            </span>
            <span className="font-mono tabular font-semibold text-text">{item.tmdbRating.toFixed(1)}</span>
            <span className="text-text-faint">/10 · media di TMDB</span>
          </p>
        )}

        <CastRow item={item} />

        <div className="mt-5 flex gap-1 border-b border-border" role="tablist" aria-label="Sezioni del titolo">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`-mb-px rounded-t-sm border-b-2 px-3.5 py-2 text-sm font-medium transition-colors ${
                tab === t.id ? "text-text" : "border-transparent text-text-faint hover:text-text-muted"
              }`}
              style={tab === t.id ? { borderColor: "var(--accent)" } : undefined}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {tab === "episodi" && (
            <div className="flex flex-col gap-4">
              <EpisodeList item={item} onNavigate={close} />

              {item.episodes ? (
                <div className="rounded-md border border-border bg-surface-2 p-4">
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
            </div>
          )}

          {tab === "dettagli" && (
            <div className="flex flex-col">
              <div>
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

              <SpoilerFreeRecap item={item} />
              <TranslateOverview item={item} />

              {item.notes && (
                <div className="mt-4 rounded-md border border-border bg-surface-2 p-4">
                  <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-faint">Le tue note</span>
                  <p className="text-sm italic leading-relaxed text-text">{item.notes}</p>
                </div>
              )}

              <WatchAndLinks item={item} />
              <LinkToTmdb item={item} />

              <div className="mt-4 flex gap-2.5">
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
          )}

          {tab === "saga" && <ItemSagaStrip item={item} />}

          {tab === "simili" && (
            <div className="flex flex-col">
              <SimilarTitles item={item} />

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
            </div>
          )}
        </div>
      </div>

      {sharing && <ShareSheet target={{ kind: "item", item }} onClose={() => setSharing(false)} />}
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
