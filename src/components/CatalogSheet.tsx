import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "../lib/useFocusTrap";
import { paletteFor } from "../lib/palette";
import { formatRuntime } from "../lib/format";
import { useTitleLogo } from "../lib/useTitleLogo";
import { useAddFromCatalog } from "../lib/useAddFromCatalog";
import { backdropSrcSet, backdropUrl, getDetails, TmdbApiError, type TmdbDetails } from "../lib/tmdb";
import { useCatalogPreview, type CatalogTarget } from "../store/useCatalogPreview";
import { useSelectedItem } from "../store/useSelectedItem";
import { useLibrary } from "../store/useLibrary";
import { useSettings } from "../store/useSettings";
import { CatalogNote } from "./NeedsCatalog";
import { PosterArt } from "./PosterArt";
import { CastRow } from "./CastRow";
import { TitleFacts } from "./TitleFacts";
import { RelatedRow } from "./RelatedRow";
import { WatchProvidersBlock } from "./WatchAndLinks";
import { PlayIcon, PlusIcon } from "./icons";
import type { Item } from "../types";

/**
 * La scheda di un titolo che non hai — la stessa di quelli che hai, meno le
 * cose che si possono fare solo a ciò che è tuo.
 *
 * Prima, per leggere una trama o vedere il cast di un risultato di ricerca
 * bisognava *aggiungerlo*: si decideva prima di avere in mano le cose su cui si
 * decide, e chi guardava per curiosità si ritrovava lo scaffale da riordinare.
 * Adesso il tocco apre questa, e «Aggiungi alla libreria» resta un passo
 * separato — che è l'ordine giusto.
 *
 * Trama, cast, dove guardarlo, troupe, incassi, media e correlati sono gli
 * stessi componenti della scheda vera: ricevono un `Item` costruito al volo dai
 * dati TMDB, che non entra in libreria e non viene salvato da nessuna parte.
 */

/** Il record che i componenti della scheda si aspettano, costruito dal catalogo. */
function previewItem(target: CatalogTarget, details: TmdbDetails | null): Item {
  return {
    // Id vuoto: è il segno che questo titolo non sta in libreria. Chi scrive
    // (sessioni di visione, progressi) lo controlla prima di toccare nulla.
    id: "",
    title: details?.title || target.title,
    kind: target.kind,
    year: details?.year ?? target.year ?? 0,
    genre: details?.genre ?? "",
    status: "Da vedere",
    vote: null,
    platform: "Altro",
    runtime: details?.runtime ?? 0,
    episodes: details?.episodes ?? null,
    seen: 0,
    seasons: details?.seasons ?? null,
    fav: false,
    rewatch: 0,
    overview: details?.overview ?? "",
    director: details?.director ?? "",
    cast: details?.cast ?? [],
    similar: details?.similar ?? [],
    notes: "",
    added: "",
    tmdbId: target.tmdbId,
    tmdbMediaType: target.mediaType,
    posterPath: details?.posterPath ?? target.posterPath,
    backdropPath: details?.backdropPath ?? null,
    trailerUrl: details?.trailerUrl ?? null,
    links: [],
    collectionId: details?.collectionId ?? null,
    collectionName: details?.collectionName ?? null,
    studio: details?.studio,
    countries: details?.countries,
    tmdbRating: details?.tmdbRating ?? null,
    audioLangs: details?.audioLangs,
    certification: details?.certification,
  };
}

