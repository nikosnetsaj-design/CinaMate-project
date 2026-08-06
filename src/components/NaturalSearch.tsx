import { useState } from "react";
import { useSettings } from "../store/useSettings";
import { useSettingsSheet } from "../store/useSettingsSheet";
import { useLibrary } from "../store/useLibrary";
import { useEditSheet } from "../store/useEditSheet";
import { useSelectedItem } from "../store/useSelectedItem";
import { PosterArt } from "../components/PosterArt";
import { EmptyState } from "../components/EmptyState";
import { parseNaturalQuery, MissingApiKeyError, ClaudeApiError, type ParsedQuery } from "../lib/anthropic";
import { discoverTitles, MOVIE_GENRES, TV_GENRES, type TmdbSearchResult } from "../lib/tmdb";
import { draftFromTmdb } from "../lib/addFromTmdb";

const EXAMPLES = [
  "film di fantascienza anni '90",
  "commedie italiane sotto le due ore",
  "thriller con Denzel Washington",
  "serie fantasy uscite dal 2020",
  "i migliori horror di sempre",
];

/** Restates the parsed filters as chips, so a wrong reading is visible before scrolling. */
function QueryChips({ query }: { query: ParsedQuery }) {
  const table = query.mediaType === "tv" ? TV_GENRES : MOVIE_GENRES;
  const chips: string[] = [
    query.mediaType === "tv" ? "Serie" : "Film",
    ...query.genreIds.map((id) => table[id]).filter(Boolean),
  ];

  if (query.yearFrom && query.yearTo) chips.push(`${query.yearFrom}–${query.yearTo}`);
  else if (query.yearFrom) chips.push(`dal ${query.yearFrom}`);
  else if (query.yearTo) chips.push(`fino al ${query.yearTo}`);

  if (query.runtimeMax) chips.push(`sotto ${query.runtimeMax}′`);
  if (query.runtimeMin) chips.push(`oltre ${query.runtimeMin}′`);
  if (query.voteMin) chips.push(`voto ≥ ${query.voteMin}`);
  if (query.person) chips.push(query.person);
  if (query.keywords) chips.push(`“${query.keywords}”`);

  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((chip) => (
        <span key={chip} className="rounded-full border border-border-strong px-2.5 py-0.5 text-xs text-text-muted">
          {chip}
        </span>
      ))}
    </div>
  );
}

export function NaturalSearch() {
  const apiKey = useSettings((s) => s.apiKey);
  const model = useSettings((s) => s.model);
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const openSettings = useSettingsSheet((s) => s.open);
  const items = useLibrary((s) => s.items);
  const openNew = useEditSheet((s) => s.openNew);
  const openItem = useSelectedItem((s) => s.open);

  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState<ParsedQuery | null>(null);
  const [results, setResults] = useState<TmdbSearchResult[] | null>(null);
  const [picking, setPicking] = useState<number | null>(null);

  const run = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    setResults(null);
    setQuery(null);
    try {
      // Two steps on purpose: Claude only chooses the filters, TMDB produces
      // the titles. See lib/anthropic for why the model is never asked for
      // the list itself.
      const parsed = await parseNaturalQuery(trimmed, apiKey, model);
      setQuery(parsed);
      setResults(await discoverTitles(parsed, tmdbApiKey));
    } catch (e) {
      if (e instanceof MissingApiKeyError) setError("Serve la chiave Anthropic per la ricerca in linguaggio naturale.");
      else if (e instanceof ClaudeApiError) setError(e.message);
      else setError("Ricerca non riuscita. Riprova.");
    } finally {
      setBusy(false);
    }
  };

  const choose = async (r: TmdbSearchResult) => {
    const owned = items.find((i) => i.tmdbId === r.tmdbId);
    if (owned) {
      openItem(owned);
      return;
    }
    setPicking(r.tmdbId);
    try {
      openNew(
        await draftFromTmdb(r.tmdbId, r.mediaType, r.kind, tmdbApiKey, {
          title: r.title,
          year: r.year,
          posterPath: r.posterPath,
        }),
      );
    } catch {
      setError("Non sono riuscito a caricare i dettagli di questo titolo.");
    }
    setPicking(null);
  };

  if (!apiKey) {
    return (
      <EmptyState
        title="Serve la tua chiave Anthropic"
        description="La ricerca a frasi traduce quello che scrivi in filtri per TMDB: Claude sceglie i filtri, il catalogo risponde. La chiave resta su questo dispositivo."
        action={
          <button
            type="button"
            onClick={() => openSettings()}
            className="rounded-sm px-4 py-2 text-sm font-semibold"
            style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
          >
            Aggiungi la chiave
          </button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(question);
        }}
        className="flex gap-2"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="film di fantascienza anni '90"
          aria-label="Descrivi cosa cerchi"
          className="min-w-0 flex-1 rounded-sm border border-border-strong bg-surface px-3 py-2.5 text-sm text-text"
        />
        <button
          type="submit"
          disabled={busy || !question.trim()}
          className="shrink-0 rounded-sm px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
          style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
        >
          {busy ? "Cerco…" : "Cerca"}
        </button>
      </form>

      {!query && !busy && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                setQuestion(example);
                void run(example);
              }}
              className="rounded-full border border-border-strong px-3 py-1.5 text-xs text-text-muted hover:bg-surface-hover"
            >
              {example}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}

      {query && (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-surface-2 p-3.5">
          <p className="text-sm text-text">{query.explanation || "Ecco cosa ho cercato."}</p>
          <QueryChips query={query} />
        </div>
      )}

      {results && results.length === 0 && (
        <p className="text-sm text-text-muted">
          Nessun titolo con questi filtri. Prova a chiedere in modo meno stretto — spesso è un anno
          o una durata di troppo.
        </p>
      )}

      {results && results.length > 0 && (
        <div className="grid grid-cols-3 gap-3.5 sm:grid-cols-4 md:grid-cols-6">
          {results.map((r) => {
            const owned = items.some((i) => i.tmdbId === r.tmdbId);
            return (
              <button
                key={r.tmdbId}
                type="button"
                onClick={() => choose(r)}
                disabled={picking !== null}
                aria-label={owned ? `${r.title} — già in libreria, apri` : `Aggiungi ${r.title} alla libreria`}
                className="text-left disabled:opacity-60"
              >
                <div className="relative">
                  <PosterArt
                    item={{ title: r.title, kind: r.kind, posterPath: r.posterPath }}
                    size="sm"
                    showTitle={!r.posterPath}
                  />
                  {owned && (
                    <span
                      className="absolute right-1 top-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
                    >
                      ✓
                    </span>
                  )}
                </div>
                <p className="mt-1.5 line-clamp-2 text-xs font-medium text-text">{r.title}</p>
                <p className="font-mono tabular text-[10px] text-text-faint">
                  {picking === r.tmdbId ? "…" : (r.year ?? "")}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
