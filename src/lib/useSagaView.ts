import { useEffect, useState } from "react";
import { useSagas, type SagaKey } from "../store/useSagas";
import { useSettings } from "../store/useSettings";
import { findKeywordId, getKeywordMovies, getSaga, type TmdbSagaPart } from "./tmdb";
import { MIN_ENTRIES, universeById } from "./universes";

export interface SagaView {
  key: SagaKey;
  name: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  accent: string;
  parts: TmdbSagaPart[];
  isUniverse: boolean;
}

export function parseSagaKey(key: SagaKey): { kind: "saga"; id: number } | { kind: "universe"; id: string } | null {
  if (key.startsWith("saga:")) {
    const id = Number(key.slice(5));
    return Number.isFinite(id) ? { kind: "saga", id } : null;
  }
  if (key.startsWith("universe:")) return { kind: "universe", id: key.slice(9) };
  return null;
}

/**
 * Resolves a saga or universe key into everything the sheet needs to render.
 * Both kinds are cached in `useSagas`, so a second visit is instant and the
 * page still works with the network down; only a cache miss reaches TMDB.
 */
export function useSagaView(key: SagaKey | null): { view: SagaView | null; loading: boolean; error: string | null } {
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const sagas = useSagas((s) => s.sagas);
  const universes = useSagas((s) => s.universes);
  const setSaga = useSagas((s) => s.setSaga);
  const setUniverse = useSagas((s) => s.setUniverse);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = key ? parseSagaKey(key) : null;
  const cachedSaga = parsed?.kind === "saga" ? sagas[String(parsed.id)] : undefined;
  const cachedUniverse = parsed?.kind === "universe" ? universes[parsed.id] : undefined;
  const hasCache = parsed?.kind === "saga" ? !!cachedSaga : !!cachedUniverse;

  useEffect(() => {
    if (!parsed || hasCache || !tmdbApiKey) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        if (parsed.kind === "saga") {
          const saga = await getSaga(parsed.id, tmdbApiKey);
          if (!cancelled) setSaga(saga);
          return;
        }
        const def = universeById(parsed.id);
        if (!def) throw new Error("universo sconosciuto");
        const keywordId = await findKeywordId(def.keyword, tmdbApiKey);
        const parts = keywordId ? await getKeywordMovies(keywordId, tmdbApiKey) : [];
        if (parts.length < MIN_ENTRIES) throw new Error("universo non disponibile");
        if (!cancelled) setUniverse(parsed.id, parts);
      } catch {
        if (!cancelled) setError("Non è stato possibile caricare questa raccolta da TMDB.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // `parsed` is rebuilt on every render; the key is its stable identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, hasCache, tmdbApiKey]);

  if (!parsed) return { view: null, loading: false, error: null };

  if (parsed.kind === "saga") {
    if (!cachedSaga) return { view: null, loading, error };
    return {
      view: {
        key: key!,
        name: cachedSaga.name,
        overview: cachedSaga.overview,
        posterPath: cachedSaga.posterPath,
        backdropPath: cachedSaga.backdropPath,
        accent: "var(--accent)",
        parts: cachedSaga.parts,
        isUniverse: false,
      },
      loading,
      error,
    };
  }

  const def = universeById(parsed.id);
  if (!def || !cachedUniverse) return { view: null, loading, error };
  return {
    view: {
      key: key!,
      name: def.name,
      overview: def.blurb,
      // Universes have no artwork of their own on TMDB: the first film's poster
      // is the closest thing to a cover the world actually has.
      posterPath: cachedUniverse.parts[0]?.posterPath ?? null,
      backdropPath: null,
      accent: def.accent,
      parts: cachedUniverse.parts,
      isUniverse: true,
    },
    loading,
    error,
  };
}