function CatalogDetail({ target }: { target: CatalogTarget }) {
  const close = useCatalogPreview((s) => s.close);
  const openItem = useSelectedItem((s) => s.open);
  const items = useLibrary((s) => s.items);
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const { add, adding } = useAddFromCatalog(close);

  const containerRef = useFocusTrap(close);
  const titleId = `catalog-${target.tmdbId}`;
  const [details, setDetails] = useState<TmdbDetails | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!tmdbApiKey) return;
    let cancelled = false;
    setDetails(null);
    setError("");
    getDetails(target.tmdbId, target.mediaType, tmdbApiKey)
      .then((d) => {
        if (!cancelled) setDetails(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof TmdbApiError ? e.message : "Non è stato possibile leggere questo titolo.");
      });
    return () => {
      cancelled = true;
    };
  }, [target.tmdbId, target.mediaType, tmdbApiKey]);

  const item = previewItem(target, details);
  const logo = useTitleLogo(item);
  const [a, b] = paletteFor(item.title);
  const owned = items.find((i) => i.tmdbId === target.tmdbId && i.tmdbMediaType === target.mediaType);
  const isSeries = item.kind !== "film" && item.kind !== "doc";

  return createPortal(
    <div
      className="fixed inset-0 z-70 overflow-y-auto bg-bg"
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
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
          className="absolute inset-0"
          style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 35%, var(--bg) 100%)" }}
        />

        {/* Il trailer al posto del play: di un titolo che non hai, questa è
            l'unica cosa che si può davvero riprodurre. */}
        {item.trailerUrl && (
          <button
            type="button"
            onClick={() => window.open(item.trailerUrl!, "_blank", "noopener")}
            aria-label={`Guarda il trailer di ${item.title}`}
            className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white/85 bg-black/35 text-white backdrop-blur-[2px] transition-transform hover:scale-105"
          >
            <PlayIcon size={26} />
          </button>
        )}

        <div className="absolute bottom-3.5 left-4 sm:left-6">
          <PosterArt item={item} size="lg" showTitle={false} priority className="w-20 shrink-0 shadow-[var(--shadow-lg)] sm:w-24" />
        </div>
      </div>

      <button
        type="button"
        onClick={close}
        aria-label="Torna indietro"
        className="tap-target fixed left-3.5 top-3.5 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur-md"
      >
        ←
      </button>

      <div className="mx-auto max-w-3xl px-4 pb-28 pt-4 sm:px-6">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--accent-text)" }}>
          {isSeries ? "Serie · non in libreria" : "Film · non in libreria"}
        </span>

        <h1 id={titleId} className="mt-0.5 font-display text-2xl font-semibold leading-tight text-text">
          {logo ? (
            <img src={logo} alt={item.title} className="max-h-16 w-auto max-w-[min(100%,20rem)] object-contain" />
          ) : (
            item.title
          )}
        </h1>

        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-muted">
          {[
            item.year || null,
            item.certification || null,
            isSeries && item.seasons ? `${item.seasons} stagion${item.seasons === 1 ? "e" : "i"}` : null,
            item.runtime ? formatRuntime(item.runtime) + (isSeries ? "/ep" : "") : null,
            item.genre || null,
          ]
            .filter(Boolean)
            .map((value, i) => (
              <span key={String(value)} className="flex items-center gap-2">
                {i > 0 && <span aria-hidden="true" className="text-text-faint">·</span>}
                {value === item.certification ? (
                  <span className="rounded-xs border border-border-strong px-1.5 py-px font-mono text-[11px]">{value}</span>
                ) : (
                  value
                )}
              </span>
            ))}
        </p>

        {/* L'unica azione che questa scheda può offrire, e l'unica che serve:
            portarlo dentro. Il foglio si apre compilato — resta una decisione,
            non un tocco a caso. */}
        {owned ? (
          <button
            type="button"
            onClick={() => {
              close();
              openItem(owned);
            }}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border py-3.5 text-sm font-semibold"
            style={{
              borderColor: "color-mix(in srgb, var(--accent) 45%, transparent)",
              background: "color-mix(in srgb, var(--accent) 14%, transparent)",
              color: "var(--accent-text)",
            }}
          >
            Ce l'hai già — apri la tua scheda →
          </button>
        ) : (
          <button
            type="button"
            disabled={adding !== null}
            onClick={() =>
              void add({
                tmdbId: target.tmdbId,
                mediaType: target.mediaType,
                kind: target.kind,
                title: item.title,
                year: item.year || null,
                posterPath: item.posterPath,
              })
            }
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-md py-3.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
          >
            <PlusIcon size={18} />
            {adding !== null ? "Preparo la scheda…" : "Aggiungi alla libreria"}
          </button>
        )}

        {!tmdbApiKey && (
          <div className="mt-3">
            <CatalogNote what="Trama, cast e disponibilità arrivano da TMDB." />
          </div>
        )}
        {error && <p className="mt-3 text-sm text-text-muted">{error}</p>}

        {item.overview ? (
          <p className="mt-4 text-sm leading-relaxed text-text-muted">{item.overview}</p>
        ) : (
          tmdbApiKey &&
          !details &&
          !error && (
            <div className="mt-4 flex flex-col gap-2" aria-hidden="true">
              <div className="skeleton h-3 w-full rounded-xs" />
              <div className="skeleton h-3 w-11/12 rounded-xs" />
              <div className="skeleton h-3 w-2/3 rounded-xs" />
            </div>
          )
        )}

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
        <WatchProvidersBlock item={item} />
        <TitleFacts item={item} />

        <div className="mt-6">
          <RelatedRow item={item} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function CatalogSheetPortal() {
  const target = useCatalogPreview((s) => s.target);
  return target ? <CatalogDetail key={`${target.mediaType}-${target.tmdbId}`} target={target} /> : null;
}
