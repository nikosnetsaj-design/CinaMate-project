import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Sheet } from "./Sheet";
import { PosterArt } from "./PosterArt";
import { CatalogBlock } from "./NeedsCatalog";
import { CatalogCard } from "./CatalogCard";
import { CloseIcon, SearchIcon } from "./icons";
import { useAddSheet } from "../store/useAddSheet";
import { useEditSheet } from "../store/useEditSheet";
import { useLibrary } from "../store/useLibrary";
import { useSelectedItem } from "../store/useSelectedItem";
import { useCatalogPreview } from "../store/useCatalogPreview";
import { useSettings } from "../store/useSettings";
import { getFeed, MissingTmdbKeyError, TmdbAbortError, TmdbApiError, type TmdbSearchResult } from "../lib/tmdb";
import { searchTitlesForgiving } from "../lib/tmdbSearch";
import { matchQuality } from "../lib/search";
import { ownedFor, useQuickAdd, catalogKey } from "../lib/useQuickAdd";
import type { Item } from "../types";
import { statusLabel, t } from "../lib/i18n";

/** Long enough that a word isn't searched letter by letter, short enough to feel live. */
const DEBOUNCE_MS = 350;
const MIN_CHARS = 2;
const RESULTS = 18;

type KindFilter = "tutto" | "movie" | "tv";

/**
 * Aggiungere un titolo.
 *
 * Era un modulo: un campo, un elenco di righe, un'anteprima, e alla fine un
 * secondo modulo da compilare con quello che TMDB sapeva già. Adesso è una
 * ricerca che si guarda: le locandine arrivano mentre scrivi, un tocco apre
 * la scheda intera del titolo (sopra questo foglio, che resta lì con la tua
 * ricerca), e il «+» nell'angolo lo mette in «Da vedere» senza altre domande.
 * A foglio vuoto c'è quello di cui si parla questa settimana, perché la
 * domanda più frequente qui è «cosa mi metto in lista?».
 *
 * Il modulo resta per quello che il catalogo non ha: «Aggiungilo a mano», in
 * fondo, con il titolo già scritto.
 */
