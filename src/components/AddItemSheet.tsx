import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Sheet } from "./Sheet";
import { PosterArt } from "./PosterArt";
import { CatalogBlock } from "./NeedsCatalog";
import { TitlePreview } from "./TitlePreview";
import { useAddSheet } from "../store/useAddSheet";
import { useEditSheet } from "../store/useEditSheet";
import { useLibrary } from "../store/useLibrary";
import { useSelectedItem } from "../store/useSelectedItem";
import { useSettings } from "../store/useSettings";
import { MissingTmdbKeyError, TmdbAbortError, TmdbApiError, type TmdbDetails, type TmdbSearchResult } from "../lib/tmdb";
import { searchTitlesForgiving } from "../lib/tmdbSearch";
import { matchQuality } from "../lib/search";
import { PLATFORMS } from "../types";
import type { Item } from "../types";
import type { ItemDraft } from "../lib/draft";

/** Long enough that a word isn't searched letter by letter, short enough to feel live. */
const DEBOUNCE_MS = 350;
const MIN_CHARS = 2;

function AddItemForm() {
  const close = useAddSheet((s) => s.close);
  const prefillTitle = useAddSheet((s) => s.prefillTitle);
  const openNew = useEditSheet((s) => s.openNew);
  const openItem = useSelectedItem((s) => s.open);
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const items = useLibrary((s) => s.items);
  const titleId = "add-sheet-title";

  const [query, setQuery] = useState(prefillTitle);
  const [results, setResults] = useState<TmdbSearchResult[]>([]);
  const [corrected, setCorrected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<TmdbSearchResult | null>(null);
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState("");
  const [missingKey, setMissingKey] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  /**
   * What you already own, matched with the same forgiving rules as the library
   * search. Answering "you have this" costs nothing and is the answer to the
   * question people are usually asking when they type a title they half
   * remember — and it works with no API key and no network.
   */
  const owned = useMemo(() => {
    const term = query.trim();
    if (term.length < MIN_CHARS) return [] as Item[];
    return items.filter((i) => matchQuality(i, term) !== "none").slice(0, 4);
  }, [items, query]);

  const ownedTmdbIds = useMemo(
    () => new Set(items.map((i) => i.tmdbId).filter((id): id is number => typeof id === "number")),
    [items],
  );

  // Search as you type. Every keystroke cancels the request before it, so a
  // slow answer for "inte" can never land on top of the results for
  // "interstellar" — the classic way live search shows the wrong list.
  useEffect(() => {
    const term = query.trim();
    abortRef.current?.abort();

    if (term.length < MIN_CHARS) {
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
        const found = await searchTitlesForgiving(term, tmdbApiKey, controller.signal);
        if (controller.signal.aborted) return;
        setResults(found.results);
        setCorrected(found.corrected);
        setErr(found.results.length === 0 ? "Nessun titolo trovato, nemmeno cercando qualcosa di simile." : "");
        setMissingKey(false);
      } catch (e) {
        if (controller.signal.aborted || e instanceof TmdbAbortError) return;
        setResults([]);
        if (e instanceof MissingTmdbKeyError) setMissingKey(true);
        else if (e instanceof TmdbApiError) setErr(e.message);
        else setErr("Ricerca non riuscita. Riprova o inserisci a mano.");
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, tmdbApiKey]);

  useEffect(() => () => abortRef.current?.abort(), []);

  function addFromDetails(details: TmdbDetails, result: TmdbSearchResult) {
    setAdding(true);
    const draft: Partial<ItemDraft> = {
      title: details.title || result.title,
      kind: result.kind,
      year: details.year ?? result.year ?? new Date().getFullYear(),
      genre: details.genre,
      runtime: details.runtime,
      episodes: details.episodes,
      seasons: details.seasons,
      overview: details.overview,
      director: details.director,
      cast: details.cast,
      similar: details.similar,
      platform: (PLATFORMS as readonly string[]).includes(details.watchProviders[0]?.name ?? "")
        ? (details.watchProviders[0].name as (typeof PLATFORMS)[number])
        : "Altro",
      tmdbId: details.tmdbId,
      tmdbMediaType: result.mediaType,
      posterPath: details.posterPath,
      trailerUrl: details.trailerUrl,
    };
    openNew(draft);
    close();
  }

  function manual() {
    openNew({ title: query });
    close();
  }

  return (
    <Sheet onClose={close} titleId={titleId}>
      <div className="flex flex-col gap-4 p-5 pt-8 sm:p-6">
        {preview ? (
          <>
            <h2 id={titleId} className="sr-only">
              Dettagli di {preview.title}
            </h2>
            <TitlePreview
              result={preview}
              apiKey={tmdbApiKey}
              adding={adding}
              alreadyInLibrary={ownedTmdbIds.has(preview.tmdbId)}
              onBack={() => setPreview(null)}
              onAdd={(details) => addFromDetails(details, preview)}
            />
          </>
        ) : (
          <>
            <div>
              <h2 id={titleId} className="font-display text-xl font-semibold text-text">
                Cerca un titolo
              </h2>
              <p className="mt-1 text-sm text-text-muted">
                Scrivi il nome: i risultati arrivano mentre digiti, e tocca un titolo per vederne trama, cast e
                durata prima di deciderlo. Se sbagli una lettera, cerco lo stesso qualcosa di simile.
              </p>
            </div>

            <div className="relative">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Es. Interstellar, The Bear, Naruto…"
                aria-label="Cerca un titolo"
                className="w-full rounded-sm border border-border-strong bg-surface px-3 py-2.5 pr-10 text-sm text-text placeholder:text-text-faint focus:border-accent"
              />
              {busy && (
                <span
                  aria-hidden="true"
                  className="spinner absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2"
                  style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
                />
              )}
            </div>

            {/* What you already own comes first: the fastest possible answer to
                "do I have this?", and it needs neither key nor network. */}
            {owned.length > 0 && (
              <section className="flex flex-col gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-text-faint">Già nella tua libreria</p>
                {owned.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      close();
                      openItem(item);
                    }}
                    className="flex items-center gap-3 rounded-md border border-border bg-surface-2 p-2.5 text-left transition-colors hover:bg-surface-hover"
                  >
                    <PosterArt
                      item={item}
                      size="sm"
                      className="w-10 shrink-0"
                      showTitle={false}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-text">{item.title}</div>
                      <div className="truncate text-xs text-text-faint">
                        {item.year} · {item.status}
                      </div>
                    </div>
                  </button>
                ))}
              </section>
            )}

            {missingKey && <CatalogBlock />}

            {/* Said out loud, because these answer a question slightly different
                from the one that was asked. */}
            {corrected && results.length > 0 && (
              <p className="text-xs text-text-muted">
                Nessun risultato esatto per «{query.trim()}». Forse cercavi:
              </p>
            )}

            {!missingKey &&
              results.map((r) => (
                <button
                  key={`${r.mediaType}-${r.tmdbId}`}
                  type="button"
                  onClick={() => setPreview(r)}
                  className="flex items-center gap-3.5 rounded-md border border-border bg-surface-2 p-3 text-left transition-colors hover:bg-surface-hover"
                >
                  <PosterArt
                    item={{ title: r.title, kind: r.kind, posterPath: r.posterPath }}
                    size="sm"
                    className="w-12 shrink-0"
                    showTitle={false}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display text-sm font-semibold text-text">{r.title}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-text-faint">
                      <span>{r.year ?? "—"}</span>
                      {ownedTmdbIds.has(r.tmdbId) && (
                        <span style={{ color: "var(--accent-text)" }}>· ce l'hai già</span>
                      )}
                    </div>
                    {r.overview && <div className="mt-1 line-clamp-2 text-xs text-text-muted">{r.overview}</div>}
                  </div>
                  <span className="shrink-0 text-sm text-text-faint">›</span>
                </button>
              ))}

            {err && !busy && !missingKey && query.trim().length >= MIN_CHARS && (
              <p className="py-2 text-center text-sm text-text-muted">{err}</p>
            )}

            <button
              type="button"
              onClick={manual}
              className="mt-1 rounded-md border border-dashed border-border-strong px-4 py-3 text-sm text-text-muted hover:bg-surface-hover"
            >
              Inserisci a mano
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}

export function AddItemSheetPortal() {
  const isOpen = useAddSheet((s) => s.isOpen);
  return <AnimatePresence>{isOpen && <AddItemForm />}</AnimatePresence>;
}
