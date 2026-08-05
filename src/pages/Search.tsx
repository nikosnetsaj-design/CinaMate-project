import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLibrary } from "../store/useLibrary";
import { useSettings } from "../store/useSettings";
import { useSettingsSheet } from "../store/useSettingsSheet";
import { useSelectedItem } from "../store/useSelectedItem";
import { useSelectedPerson } from "../store/useSelectedPerson";
import { useTitlePreview } from "../store/useTitlePreview";
import { useWatchProgress } from "../store/useWatchProgress";
import { useVisibleItems } from "../lib/useVisibleItems";
import { matchesQuery, didYouMean } from "../lib/search";
import { searchTitlesForgiving } from "../lib/tmdbSearch";
import { searchPeople, profileUrl, backdropUrl, posterUrl, type TmdbPersonHit, type TmdbSearchResult } from "../lib/tmdb";
import { continueWatching, lastSeenDates } from "../lib/continueWatching";
import { forYou } from "../lib/recommend";
import { prefetchHandlers } from "../lib/prefetch";
import { PosterArt } from "../components/PosterArt";
import { PlayIcon, SearchIcon } from "../components/icons";
import type { Item } from "../types";

/**
 * Cerca: una casella, due schede, e — quando la casella è vuota — qualcosa da
 * guardare invece di una pagina bianca.
 *
 * Esisteva già una ricerca, ma viveva dentro la palette dei comandi: ottima da
 * tastiera e introvabile su un telefono, dove "cerca" è una destinazione e non
 * una scorciatoia. Questa è quella destinazione. Interroga insieme la tua
 * libreria e TMDB, e tiene le due cose separate sullo schermo: quello che hai
 * si apre, quello che non hai si aggiunge.
 */

type Tab = "titoli" | "persone";

