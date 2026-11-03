import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "../lib/useFocusTrap";
import { paletteFor } from "../lib/palette";
import { formatRuntime } from "../lib/format";
import { useTitleLogo } from "../lib/useTitleLogo";
import { useAddFromCatalog } from "../lib/useAddFromCatalog";
import { ownedFor, useQuickAdd } from "../lib/useQuickAdd";
import { useRateSheet } from "../store/useRateSheet";
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
import { BackIcon, CheckIcon, ChevronRightIcon, EyeIcon, PlayIcon, PlusIcon, StarIcon } from "./icons";
import type { Item, Status } from "../types";
import { statusLabel, t } from "../lib/i18n";

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
  // «Con più dettagli» apre il modulo compilato, per chi vuole scegliere
  // piattaforma, note e il resto prima di salvare.
  const { add, adding } = useAddFromCatalog(close);
  const { quickAdd, pending } = useQuickAdd();
  const openRate = useRateSheet((s) => s.open);

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
        if (!cancelled) setError(e instanceof TmdbApiError ? e.message : t("CatalogSheet.non_e_stato_possibile"));
      });
    return () => {
      cancelled = true;
    };
  }, [target.tmdbId, target.mediaType, tmdbApiKey]);

  const item = previewItem(target, details);
  const logo = useTitleLogo(item);
  const [a, b] = paletteFor(item.title);
  const owned = ownedFor(items, target);
  const busy = pending.size > 0;

  async function addAs(status: Status) {
    const added = await quickAdd(
      { tmdbId: target.tmdbId, mediaType: target.mediaType, kind: target.kind, title: item.title, year: item.year || null, posterPath: item.posterPath },
      status,
    );
    // Visto e senza voto: la domanda che viene subito dopo.
    if (added && status === "Visto" && added.vote == null) openRate(added.id);
  }
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
            aria-label={t("CatalogSheet.guarda_il_trailer_di", { v0: item.title })}
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
        aria-label={t("CatalogSheet.torna_indietro")}
        className="icon-btn fixed left-3 top-3 z-20 bg-black/45 text-white backdrop-blur-md hover:bg-black/65 hover:text-white"
      >
        <BackIcon />
      </button>

      <div className="mx-auto max-w-3xl px-4 pb-28 pt-4 sm:px-6">
        <span className="text-xs font-semibold" style={{ color: "var(--accent-text)" }}>
          {isSeries ? t("CatalogSheet.serie_non_in_libreria") : t("CatalogSheet.film_non_in_libreria")}
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
            isSeries && item.seasons ? t(item.seasons === 1 ? "CatalogSheet.stagione" : "CatalogSheet.stagioni", { v0: item.seasons }) : null,
            item.runtime ? formatRuntime(item.runtime) + (isSeries ? "/ep" : "") : null,
            item.genre || null,
          ]
            .filter(Boolean)
            .map((value, i) => (
              <span key={String(value)} className="flex items-center gap-2">
                {i > 0 && <span aria-hidden="true" className="text-text-faint">·</span>}
                {value === item.certification ? (
                  <span className="rounded-xs border border-border-strong px-1.5 py-px font-mono text-xs">{value}</span>
                ) : (
                  value
                )}
              </span>
            ))}
        </p>

        {/* Le uniche azioni che questa scheda può offrire, ed è quello che
            serve: portarlo dentro, dicendo a che punto sei. Niente modulo —
            quello che il modulo chiedeva lo sa già TMDB. */}
        {owned ? (
          <div className="mt-4 flex items-center gap-3 rounded-lg bg-surface p-3 pl-4 shadow-[var(--shadow-sm)]">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
              aria-hidden="true"
            >
              <CheckIcon size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text">{t("CatalogSheet.nella_tua_libreria")}</p>
              <p className="truncate text-xs text-text-muted">
                {statusLabel(owned.status)}
                {owned.vote != null ? ` · ${owned.vote}/10` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                close();
                openItem(owned);
              }}
              className="btn btn-secondary btn-sm shrink-0"
            >
              {t("CatalogSheet.apri_la_scheda")}
              <ChevronRightIcon size={16} />
            </button>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-2">
            <button type="button" disabled={busy} onClick={() => void addAs("Da vedere")} className="btn btn-primary btn-lg w-full">
              {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" /> : <PlusIcon size={18} />}
              {t("CatalogSheet.aggiungi_a_da_vedere")}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={busy} onClick={() => void addAs("Visto")} className="btn btn-secondary">
                <EyeIcon size={16} />
                {t("CatalogSheet.l_ho_visto")}
              </button>
              <button type="button" disabled={busy} onClick={() => void addAs("In visione")} className="btn btn-secondary">
                <PlayIcon size={14} />
                {t("CatalogSheet.sto_guardando")}
              </button>
            </div>
            <button
              type="button"
              disabled={busy || adding !== null}
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
              className="btn btn-plain btn-sm self-center text-text-muted"
            >
              {adding !== null ? t("CatalogSheet.preparo_la_scheda") : t("CatalogSheet.aggiungi_con_piu_dettagli")}
            </button>
          </div>
        )}

        {!tmdbApiKey && (
          <div className="mt-3">
            <CatalogNote what={t("CatalogSheet.trama_cast_e_disponibilita")} />
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
              <StarIcon size={14} filled />
            </span>
            <span className="font-mono tabular font-semibold text-text">{item.tmdbRating.toFixed(1)}</span>
            <span className="text-text-faint">{t("CatalogSheet.media_di_tmdb")}</span>
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
