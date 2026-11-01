import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useLists } from "../store/useLists";
import { useSelectedItem } from "../store/useSelectedItem";
import { useAddSheet } from "../store/useAddSheet";
import { usePlayerSources } from "../store/usePlayerSources";
import { SearchBar } from "../components/SearchBar";
import { PosterCard } from "../components/PosterCard";
import { PosterArt } from "../components/PosterArt";
import { StatusChip } from "../components/StatusChip";
import { VoteBadge } from "../components/VoteBadge";
import { EmptyState } from "../components/EmptyState";
import { PosterGridSkeleton } from "../components/Skeletons";
import { FilterSheet } from "../components/FilterSheet";
import { ShareSheet } from "../components/ShareSheet";
import { didYouMean } from "../lib/search";
import { activeFilterCount, type Filters } from "../lib/filters";
import { describeQuery, runQuery, SORTS, type Sort } from "../lib/listing";
import { STATUSES } from "../lib/status";
import { useAppReady } from "../lib/useAppReady";
import { useVisibleItems } from "../lib/useVisibleItems";
import type { Kind, Status } from "../types";
import { BookmarkIcon, GridIcon, ListIcon, ShareIcon } from "../components/icons";
import { t } from "../lib/i18n";

/** I tipi che un indirizzo può nominare: di ciò che arriva scritto lì non ci si fida. */
const KIND_IDS: Kind[] = ["film", "serie", "anime", "doc"];


