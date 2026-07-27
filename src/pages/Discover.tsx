import { useMemo, useState } from "react";
import { MOVIES, ALL_GENRES } from "../data/movies";
import { useSelectedMovie } from "../store/useSelectedMovie";
import { PosterCard } from "../components/PosterCard";
import { SearchBar } from "../components/SearchBar";
import { FilterChips } from "../components/FilterChips";
import { EmptyState } from "../components/EmptyState";
import { PosterGridSkeleton } from "../components/Skeletons";
import { useAppReady } from "../lib/useAppReady";
import type { Genre } from "../types";

export function Discover() {
  const ready = useAppReady();
  const openMovie = useSelectedMovie((s) => s.open);
  const [query, setQuery] = useState("");
  const [genres, setGenres] = useState<Genre[]>([]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MOVIES.filter((m) => {
      const matchesQuery =
        !q || m.title.toLowerCase().includes(q) || m.director.toLowerCase().includes(q);
      const matchesGenres = genres.length === 0 || genres.some((g) => m.genres.includes(g));
      return matchesQuery && matchesGenres;
    });
  }, [query, genres]);

  function toggleGenre(genre: Genre) {
    setGenres((prev) => (prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]));
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <div>
        <h1 className="font-display text-3xl font-semibold text-text">Scopri</h1>
        <p className="mt-1 text-sm text-text-muted">
          {MOVIES.length} film selezionati, da rivedere o da aggiungere alla tua lista.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBar value={query} onChange={setQuery} />
      </div>
      <FilterChips options={ALL_GENRES} active={genres} onToggle={toggleGenre} label="Filtra per genere" />

      {!ready ? (
        <PosterGridSkeleton />
      ) : results.length === 0 ? (
        <EmptyState
          title="Nessun film trovato"
          description={`Nessun risultato per la tua ricerca${query ? ` "${query}"` : ""}. Prova con un altro titolo o rimuovi i filtri.`}
          action={
            (query || genres.length > 0) && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setGenres([]);
                }}
                className="rounded-sm border border-border-strong px-4 py-2 text-sm font-medium text-text hover:bg-surface-hover"
              >
                Cancella filtri
              </button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {results.map((movie) => (
            <PosterCard key={movie.id} movie={movie} onOpen={openMovie} />
          ))}
        </div>
      )}
    </div>
  );
}