/** Riga larga con il play tondo: la forma della lista dei consigliati. */
function SuggestionRow({ item, reason }: { item: Item; reason?: string }) {
  const navigate = useNavigate();
  const openItem = useSelectedItem((s) => s.open);
  const wide = backdropUrl(item.backdropPath, "w780") ?? posterUrl(item.posterPath, "w342");

  return (
    <li className="flex items-center gap-3">
      <button type="button" onClick={() => openItem(item)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-sm bg-surface-2 sm:w-36">
          {wide ? (
            <img src={wide} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
          ) : (
            <PosterArt item={item} size="sm" className="h-full w-full" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-text">{item.title}</span>
          {reason && <span className="block truncate text-[11px] text-text-faint">{reason}</span>}
        </span>
      </button>
      <button
        type="button"
        {...prefetchHandlers("/player")}
        onClick={() => navigate(`/player?titolo=${encodeURIComponent(item.id)}`)}
        aria-label={`Riproduci ${item.title}`}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border-strong text-text transition-colors hover:bg-surface-hover"
      >
        <PlayIcon size={18} />
      </button>
    </li>
  );
}

function PersonResults({ query }: { query: string }) {
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const openPerson = useSelectedPerson((s) => s.open);
  const [people, setPeople] = useState<TmdbPersonHit[] | null>(null);

  useEffect(() => {
    if (!query || !tmdbApiKey) return;
    const controller = new AbortController();
    setPeople(null);
    searchPeople(query, tmdbApiKey, controller.signal)
      .then((r) => setPeople(r))
      .catch(() => setPeople([]));
    return () => controller.abort();
  }, [query, tmdbApiKey]);

  if (!query) return <p className="text-sm text-text-faint">Scrivi il nome di un attore o di un regista.</p>;
  if (people === null) {
    return (
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton aspect-square rounded-full" aria-hidden="true" />
        ))}
      </div>
    );
  }
  if (people.length === 0) return <p className="text-sm text-text-faint">Nessuna persona con questo nome.</p>;

  return (
    <div className="grid grid-cols-3 gap-4 sm:grid-cols-5">
      {people.map((person) => (
        <button key={person.id} type="button" onClick={() => openPerson(person.name)} className="text-center">
          <span className="block aspect-square overflow-hidden rounded-full bg-surface-2">
            {person.profilePath ? (
              <img
                src={profileUrl(person.profilePath) ?? undefined}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center font-display text-xl text-text-faint">
                {person.name.slice(0, 1)}
              </span>
            )}
          </span>
          <span className="mt-1.5 block line-clamp-2 text-xs font-medium text-text">{person.name}</span>
          {person.knownFor.length > 0 && (
            <span className="mt-0.5 block line-clamp-2 text-[11px] leading-snug text-text-faint">
              {person.knownFor.join(" · ")}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function TitleResults({ query }: { query: string }) {
  const items = useVisibleItems();
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const openItem = useSelectedItem((s) => s.open);
  const openPreview = useTitlePreview((s) => s.open);
  const [remote, setRemote] = useState<TmdbSearchResult[] | null>(null);
  const [corrected, setCorrected] = useState<string | null>(null);

  const mine = useMemo(() => (query ? items.filter((i) => matchesQuery(i, query)) : []), [items, query]);
  const suggestion = useMemo(() => (query && mine.length === 0 ? didYouMean(query, items) : null), [query, mine, items]);

  useEffect(() => {
    if (!query || !tmdbApiKey) {
      setRemote(null);
      return;
    }
    const controller = new AbortController();
    setRemote(null);
    setCorrected(null);
    // Mezzo secondo di attesa: la ricerca parte mentre scrivi, e senza questa
    // pausa ogni lettera sarebbe una richiesta buttata via dalla successiva.
    const timer = window.setTimeout(() => {
      searchTitlesForgiving(query, tmdbApiKey, controller.signal, 18)
        .then((r) => {
          setRemote(r.results);
          setCorrected(r.corrected ? r.usedTerm : null);
        })
        .catch(() => setRemote([]));
    }, 450);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, tmdbApiKey]);

  // Toccare un risultato *mostra* il titolo, non lo salva: trama, cast, durata
  // e dove guardarlo sono i fatti che servono per decidere se salvarlo, e
  // chiederli dopo l'inserimento è l'ordine al contrario.
  function show(result: TmdbSearchResult) {
    const owned = items.find((i) => i.tmdbId === result.tmdbId);
    if (owned) openItem(owned);
    else openPreview(result);
  }

  const ownedIds = new Set(items.map((i) => i.tmdbId).filter((id): id is number => id != null));

  return (
    <div className="flex flex-col gap-6">
      {mine.length > 0 && (
        <section>
          <h2 className="mb-2.5 text-xs font-medium uppercase tracking-wide text-text-faint">
            Nella tua libreria · {mine.length}
          </h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {mine.map((item) => (
              <button key={item.id} type="button" onClick={() => openItem(item)} className="text-left">
                <PosterArt item={item} size="sm" />
                <p className="mt-1.5 line-clamp-2 text-xs font-medium text-text">{item.title}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {suggestion && (
        <p className="text-sm text-text-muted">
          Nessun titolo tuo per «{query}». Forse cercavi <strong className="text-text">{suggestion}</strong>?
        </p>
      )}

      {tmdbApiKey ? (
        <section>
          <h2 className="mb-2.5 text-xs font-medium uppercase tracking-wide text-text-faint">Su TMDB</h2>
          {corrected && (
            <p className="mb-2 text-xs text-text-faint">
              Niente per «{query}»: questi sono i risultati per «{corrected}».
            </p>
          )}
          {remote === null ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton aspect-2/3 rounded-sm" aria-hidden="true" />
              ))}
            </div>
          ) : remote.length === 0 ? (
            <p className="text-sm text-text-faint">Nessun risultato.</p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {remote.map((result) => {
                const owned = ownedIds.has(result.tmdbId);
                return (
                  <button
                    key={result.tmdbId}
                    type="button"
                    onClick={() => show(result)}
                    aria-label={owned ? `${result.title} — già in libreria, apri` : `Vedi i dettagli di ${result.title}`}
                    className="text-left"
                  >
                    <div className="relative">
                      <PosterArt
                        item={{ title: result.title, kind: result.kind, posterPath: result.posterPath }}
                        size="sm"
                        showTitle={!result.posterPath}
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
                    <p className="mt-1.5 line-clamp-2 text-xs font-medium text-text">{result.title}</p>
                    <p className="font-mono tabular text-[10px] text-text-faint">{result.year ?? ""}</p>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <p className="text-sm text-text-faint">
          Con la chiave TMDB questa ricerca copre anche i titoli che non hai ancora.
        </p>
      )}
    </div>
  );
}

export function Search() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("titoli");
  const inputRef = useRef<HTMLInputElement>(null);
  const items = useVisibleItems();
  const history = useLibrary((s) => s.history);
  const progress = useWatchProgress((s) => s.progress);
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const openSettings = useSettingsSheet((s) => s.open);

  // Cosa proporre a casella vuota: prima quello che hai lasciato a metà, poi i
  // consigli dallo scaffale. Ognuno con la sua riga di motivo, come ovunque.
  const suggestions = useMemo(() => {
    const resuming = continueWatching(items, progress, lastSeenDates(history)).slice(0, 4);
    const seen = new Set(resuming.map((r) => r.item.id));
    const picks = forYou(items, 6).filter((s) => !seen.has(s.item.id));
    return [
      ...resuming.map((r) => ({ item: r.item, reason: `${r.label} · ${r.pct}% visto` })),
      ...picks.map((s) => ({ item: s.item, reason: s.reason })),
    ].slice(0, 8);
  }, [items, progress, history]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-10">
      <h1 className="font-display text-3xl font-semibold text-text">Cerca</h1>

      {/* La casella resta appesa in alto mentre la griglia scorre: su un
          telefono, correggere una parola non deve costare una risalita. */}
      <div className="sticky top-14 z-20 -mx-4 bg-bg px-4 py-2 md:top-0 sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-2.5 rounded-full border border-border-strong bg-surface-2 px-4 py-2.5">
          <SearchIcon size={18} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca serie, film e persone…"
            aria-label="Cerca"
            autoFocus
            className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-faint"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              aria-label="Cancella la ricerca"
              className="text-text-faint hover:text-text"
            >
              ✕
            </button>
          )}
        </div>

        <div className="mt-2 flex gap-2" role="tablist" aria-label="Cosa cercare">
          {([
            { id: "titoli", label: "Film & TV" },
            { id: "persone", label: "Persone" },
          ] as const).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === t.id ? "" : "border border-border-strong text-text-muted hover:bg-surface-hover"
              }`}
              style={tab === t.id ? { background: "var(--accent)", color: "var(--accent-contrast)" } : undefined}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {!query && tab === "titoli" ? (
        suggestions.length > 0 ? (
          <section>
            <h2 className="mb-3 font-display text-xl font-semibold text-text">Da riprendere e da provare</h2>
            <ul className="flex flex-col gap-3">
              {suggestions.map(({ item, reason }) => (
                <SuggestionRow key={item.id} item={item} reason={reason} />
              ))}
            </ul>
          </section>
        ) : (
          <p className="text-sm text-text-faint">
            Scrivi un titolo. {!tmdbApiKey && (
              <button type="button" onClick={openSettings} className="underline underline-offset-2">
                Con la chiave TMDB cerchi anche fuori dalla tua libreria.
              </button>
            )}
          </p>
        )
      ) : tab === "titoli" ? (
        <TitleResults query={query.trim()} />
      ) : (
        <PersonResults query={query.trim()} />
      )}
    </div>
  );
}