export function Library() {
  const ready = useAppReady();
  const items = useVisibleItems();
  const openItem = useSelectedItem((s) => s.open);
  const openAddSheet = useAddSheet((s) => s.open);

  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<Filters>({});
  const [filtersOpen, setFiltersOpen] = useState(false);

  /*
   * Genere, tipo e stato possono arrivare dall'indirizzo: è così che le
   * pastiglie in cima alla Home portano qui con il filtro già acceso. Restano
   * filtri come gli altri — il pannello li mostra e li toglie — e l'indirizzo
   * si pulisce subito dopo, così un aggiornamento della pagina non li rimette
   * da solo.
   */
  const [params, setParams] = useSearchParams();
  const genreParam = params.get("genere");
  const kindParam = params.get("tipo");
  const statusParam = params.get("stato");
  useEffect(() => {
    if (!genreParam && !kindParam && !statusParam) return;
    setFilters((current) => ({
      ...current,
      ...(genreParam ? { genre: genreParam } : {}),
      ...(KIND_IDS.includes(kindParam as Kind) ? { kind: kindParam as Kind } : {}),
      ...(STATUSES.includes(statusParam as Status) ? { status: statusParam as Status } : {}),
    }));
    setParams({}, { replace: true });
  }, [genreParam, kindParam, statusParam, setParams]);
  const [sharing, setSharing] = useState(false);
  const createSmart = useLists((s) => s.createSmart);
  const navigate = useNavigate();
  const [sort, setSort] = useState<Sort>("recenti");
  const [grid, setGrid] = useState(true);

  // Subtitle tracks live in the player's store, so the filter is handed a
  // lookup rather than reaching for the store itself — see lib/filters.
  const sources = usePlayerSources((s) => s.sources);
  const lookupSource = useMemo(() => (id: string) => sources[id], [sources]);

  // Exact matches always outrank near-misses, whatever the sort — see
  // lib/listing, which the smart lists share.
  const { list, onlyFuzzy } = useMemo(
    () => runQuery(items, { filters, q, sort }, lookupSource),
    [items, filters, lookupSource, q, sort],
  );

  // Only offered when nothing matched exactly: over exact hits it would be
  // noise, and the suggestion is deliberately a title that really exists on
  // the shelf rather than a guess at what was meant.
  const suggestion = useMemo(
    () => (list.length === 0 || onlyFuzzy ? didYouMean(q, items) : null),
    [list.length, onlyFuzzy, q, items],
  );

  const filterCount = activeFilterCount(filters);

  // The list's name is its query. A shared link that arrived called "Libreria"
  // when it is actually four horror films would be worse than useless to
  // whoever opens it.
  const listName =
    q.trim() || (filterCount > 0 ? describeQuery({ filters, sort }).join(" · ") || "Selezione dalla mia libreria" : "La mia libreria");

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-[var(--gutter)] py-6 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="t-display text-text">{t("page.library")}</h1>
          <p className="mt-1 text-sm tabular text-text-muted">{t("page.library.count", { n: items.length })}</p>
        </div>
        {/* Due altri modi di guardare lo stesso scaffale. Sul telefono la barra
            laterale non c'è, e senza questi due collegamenti saghe e liste
            sarebbero raggiungibili solo dal menu. */}
        <nav aria-label={t("library.otherViews")} className="flex gap-2">
          <Link to="/saghe" viewTransition className="chip">
            {t("nav.sagas")}
          </Link>
          <Link to="/liste" viewTransition className="chip">
            {t("nav.lists")}
          </Link>
        </nav>
      </div>

      <SearchBar value={q} onChange={setQ} placeholder={t("library.search")} />

      {suggestion && (
        <p className="text-sm text-text-muted">
          Forse cercavi{" "}
          <button
            type="button"
            onClick={() => setQ(suggestion)}
            className="font-medium text-accent-text underline underline-offset-2"
          >
            {suggestion}
          </button>
          ?
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className="chip"
          data-active={filterCount > 0}
        >
          {t("library.filters")}
          {filterCount > 0 && <span className="tabular">{filterCount}</span>}
        </button>

        <div className="flex min-w-0 items-center gap-1">
          {/* Il conteggio compare solo quando dice qualcosa di nuovo: senza filtri
              né ricerca ripeteva i «titoli in totale» scritti appena sopra. */}
          {list.length !== items.length && (
            <span className="mr-1 whitespace-nowrap text-xs text-text-faint tabular">{list.length} titoli</span>
          )}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            aria-label={t("library.sortBy")}
            className="field field-sm w-auto"
          >
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setGrid((g) => !g)}
            aria-label={grid ? t("library.viewList") : t("library.viewGrid")}
            className="icon-btn"
          >
            {grid ? <ListIcon size={20} /> : <GridIcon size={20} />}
          </button>
          {/* Una ricerca che vale la pena ritrovare diventa una lista che si
              aggiorna da sola. Compare solo quando c'è una ricerca da salvare. */}
          {(filterCount > 0 || q.trim()) && (
            <button
              type="button"
              onClick={() => {
                const id = createSmart(listName, { filters, q: q.trim() || undefined, sort });
                navigate(`/liste/${id}`, { viewTransition: true });
              }}
              aria-label={t("library.saveSmart")}
              title="Salva come lista intelligente"
              className="icon-btn"
            >
              <BookmarkIcon size={20} />
            </button>
          )}
          {/* Shares exactly what is on screen, filters and search included —
              that is what makes it a *list* rather than an export: "gli horror
              che ho visto" is a query, and the query's result is the list. */}
          <button
            type="button"
            onClick={() => setSharing(true)}
            disabled={list.length === 0}
            aria-label={t("library.share")}
            className="icon-btn disabled:opacity-40"
          >
            <ShareIcon size={20} />
          </button>
        </div>
      </div>

      {!ready ? (
        <PosterGridSkeleton count={8} />
      ) : list.length === 0 ? (
        /* Due situazioni, due frasi: la libreria vuota usa le stesse parole della
           Home — era una delle quattro frasi diverse per dire «non c'è niente» —
           e quella filtrata dice cosa fare invece di constatare. */
        <EmptyState
          title={items.length === 0 ? "Lo scaffale è tuo da riempire." : "Niente con questi filtri"}
          description={
            items.length === 0
              ? "Cerca un film o una serie che hai visto: copertina, trama, cast e durata arrivano da soli."
              : "Prova a toglierne uno, o a cercare con un'altra parola."
          }
          action={
            <button
              type="button"
              onClick={() => {
                if (items.length === 0) {
                  openAddSheet();
                  return;
                }
                setQ("");
                setFilters({});
              }}
              className={items.length === 0 ? "btn btn-primary" : "btn btn-secondary"}
            >
              {items.length === 0 ? "Aggiungi il primo titolo" : "Togli filtri e ricerca"}
            </button>
          }
        />
      ) : grid ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {list.map((item) => (
            <PosterCard key={item.id} item={item} onOpen={openItem} progress />
          ))}
        </div>
      ) : (
        <ul className="list-group">
          {list.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => openItem(item)}
                aria-label={`Apri dettagli di ${item.title}, ${item.year}`}
                className="list-row gap-4"
              >
                <PosterArt item={item} size="sm" showTitle={false} className="w-12 shrink-0 rounded-xs" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-medium text-text">{item.title}</p>
                  <p className="mt-0.5 truncate text-sm tabular text-text-muted">
                    {[item.year, item.genre, item.platform].filter(Boolean).join(" · ")}
                  </p>
                  <div className="mt-1.5">
                    <StatusChip status={item.status} size="sm" />
                  </div>
                </div>
                <VoteBadge vote={item.vote} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {filtersOpen && (
        <FilterSheet
          items={items}
          filters={filters}
          onChange={setFilters}
          onClose={() => setFiltersOpen(false)}
          resultCount={list.length}
        />
      )}

      {sharing && (
        <ShareSheet
          target={{ kind: "list", name: listName, items: list }}
          onClose={() => setSharing(false)}
        />
      )}
    </div>
  );
}
