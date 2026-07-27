import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Sheet } from "./Sheet";
import { PosterArt } from "./PosterArt";
import { useAddSheet } from "../store/useAddSheet";
import { useEditSheet } from "../store/useEditSheet";
import { useSettings } from "../store/useSettings";
import { useSettingsSheet } from "../store/useSettingsSheet";
import { searchTitles, getDetails, MissingTmdbKeyError, TmdbApiError, type TmdbSearchResult } from "../lib/tmdb";
import { PLATFORMS } from "../types";
import type { ItemDraft } from "../lib/draft";

function AddItemForm() {
  const close = useAddSheet((s) => s.close);
  const prefillTitle = useAddSheet((s) => s.prefillTitle);
  const openNew = useEditSheet((s) => s.openNew);
  const openSettingsSheet = useSettingsSheet((s) => s.open);
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const titleId = "add-sheet-title";

  const [query, setQuery] = useState(prefillTitle);
  const [results, setResults] = useState<TmdbSearchResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [pickingId, setPickingId] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [missingKey, setMissingKey] = useState(false);

  useEffect(() => {
    if (prefillTitle) void search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function search() {
    const term = query.trim();
    if (!term || busy) return;
    setBusy(true);
    setResults([]);
    setErr("");
    setMissingKey(false);
    try {
      const out = await searchTitles(term, tmdbApiKey);
      setResults(out);
      if (out.length === 0) setErr("Nessun titolo trovato.");
    } catch (e) {
      if (e instanceof MissingTmdbKeyError) setMissingKey(true);
      else if (e instanceof TmdbApiError) setErr(e.message);
      else setErr("Ricerca non riuscita. Riprova o inserisci a mano.");
    }
    setBusy(false);
  }

  async function choose(r: TmdbSearchResult) {
    setPickingId(r.tmdbId);
    setErr("");
    try {
      const details = await getDetails(r.tmdbId, r.mediaType, tmdbApiKey);
      const draft: Partial<ItemDraft> = {
        title: details.title || r.title,
        kind: r.kind,
        year: details.year ?? r.year ?? new Date().getFullYear(),
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
        tmdbMediaType: r.mediaType,
        posterPath: details.posterPath,
        trailerUrl: details.trailerUrl,
      };
      openNew(draft);
      close();
    } catch (e) {
      if (e instanceof TmdbApiError) setErr(e.message);
      else setErr("Impossibile recuperare i dettagli. Riprova.");
    }
    setPickingId(null);
  }

  function manual() {
    openNew({ title: query });
    close();
  }

  return (
    <Sheet onClose={close} titleId={titleId}>
      <div className="flex flex-col gap-4 p-5 pt-8 sm:p-6">
        <div>
          <h2 id={titleId} className="font-display text-xl font-semibold text-text">
            Cerca un titolo
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            Scrivi il nome — copertina, trama, cast e "dove guardarlo" arrivano da TMDB, il database di film e serie
            usato da app come Letterboxd e Trakt.
          </p>
        </div>

        <div className="flex gap-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="Es. Interstellar, The Bear, Naruto…"
            aria-label="Cerca un titolo"
            className="flex-1 rounded-sm border border-border-strong bg-surface px-3 py-2.5 text-sm text-text placeholder:text-text-faint focus:border-accent"
          />
          <button
            type="button"
            onClick={search}
            disabled={busy || !query.trim()}
            className="min-w-14 rounded-sm px-4 text-lg font-bold disabled:opacity-50"
            style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
          >
            {busy ? "…" : "→"}
          </button>
        </div>

        {busy && (
          <div className="flex flex-col items-center gap-3 py-8 text-text-muted">
            <div
              className="spinner h-6 w-6 rounded-full border-2"
              style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
            />
            <span className="text-sm">Cerco su TMDB…</span>
          </div>
        )}

        {missingKey && !busy && (
          <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border-strong px-4 py-8 text-center">
            <p className="text-sm text-text-muted">
              Per cercare titoli con copertine reali serve una chiave API TMDB gratuita, salvata solo su questo
              dispositivo. Si ottiene in pochi minuti su themoviedb.org.
            </p>
            <button
              type="button"
              onClick={() => {
                close();
                openSettingsSheet();
              }}
              className="rounded-sm border border-border-strong px-4 py-2 text-sm font-medium text-text hover:bg-surface-hover"
            >
              Aggiungi la tua chiave nelle Impostazioni
            </button>
          </div>
        )}

        {!missingKey &&
          results.map((r) => (
            <button
              key={r.tmdbId}
              type="button"
              onClick={() => choose(r)}
              disabled={pickingId !== null}
              className="flex items-center gap-3.5 rounded-md border border-border bg-surface-2 p-3 text-left transition-colors hover:bg-surface-hover disabled:opacity-60"
            >
              <PosterArt item={{ title: r.title, kind: r.kind, posterPath: r.posterPath }} size="sm" className="w-12 shrink-0" showTitle={false} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-sm font-semibold text-text">{r.title}</div>
                <div className="mt-0.5 truncate text-xs text-text-faint">{r.year}</div>
                {r.overview && <div className="mt-1 line-clamp-2 text-xs text-text-muted">{r.overview}</div>}
              </div>
              <span className="shrink-0 text-lg" style={{ color: "var(--accent)" }}>
                {pickingId === r.tmdbId ? "…" : "＋"}
              </span>
            </button>
          ))}

        {err && !busy && !missingKey && <p className="py-2 text-center text-sm text-text-muted">{err}</p>}

        <button
          type="button"
          onClick={manual}
          className="mt-1 rounded-md border border-dashed border-border-strong px-4 py-3 text-sm text-text-muted hover:bg-surface-hover"
        >
          Inserisci a mano
        </button>
      </div>
    </Sheet>
  );
}

export function AddItemSheetPortal() {
  const isOpen = useAddSheet((s) => s.isOpen);
  return <AnimatePresence>{isOpen && <AddItemForm />}</AnimatePresence>;
}
