import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Sheet } from "./Sheet";
import { PosterArt } from "./PosterArt";
import { useAddSheet } from "../store/useAddSheet";
import { useEditSheet } from "../store/useEditSheet";
import { useSettings } from "../store/useSettings";
import { useSettingsSheet } from "../store/useSettingsSheet";
import { lookupTitles, MissingApiKeyError, ClaudeApiError } from "../lib/anthropic";
import { PLATFORMS } from "../types";
import type { Kind, LookupResult } from "../types";
import type { ItemDraft } from "../lib/draft";

const KINDS: Kind[] = ["film", "serie", "anime", "doc"];

function toDraft(r: LookupResult): Partial<ItemDraft> {
  return {
    title: r.title,
    kind: KINDS.includes(r.kind) ? r.kind : "film",
    year: r.year ?? new Date().getFullYear(),
    genre: r.genre ?? "",
    runtime: r.runtime ?? 0,
    episodes: r.episodes ?? null,
    seasons: r.seasons ?? null,
    overview: r.overview ?? "",
    director: r.director ?? "",
    cast: Array.isArray(r.cast) ? r.cast : [],
    similar: Array.isArray(r.similar) ? r.similar : [],
    platform: (PLATFORMS as readonly string[]).includes(r.platform) ? (r.platform as (typeof PLATFORMS)[number]) : "Altro",
  };
}

function AddItemForm() {
  const close = useAddSheet((s) => s.close);
  const prefillTitle = useAddSheet((s) => s.prefillTitle);
  const openNew = useEditSheet((s) => s.openNew);
  const openSettingsSheet = useSettingsSheet((s) => s.open);
  const apiKey = useSettings((s) => s.apiKey);
  const model = useSettings((s) => s.model);
  const titleId = "add-sheet-title";

  const [query, setQuery] = useState(prefillTitle);
  const [results, setResults] = useState<LookupResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [missingKey, setMissingKey] = useState(false);

  useEffect(() => {
    if (prefillTitle) void lookup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function lookup() {
    const term = query.trim();
    if (!term || busy) return;
    setBusy(true);
    setResults([]);
    setErr("");
    setMissingKey(false);
    try {
      const out = await lookupTitles(term, apiKey, model);
      setResults(out);
      if (out.length === 0) setErr("Nessun titolo trovato.");
    } catch (e) {
      if (e instanceof MissingApiKeyError) setMissingKey(true);
      else if (e instanceof ClaudeApiError) setErr(e.message);
      else setErr("Ricerca non riuscita. Riprova o inserisci a mano.");
    }
    setBusy(false);
  }

  function choose(r: LookupResult) {
    openNew(toDraft(r));
    close();
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
            Scrivi il nome — anno, genere, durata, episodi e trama si compilano da soli con l'IA.
          </p>
        </div>

        <div className="flex gap-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lookup()}
            placeholder="Es. Interstellar, The Bear, Naruto…"
            aria-label="Cerca un titolo"
            className="flex-1 rounded-sm border border-border-strong bg-surface px-3 py-2.5 text-sm text-text placeholder:text-text-faint focus:border-accent"
          />
          <button
            type="button"
            onClick={lookup}
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
            <span className="text-sm">Cerco nel database…</span>
          </div>
        )}

        {missingKey && !busy && (
          <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border-strong px-4 py-8 text-center">
            <p className="text-sm text-text-muted">
              Per la ricerca assistita da IA serve una chiave API Anthropic personale, salvata solo su questo dispositivo.
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
          results.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => choose(r)}
              className="flex items-center gap-3.5 rounded-md border border-border bg-surface-2 p-3 text-left transition-colors hover:bg-surface-hover"
            >
              <PosterArt item={{ title: r.title, kind: KINDS.includes(r.kind) ? r.kind : "film" }} size="sm" className="w-12 shrink-0" showTitle={false} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-sm font-semibold text-text">{r.title}</div>
                <div className="mt-0.5 truncate text-xs text-text-faint">
                  {[r.year, r.genre].filter(Boolean).join(" · ")}
                </div>
                {r.overview && <div className="mt-1 line-clamp-2 text-xs text-text-muted">{r.overview}</div>}
              </div>
              <span className="shrink-0 text-lg" style={{ color: "var(--accent)" }}>
                ＋
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
