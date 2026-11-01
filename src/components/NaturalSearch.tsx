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
import { CheckIcon } from "./icons";
import { t } from "../lib/i18n";

const EXAMPLES = [
  t("NaturalSearch.film_di_fantascienza_anni"),
  t("NaturalSearch.commedie_italiane_sotto_le"),
  t("NaturalSearch.thriller_con_denzel_washington"),
  t("NaturalSearch.serie_fantasy_uscite_dal"),
  t("NaturalSearch.i_migliori_horror_di"),
];

/** Restates the parsed filters as chips, so a wrong reading is visible before scrolling. */
function QueryChips({ query }: { query: ParsedQuery }) {
  const table = query.mediaType === "tv" ? TV_GENRES : MOVIE_GENRES;
  const chips: string[] = [
    query.mediaType === "tv" ? t("NaturalSearch.serie") : t("NaturalSearch.film"),
    ...query.genreIds.map((id) => table[id]).filter(Boolean),
  ];

  if (query.yearFrom && query.yearTo) chips.push(`${query.yearFrom}–${query.yearTo}`);
  else if (query.yearFrom) chips.push(t("NaturalSearch.dal", { v0: query.yearFrom }));
  else if (query.yearTo) chips.push(t("NaturalSearch.fino_al", { v0: query.yearTo }));

  if (query.runtimeMax) chips.push(t("NaturalSearch.sotto", { v0: query.runtimeMax }));
  if (query.runtimeMin) chips.push(t("NaturalSearch.oltre", { v0: query.runtimeMin }));
  if (query.voteMin) chips.push(t("NaturalSearch.voto", { v0: query.voteMin }));
  if (query.person) chips.push(query.person);
  if (query.keywords) chips.push(`“${query.keywords}”`);

  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((chip) => (
        <span key={chip} className="rounded-full bg-surface px-2.5 py-1 text-xs text-text-muted">
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
      if (e instanceof MissingApiKeyError) setError(t("NaturalSearch.serve_la_chiave_anthropic"));
      else if (e instanceof ClaudeApiError) setError(e.message);
      else setError(t("NaturalSearch.ricerca_non_riuscita_riprova"));
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
      setError(t("NaturalSearch.non_sono_riuscito_a"));
    }
    setPicking(null);
  };

  if (!apiKey) {
    return (
      <EmptyState
        title={t("NaturalSearch.serve_la_tua_chiave")}
        description={t("NaturalSearch.la_ricerca_a_frasi")}
        action={
          <button
            type="button"
            onClick={() => openSettings()}
            className="btn btn-primary"
          >
            {t("NaturalSearch.aggiungi_la_chiave")}
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
          placeholder={t("NaturalSearch.film_di_fantascienza_anni")}
          aria-label={t("NaturalSearch.descrivi_cosa_cerchi")}
          className="field min-w-0 flex-1"
        />
        <button
          type="submit"
          disabled={busy || !question.trim()}
          className="btn btn-primary shrink-0"
        >
          {busy ? t("NaturalSearch.cerco") : t("NaturalSearch.cerca")}
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
              className="chip chip-wrap"
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
        <div className="flex flex-col gap-2 rounded-lg bg-surface-2 p-3.5">
          <p className="text-sm text-text">{query.explanation || t("NaturalSearch.ecco_cosa_ho_cercato")}</p>
          <QueryChips query={query} />
        </div>
      )}

      {results && results.length === 0 && (
        <p className="text-sm text-text-muted">
          {t("NaturalSearch.nessun_titolo_con_questi")}
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
                aria-label={owned ? t("NaturalSearch.gia_in_libreria_apri", { v0: r.title }) : t("NaturalSearch.aggiungi_alla_libreria", { v0: r.title })}
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
                      className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur-sm"
                    >
                      <CheckIcon size={11} />
                    </span>
                  )}
                </div>
                <p className="mt-1.5 line-clamp-2 text-xs font-medium text-text">{r.title}</p>
                <p className="font-mono tabular text-xs text-text-faint">
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
