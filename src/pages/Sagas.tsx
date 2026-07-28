import { useEffect, useMemo, useState } from "react";
import { useLibrary } from "../store/useLibrary";
import { useSettings } from "../store/useSettings";
import { useSettingsSheet } from "../store/useSettingsSheet";
import { useSagas, sagaKey, universeKey } from "../store/useSagas";
import { findKeywordId, getKeywordMovies } from "../lib/tmdb";
import { MIN_ENTRIES, UNIVERSES } from "../lib/universes";
import { buildEntries, sagaProgress } from "../lib/sagas";
import { useAppReady } from "../lib/useAppReady";
import { SagaCard } from "../components/SagaCard";
import { MarathonCard } from "../components/MarathonCard";
import { EmptyState } from "../components/EmptyState";

const FETCH_DELAY_MS = 350;

/**
 * Universe listings are downloaded one at a time the first time the page is
 * seen, then cached for a week. Doing it here rather than on app start keeps
 * six keyword lookups off the critical path of every launch.
 */
function useUniverseIndex() {
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const universes = useSagas((s) => s.universes);
  const setUniverse = useSagas((s) => s.setUniverse);
  const [unavailable, setUnavailable] = useState<string[]>([]);

  useEffect(() => {
    if (!tmdbApiKey) return;
    let cancelled = false;

    void (async () => {
      for (const def of UNIVERSES) {
        if (cancelled) return;
        if (useSagas.getState().freshUniverse(def.id)) continue;
        try {
          const keywordId = await findKeywordId(def.keyword, tmdbApiKey);
          const parts = keywordId ? await getKeywordMovies(keywordId, tmdbApiKey) : [];
          if (cancelled) return;
          // A keyword that has been renamed or emptied out on TMDB would leave
          // a broken row: hide the universe instead of showing three films.
          if (parts.length < MIN_ENTRIES) setUnavailable((u) => [...u, def.id]);
          else setUniverse(def.id, parts);
        } catch {
          // Offline or rate limited: stop the sweep, a later visit retries.
          return;
        }
        await new Promise((r) => setTimeout(r, FETCH_DELAY_MS));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tmdbApiKey, setUniverse]);

  return { universes, unavailable };
}

export function Sagas() {
  const ready = useAppReady();
  const items = useLibrary((s) => s.items);
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const openSettings = useSettingsSheet((s) => s.open);
  const sagas = useSagas((s) => s.sagas);
  const hidden = useSagas((s) => s.prefs.hidden);
  const { universes, unavailable } = useUniverseIndex();

  /** Only sagas the library actually touches: this is your shelf, not a catalogue. */
  const mine = useMemo(() => {
    const owned = new Set(
      items.map((i) => i.collectionId).filter((id): id is number => typeof id === "number"),
    );
    return Array.from(owned)
      .map((id) => sagas[String(id)])
      .filter((saga) => !!saga && !hidden.includes(sagaKey(saga.id)))
      .map((saga) => ({ saga, progress: sagaProgress(buildEntries(saga.parts, items)) }))
      // The saga you are furthest into, and closest to finishing, comes first.
      .sort((a, b) => b.progress.pct - a.progress.pct || b.progress.owned - a.progress.owned);
  }, [items, sagas, hidden]);

  const visibleUniverses = UNIVERSES.filter((u) => !unavailable.includes(u.id) && universes[u.id]);
  const pendingSagas = items.some((i) => i.collectionId != null) && mine.length === 0;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-10">
      <div>
        <h1 className="font-display text-3xl font-semibold text-text">Saghe</h1>
        <p className="mt-1 text-sm text-text-muted">
          I film che hai in libreria, rimessi nell'ordine della loro storia.
        </p>
      </div>

      <MarathonCard />

      {/* Sagas already downloaded stay browsable with no key and no network:
          the key is what discovers new ones, not what reads the shelf. */}
      {!tmdbApiKey && mine.length === 0 ? (
        <EmptyState
          title="Serve la tua chiave TMDB"
          description="Le saghe si costruiscono da sole a partire dalle collezioni di TMDB: senza chiave non c'è modo di sapere che due film appartengono alla stessa storia."
          action={
            <button
              type="button"
              onClick={openSettings}
              className="rounded-sm px-4 py-2 text-sm font-semibold"
              style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
            >
              Aggiungi la chiave
            </button>
          }
        />
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="font-display text-xl font-semibold text-text">
              Le tue saghe {mine.length > 0 && <span className="text-sm font-normal text-text-faint">· {mine.length}</span>}
            </h2>
            {!ready || pendingSagas ? (
              <div className="flex flex-col gap-2.5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="skeleton h-[86px] rounded-md" aria-hidden="true" />
                ))}
              </div>
            ) : mine.length === 0 ? (
              <EmptyState
                title="Ancora nessuna saga"
                description="Appena in libreria entra un film che fa parte di una collezione — un capitolo di Alien, un Rocky, un Fast & Furious — la saga completa compare qui da sola."
              />
            ) : (
              <div className="flex flex-col gap-2.5">
                {mine.map(({ saga }) => (
                  <SagaCard
                    key={saga.id}
                    sagaKey={sagaKey(saga.id)}
                    name={saga.name}
                    parts={saga.parts}
                    posterPath={saga.posterPath}
                  />
                ))}
              </div>
            )}
          </section>

          {visibleUniverses.length > 0 && (
            <section className="flex flex-col gap-3">
              <div>
                <h2 className="font-display text-xl font-semibold text-text">Universi</h2>
                <p className="mt-0.5 text-xs text-text-faint">
                  Storie che attraversano più saghe. Aprine uno per vederne la linea temporale.
                </p>
              </div>
              <div className="flex flex-col gap-2.5">
                {visibleUniverses.map((u) => (
                  <SagaCard
                    key={u.id}
                    sagaKey={universeKey(u.id)}
                    name={u.name}
                    parts={universes[u.id].parts}
                    posterPath={universes[u.id].parts[0]?.posterPath ?? null}
                    accent={u.accent}
                    subtitle={u.blurb}
                  />
                ))}
              </div>
            </section>
          )}

          {!tmdbApiKey && (
            <p className="text-xs text-text-faint">
              Senza chiave TMDB vedi solo le saghe già scaricate.{" "}
              <button type="button" onClick={openSettings} className="font-medium text-accent-text underline-offset-2 hover:underline">
                Aggiungi la chiave
              </button>{" "}
              per scoprirne di nuove.
            </p>
          )}
        </>
      )}
    </div>
  );
}