function AddItemForm() {
  const close = useAddSheet((s) => s.close);
  const prefillTitle = useAddSheet((s) => s.prefillTitle);
  const openNew = useEditSheet((s) => s.openNew);
  const openItem = useSelectedItem((s) => s.open);
  const openPreview = useCatalogPreview((s) => s.open);
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const items = useLibrary((s) => s.items);
  const { quickAdd, pending } = useQuickAdd();
  const titleId = "add-sheet-title";

  const [query, setQuery] = useState(prefillTitle);
  const [results, setResults] = useState<TmdbSearchResult[]>([]);
  const [corrected, setCorrected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [missingKey, setMissingKey] = useState(!tmdbApiKey);
  const [kind, setKind] = useState<KindFilter>("tutto");
  const [trending, setTrending] = useState<TmdbSearchResult[] | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const term = query.trim();
  const searching = term.length >= MIN_CHARS;

  /**
   * What you already own, matched with the same forgiving rules as the library
   * search. Answering "you have this" costs nothing and is the answer to the
   * question people are usually asking when they type a title they half
   * remember — and it works with no API key and no network.
   */
  const owned = useMemo(() => {
    if (!searching) return [] as Item[];
    return items.filter((i) => matchQuality(i, term) !== "none").slice(0, 6);
  }, [items, term, searching]);

  // A foglio vuoto: i film e le serie della settimana, alternati.
  useEffect(() => {
    if (!tmdbApiKey) return;
    let cancelled = false;
    Promise.all([getFeed("trending", tmdbApiKey), getFeed("trendingTv", tmdbApiKey)])
      .then(([films, series]) => {
        if (cancelled) return;
        const mixed: TmdbSearchResult[] = [];
        for (let i = 0; i < Math.max(films.length, series.length); i++) {
          if (films[i]) mixed.push(films[i]);
          if (series[i]) mixed.push(series[i]);
        }
        setTrending(mixed.slice(0, 12));
      })
      .catch(() => !cancelled && setTrending([]));
    return () => {
      cancelled = true;
    };
  }, [tmdbApiKey]);

  // Search as you type. Every keystroke cancels the request before it, so a
  // slow answer for "inte" can never land on top of the results for
  // "interstellar" — the classic way live search shows the wrong list.
  useEffect(() => {
    abortRef.current?.abort();

    if (!searching) {
      setResults([]);
      setCorrected(false);
      setBusy(false);
      setErr("");
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);

    const timer = window.setTimeout(async () => {
      try {
        const found = await searchTitlesForgiving(term, tmdbApiKey, controller.signal, RESULTS);
        if (controller.signal.aborted) return;
        setResults(found.results);
        setCorrected(found.corrected);
        setErr(found.results.length === 0 ? t("AddItemSheet.nessun_titolo_trovato_nemmeno") : "");
        setMissingKey(false);
      } catch (e) {
        if (controller.signal.aborted || e instanceof TmdbAbortError) return;
        setResults([]);
        if (e instanceof MissingTmdbKeyError) setMissingKey(true);
        else if (e instanceof TmdbApiError) setErr(e.message);
        else setErr(t("AddItemSheet.ricerca_non_riuscita_riprova"));
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [term, searching, tmdbApiKey]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const shown = kind === "tutto" ? results : results.filter((r) => r.mediaType === kind);

  /** La scheda di un titolo che hai sta sotto questo foglio: prima si chiude. */
  function openOwned(item: Item) {
    close();
    openItem(item);
  }

  function openResult(r: TmdbSearchResult) {
    const mine = ownedFor(items, r);
    if (mine) openOwned(mine);
    else openPreview(r);
  }

  function manual() {
    openNew({ title: term });
    close();
  }

  const grid = (list: TmdbSearchResult[]) => (
    <div className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4">
      {list.map((r) => (
        <CatalogCard
          key={catalogKey(r)}
          title={r}
          owned={ownedFor(items, r)}
          pending={pending.has(catalogKey(r))}
          onOpen={() => openResult(r)}
          onQuickAdd={() => void quickAdd(r)}
        />
      ))}
    </div>
  );

  return (
    <Sheet onClose={close} titleId={titleId} maxWidthClass="max-w-2xl">
      {/* Alto da subito: il foglio non salta su e giù mentre i risultati arrivano. */}
      <div className="flex min-h-[80dvh] flex-col gap-5 p-5 pt-8 sm:min-h-[600px] sm:p-7 sm:pt-9">
        <div className="pr-10">
          <p className="text-xs font-semibold" style={{ color: "var(--accent-text)" }}>
            {t("AddItemSheet.aggiungi_alla_libreria")}
          </p>
          <h2 id={titleId} className="t-display mt-1 text-text">
            {t("AddItemSheet.cosa_hai_in_mente")}
          </h2>
        </div>

        {/* La ricerca è la protagonista: grande, tonda, con la lente dentro. */}
        <div className="sticky top-0 z-10 -mx-5 -mt-1 bg-surface px-5 pb-1 pt-1 sm:-mx-7 sm:px-7">
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-faint" aria-hidden="true">
              <SearchIcon size={20} />
            </span>
            <input
              ref={inputRef}
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("AddItemSheet.film_serie_anime")}
              aria-label={t("AddItemSheet.cerca_un_titolo")}
              aria-busy={busy}
              enterKeyHint="search"
              className="h-14 w-full rounded-full bg-surface-2 pl-12 pr-12 text-base text-text shadow-[inset_0_0_0_1px_var(--separator)] outline-none transition-shadow placeholder:text-text-faint focus:shadow-[inset_0_0_0_2px_var(--accent)]"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                aria-label={t("AddItemSheet.cancella")}
                className="icon-btn icon-btn-sm absolute right-2.5 top-1/2 -translate-y-1/2"
              >
                <CloseIcon size={16} />
              </button>
            )}
          </div>

          {searching && results.length > 0 && (
            <div className="segmented mt-3" role="tablist" aria-label={t("AddItemSheet.tipo")}>
              {(["tutto", "movie", "tv"] as const).map((k) => (
                <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)}>
                  {k === "tutto" ? t("AddItemSheet.tutto") : k === "movie" ? t("AddItemSheet.film") : t("AddItemSheet.serie")}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* What you already own comes first: the fastest possible answer to
            "do I have this?", and it needs neither key nor network. */}
        {owned.length > 0 && (
          <section className="flex flex-col gap-2.5">
            <h3 className="text-sm font-medium text-text-muted">{t("AddItemSheet.gia_nella_tua_libreria")}</h3>
            <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 sm:-mx-7 sm:px-7">
              {owned.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openOwned(item)}
                  className="flex w-56 shrink-0 items-center gap-3 rounded-md bg-surface-2 p-2 pr-3 text-left transition-colors hover:bg-surface-hover"
                >
                  <PosterArt item={item} size="sm" className="w-10 shrink-0" showTitle={false} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-text">{item.title}</span>
                    <span className="block truncate text-xs text-text-muted">
                      {item.year} · {statusLabel(item.status)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {missingKey && <CatalogBlock />}

        {/* Said out loud, because these answer a question slightly different
            from the one that was asked. */}
        {corrected && results.length > 0 && (
          <p className="-mb-2 text-xs text-text-muted">
            {t("AddItemSheet.nessun_risultato_esatto_per")}{term}{t("AddItemSheet.forse_cercavi")}
          </p>
        )}

        {!missingKey && searching && busy && results.length === 0 && (
          <div aria-hidden="true" className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i}>
                <div className="skeleton aspect-2/3 w-full rounded-sm" />
                <div className="skeleton mt-2 h-3.5 w-3/4 rounded-xs" />
                <div className="skeleton mt-1.5 h-3 w-1/3 rounded-xs" />
              </div>
            ))}
          </div>
        )}

        {!missingKey && searching && shown.length > 0 && <section aria-label={t("AddItemSheet.risultati")}>{grid(shown)}</section>}

        {!missingKey && !searching && trending && trending.length > 0 && (
          <section className="flex flex-col gap-3">
            <div>
              <h3 className="t-section text-text">{t("AddItemSheet.di_tendenza")}</h3>
              <p className="text-xs text-text-muted">{t("AddItemSheet.tocca_per_la_scheda")}</p>
            </div>
            {grid(trending)}
          </section>
        )}

        {err && !busy && !missingKey && searching && (
          <p className="py-2 text-center text-sm text-text-muted">{err}</p>
        )}

        <div className="mt-auto flex flex-col items-center gap-1 border-t border-separator pt-4 text-center">
          <p className="text-xs text-text-muted">{t("AddItemSheet.non_lo_trovi")}</p>
          <button type="button" onClick={manual} className="btn btn-plain btn-sm">
            {term ? t("AddItemSheet.aggiungi_a_mano_titolo", { v0: term }) : t("AddItemSheet.aggiungilo_a_mano")}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

export function AddItemSheetPortal() {
  const isOpen = useAddSheet((s) => s.isOpen);
  return <AnimatePresence>{isOpen && <AddItemForm />}</AnimatePresence>;
}
