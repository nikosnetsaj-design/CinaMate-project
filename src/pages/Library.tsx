import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
import { didYouMean, matchQuality } from "../lib/search";
import { activeFilterCount, applyFilters, type Filters } from "../lib/filters";
import { STATUSES } from "../lib/status";
import { useAppReady } from "../lib/useAppReady";
import { useVisibleItems } from "../lib/useVisibleItems";
import type { Kind, Status } from "../types";

/** I tipi che un indirizzo può nominare: di ciò che arriva scritto lì non ci si fida. */
const KIND_IDS: Kind[] = ["film", "serie", "anime", "doc"];

type Sort = "recenti" | "voto" | "titolo" | "anno";

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
  const [sort, setSort] = useState<Sort>("recenti");
  const [grid, setGrid] = useState(true);

  // Subtitle tracks live in the player's store, so the filter is handed a
  // lookup rather than reaching for the store itself — see lib/filters.
  const sources = usePlayerSources((s) => s.sources);
  const lookupSource = useMemo(() => (id: string) => sources[id], [sources]);

  const { list, onlyFuzzy } = useMemo(() => {
    const scored = applyFilters(items, filters, lookupSource)
      .map((item) => ({ item, quality: matchQuality(item, q) }))
      .filter((entry) => entry.quality !== "none");

    // Exact matches always outrank near-misses, whatever the sort — a typo
    // correction that buried the title you actually typed under three
    // approximations of it would be worse than no correction at all.
    const byRank = (a: (typeof scored)[number], b: (typeof scored)[number]) =>
      (a.quality === "exact" ? 0 : 1) - (b.quality === "exact" ? 0 : 1);

    const sorted = scored.sort((a, b) => {
      const rank = byRank(a, b);
      if (rank !== 0) return rank;
      if (sort === "voto") return (b.item.vote ?? 0) - (a.item.vote ?? 0);
      if (sort === "titolo") return a.item.title.localeCompare(b.item.title);
      if (sort === "anno") return b.item.year - a.item.year;
      return b.item.added.localeCompare(a.item.added);
    });

    return {
      list: sorted.map((entry) => entry.item),
      onlyFuzzy: sorted.length > 0 && sorted.every((entry) => entry.quality === "fuzzy"),
    };
  }, [items, filters, lookupSource, q, sort]);

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
    q.trim() || (filterCount > 0 ? "Selezione dalla mia libreria" : "La mia libreria");

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6 sm:py-10">
      <div>
        <h1 className="font-display text-3xl font-semibold text-text">Libreria</h1>
        <p className="mt-1 text-sm text-text-muted">{items.length} titoli in totale.</p>
      </div>

      <SearchBar value={q} onChange={setQ} placeholder="Cerca per titolo, regista, genere, attore…" />

      {suggestion && (
        <p className="text-sm text-text-muted">
          Forse cercavi{" "}
          <button
            type="button"
            onClick={() => setQ(suggestion)}
            className="font-medium underline underline-offset-2"
            style={{ color: "var(--accent-text)" }}
          >
            {suggestion}
          </button>
          ?
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
            filterCount > 0 ? "border-transparent" : "border-border-strong text-text-muted hover:bg-surface-hover"
          }`}
          style={filterCount > 0 ? { background: "var(--accent)", color: "var(--accent-contrast)" } : undefined}
        >
          Filtri
          {filterCount > 0 && <span className="font-mono">{filterCount}</span>}
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs text-text-faint">{list.length} titoli</span>
          {/* Shares exactly what is on screen, filters and search included —
              that is what makes it a *list* rather than an export: "gli horror
              che ho visto" is a query, and the query's result is the list. */}
          <button
            type="button"
            onClick={() => setSharing(true)}
            disabled={list.length === 0}
            aria-label="Condividi questa lista"
            className="rounded-sm border border-border-strong px-2 py-1 text-xs text-text-muted disabled:opacity-40"
          >
            Condividi
          </button>
          <button
            type="button"
            onClick={() => setGrid((g) => !g)}
            aria-label={grid ? "Vista elenco" : "Vista griglia"}
            className="rounded-sm border border-border-strong px-2 py-1 text-xs text-text-muted"
          >
            {grid ? "☰" : "▦"}
          </button>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            aria-label="Ordina per"
            className="rounded-sm border border-border-strong bg-surface px-2 py-1 text-xs text-text-muted"
          >
            <option value="recenti">Recenti</option>
            <option value="voto">Voto</option>
            <option value="titolo">A–Z</option>
            <option value="anno">Anno</option>
          </select>
        </div>
      </div>

      {!ready ? (
        <PosterGridSkeleton count={8} />
      ) : list.length === 0 ? (
        <EmptyState
          title={items.length === 0 ? "La tua libreria è vuota" : "Nessun risultato"}
          description={
            items.length === 0
              ? "Aggiungi il tuo primo titolo per iniziare a costruire la tua collezione."
              : "Nessun titolo corrisponde ai filtri attuali."
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
              className="rounded-sm border border-border-strong px-4 py-2 text-sm font-medium text-text hover:bg-surface-hover"
            >
              {items.length === 0 ? "Aggiungi un titolo" : "Azzera filtri"}
            </button>
          }
        />
      ) : grid ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {list.map((item) => (
            <PosterCard key={item.id} item={item} onOpen={openItem} progress />
          ))}
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {list.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => openItem(item)}
                aria-label={`Apri dettagli di ${item.title}, ${item.year}`}
                className="flex w-full items-center gap-3.5 rounded-md border border-border bg-surface p-3 text-left transition-colors hover:bg-surface-hover"
              >
                <PosterArt item={item} size="sm" className="w-12 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm font-semibold text-text">{item.title}</p>
                  <p className="mt-0.5 truncate text-xs text-text-faint">
                    {[item.year, item.genre, item.platform].filter(Boolean).join(" · ")}
                  </p>
                  <div className="mt-1">
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
