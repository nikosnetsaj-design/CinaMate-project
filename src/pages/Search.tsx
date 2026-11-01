import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLibrary } from "../store/useLibrary";
import { useSettings } from "../store/useSettings";
import { useSettingsSheet } from "../store/useSettingsSheet";
import { useSelectedItem } from "../store/useSelectedItem";
import { useSelectedPerson } from "../store/useSelectedPerson";
import { useCatalogPreview } from "../store/useCatalogPreview";
import { useWatchProgress } from "../store/useWatchProgress";
import { useVisibleItems } from "../lib/useVisibleItems";
import { matchesQuery, didYouMean } from "../lib/search";
import { searchTitlesForgiving } from "../lib/tmdbSearch";
import { searchPeople, profileUrl, backdropUrl, posterUrl, type TmdbPersonHit, type TmdbSearchResult } from "../lib/tmdb";
import { continueWatching, lastSeenDates } from "../lib/continueWatching";
import { forYou } from "../lib/recommend";
import { prefetchHandlers } from "../lib/prefetch";
import { PosterArt } from "../components/PosterArt";
import { CheckIcon, CloseIcon, PlayIcon, SearchIcon } from "../components/icons";
import type { Item } from "../types";
import { ErrorState } from "../components/ErrorState";
import { t } from "../lib/i18n";

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
          {reason && <span className="block truncate text-xs text-text-faint">{reason}</span>}
        </span>
      </button>
      <button
        type="button"
        {...prefetchHandlers("/player")}
        onClick={() => navigate(`/player?titolo=${encodeURIComponent(item.id)}`)}
        aria-label={`Riproduci ${item.title}`}
        className="icon-btn icon-btn-filled shrink-0"
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
      <div className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-5 lg:grid-cols-7">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton aspect-square rounded-full" aria-hidden="true" />
        ))}
      </div>
    );
  }
  if (people.length === 0) return <p className="text-sm text-text-faint">Nessuna persona con questo nome.</p>;

  return (
    <div className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-5 lg:grid-cols-7">
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
          <span className="mt-2 block line-clamp-2 text-sm font-medium text-text">{person.name}</span>
          {person.knownFor.length > 0 && (
            <span className="mt-0.5 block line-clamp-2 text-xs leading-snug text-text-faint">
              {person.knownFor.join(" · ")}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/**
 * Sotto le tre lettere, TMDB non va interrogato.
 *
 * `/search/multi` fa corrispondenza per sottostringa: «Ns» pesca *Ded@ns*,
 * *Käpt'ns Dinner* e una serie olandese del 1981 — tre risposte legittime a una
 * domanda che nessuno ha fatto. Dirlo è meglio che riempire la griglia di
 * qualcosa che sembra un risultato e non lo è. La tua libreria invece si filtra
 * da subito: lì anche due lettere restringono qualcosa che conosci.
 */
const MIN_REMOTE_QUERY = 3;

function TitleResults({ query }: { query: string }) {
  const items = useVisibleItems();
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const openItem = useSelectedItem((s) => s.open);
  const openPreview = useCatalogPreview((s) => s.open);
  const [remote, setRemote] = useState<TmdbSearchResult[] | null>(null);
  const [remoteFailed, setRemoteFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [corrected, setCorrected] = useState<string | null>(null);

  const mine = useMemo(() => (query ? items.filter((i) => matchesQuery(i, query)) : []), [items, query]);
  const suggestion = useMemo(() => (query && mine.length === 0 ? didYouMean(query, items) : null), [query, mine, items]);

  useEffect(() => {
    if (query.length < MIN_REMOTE_QUERY || !tmdbApiKey) {
      setRemote(null);
      return;
    }
    const controller = new AbortController();
    setRemote(null);
    setRemoteFailed(false);
    setCorrected(null);
    // Mezzo secondo di attesa: la ricerca parte mentre scrivi, e senza questa
    // pausa ogni lettera sarebbe una richiesta buttata via dalla successiva.
    const timer = window.setTimeout(() => {
      searchTitlesForgiving(query, tmdbApiKey, controller.signal, 18)
        .then((r) => {
          setRemote(r.results);
          setCorrected(r.corrected ? r.usedTerm : null);
        })
        .catch(() => {
          // Una ricerca che non è arrivata non è una ricerca senza risultati.
          if (controller.signal.aborted) return;
          setRemote([]);
          setRemoteFailed(true);
        });
    }, 450);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, tmdbApiKey, attempt]);

  /**
   * Un tocco apre la scheda, non il modulo di aggiunta.
   *
   * Prima il tocco *aggiungeva*: per leggere una trama bisognava mettersi il
   * titolo in casa, cioè decidere prima di avere in mano le cose su cui si
   * decide. Ora si guarda, e da lì si aggiunge se lo si vuole.
   */
  function openResult(result: TmdbSearchResult) {
    const owned = items.find((i) => i.tmdbId === result.tmdbId && i.tmdbMediaType === result.mediaType);
    if (owned) {
      openItem(owned);
      return;
    }
    openPreview({
      tmdbId: result.tmdbId,
      mediaType: result.mediaType,
      kind: result.kind,
      title: result.title,
      year: result.year,
      posterPath: result.posterPath,
    });
  }

  const ownedIds = new Set(items.map((i) => i.tmdbId).filter((id): id is number => id != null));

  return (
    <div className="flex flex-col gap-6">
      {/*
       * Quanti risultati sono arrivati, detto a voce.
       *
       * La ricerca è la superficie più asincrona dell'app — la griglia si
       * riscrive a ogni tasto — ed era l'unica delle tre grandi a non avere
       * una regione viva: `aria-live` esisteva in tre file su sessanta, e
       * nessuno dei tre era questo. Chi usa un lettore di schermo scriveva e
       * non sentiva niente: né che stavano arrivando, né quanti, né che non
       * ce n'erano. Qui il numero si annuncia da solo quando cambia.
       *
       * `polite` e non `assertive`: interrompere qualcuno che sta ancora
       * digitando è peggio del silenzio.
       */}
      <p aria-live="polite" className="sr-only">
        {query.length < MIN_REMOTE_QUERY
          ? ""
          : remote === null
            ? "Cerco…"
            : `${mine.length + remote.length} risultat${mine.length + remote.length === 1 ? "o" : "i"} per ${query}`}
      </p>

      {mine.length > 0 && (
        <section>
          <h2 className="mb-2.5 text-xs font-medium text-text-faint">
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
          <h2 className="mb-2.5 text-xs font-medium text-text-faint">Su TMDB</h2>
          {corrected && (
            <p className="mb-2 text-xs text-text-faint">
              Niente per «{query}»: questi sono i risultati per «{corrected}».
            </p>
          )}
          {query.length < MIN_REMOTE_QUERY ? (
            <p className="text-sm text-text-faint">
              Scrivi almeno {MIN_REMOTE_QUERY} lettere: con due, TMDB risponde con tutto quello che le contiene da
              qualche parte — e non è quasi mai il titolo che cerchi.
            </p>
          ) : remote === null ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton aspect-2/3 rounded-sm" aria-hidden="true" />
              ))}
            </div>
          ) : remoteFailed ? (
            <ErrorState compact title="La ricerca su TMDB non è arrivata" description="I titoli della tua libreria qui sopra ci sono lo stesso." onRetry={() => setAttempt((n) => n + 1)} />
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
                    onClick={() => openResult(result)}
                    aria-label={owned ? `${result.title} — già in libreria, apri la scheda` : `Apri la scheda di ${result.title}`}
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
                          className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur-sm"
                        >
                          <CheckIcon size={11} />
                        </span>
                      )}
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm font-medium leading-snug text-text">{result.title}</p>
                    <p className="font-mono tabular text-xs text-text-faint">
                      {result.year ?? ""}
                    </p>
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
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-[var(--gutter)] py-6 sm:py-10">
      <h1 className="t-display text-text">{t("page.search")}</h1>

      {/* La casella resta appesa in alto mentre la griglia scorre: su un
          telefono, correggere una parola non deve costare una risalita. */}
      <div className="sticky top-14 z-20 -mx-[var(--gutter)] bg-bg/85 px-[var(--gutter)] py-2 backdrop-blur-xl backdrop-saturate-150 lg:top-0">
        {/*
          Una `label` e non un `div`: prima il bersaglio era la sola riga di
          testo, così un tocco sulla lente o sul bordo della pillola non apriva
          niente — su un telefono, dove la pillola è larga tutto lo schermo,
          la maggior parte di quell'area non faceva nulla. Ora tutta la
          pastiglia dà il fuoco al campo, e con esso la tastiera.
        */}
        {/*
          L'anello di fuoco sta sulla pillola, non sul campo dentro.
          Con l'anello sull'`input` si vedevano due bordi uno dentro l'altro —
          un rettangolo verde stretto dentro una pastiglia grigia — che non
          somiglia a niente e sembra un errore di disegno. `focus-within`
          sposta l'evidenza sul contenitore, che è la forma che si tocca.
        */}
        <label className="search-pill flex h-11 cursor-text items-center gap-2.5 rounded-full bg-surface-2 pl-4 pr-1.5 text-text-faint">
          <SearchIcon size={18} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca serie, film e persone…"
            aria-label="Cerca"
            // `search` porta il tasto «cerca» sulla tastiera del telefono al
            // posto di «invio», e spegne le maiuscole automatiche: nessun
            // titolo si scrive meglio con la prima lettera imposta.
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            /*
             * Il fuoco automatico solo dove c'è una tastiera vera. Su iOS il
             * fuoco dato dal codice non apre la tastiera: restava un campo con
             * il bordo acceso, che sembra pronto a ricevere e non riceve
             * niente finché non lo tocchi. Meglio nessuna promessa.
             */
            autoFocus={typeof window !== "undefined" && window.matchMedia?.("(pointer: fine)").matches}
            className="no-focus-ring min-w-0 flex-1 bg-transparent text-base text-text outline-none placeholder:text-text-faint"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              aria-label="Cancella la ricerca"
              className="icon-btn icon-btn-sm"
            >
              <CloseIcon size={16} />
            </button>
          )}
        </label>

        <div className="mt-3 flex gap-2" role="tablist" aria-label="Cosa cercare">
          {([
            { id: "titoli", label: t("tabs.search.titles") },
            { id: "persone", label: t("tabs.search.people") },
          ] as const).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className="chip"
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {!query && tab === "titoli" ? (
        suggestions.length > 0 ? (
          <section>
            <h2 className="t-title mb-4 text-text">Da riprendere e da provare</h2>
            <ul className="flex flex-col gap-3">
              {suggestions.map(({ item, reason }) => (
                <SuggestionRow key={item.id} item={item} reason={reason} />
              ))}
            </ul>
          </section>
        ) : (
          <div className="flex flex-col items-start gap-1">
            <p className="text-sm text-text-faint">Scrivi un titolo.</p>
            {/* Un pulsante vero, alto 44 px, e non un collegamento nel testo:
                sul telefono si tocca col pollice. */}
            {!tmdbApiKey && (
              <button type="button" onClick={() => openSettings("chiavi")} className="btn btn-plain btn-sm -ml-3 min-h-11 text-left">
                Con la chiave TMDB cerchi anche fuori dalla tua libreria
              </button>
            )}
          </div>
        )
      ) : tab === "titoli" ? (
        <TitleResults query={query.trim()} />
      ) : (
        <PersonResults query={query.trim()} />
      )}
    </div>
  );
}
