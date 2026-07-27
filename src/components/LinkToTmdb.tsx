import { useState } from "react";
import { useLibrary } from "../store/useLibrary";
import { useSettings } from "../store/useSettings";
import { useSettingsSheet } from "../store/useSettingsSheet";
import { searchTitles, getDetails, MissingTmdbKeyError, TmdbApiError } from "../lib/tmdb";
import type { Item } from "../types";

/**
 * Titles added before a TMDB key existed (or entered by hand) have no poster
 * or metadata. This links one to its TMDB entry in a single tap, filling in
 * only what is still empty so ratings, notes and progress are never touched.
 */
export function LinkToTmdb({ item }: { item: Item }) {
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const updateItem = useLibrary((s) => s.updateItem);
  const pushToast = useLibrary((s) => s.pushToast);
  const openSettings = useSettingsSheet((s) => s.open);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (item.tmdbId) return null;

  async function link() {
    setBusy(true);
    setErr("");
    try {
      const results = await searchTitles(item.title, tmdbApiKey);
      const best = results[0];
      if (!best) {
        setErr("Nessuna corrispondenza su TMDB. Prova a correggere il titolo.");
        setBusy(false);
        return;
      }
      const d = await getDetails(best.tmdbId, best.mediaType, tmdbApiKey);
      updateItem(item.id, {
        tmdbId: d.tmdbId,
        tmdbMediaType: best.mediaType,
        posterPath: d.posterPath,
        trailerUrl: d.trailerUrl,
        // Only fill gaps — anything the user already curated stays as it is.
        genre: item.genre || d.genre,
        runtime: item.runtime || d.runtime,
        overview: item.overview || d.overview,
        director: item.director || d.director,
        cast: item.cast.length ? item.cast : d.cast,
        similar: item.similar.length ? item.similar : d.similar,
        episodes: item.episodes ?? d.episodes,
        seasons: item.seasons ?? d.seasons,
      });
      pushToast("success", `"${d.title}" collegato a TMDB.`);
    } catch (e) {
      if (e instanceof MissingTmdbKeyError) setErr("missing-key");
      else if (e instanceof TmdbApiError) setErr(e.message);
      else setErr("Collegamento non riuscito. Riprova.");
    }
    setBusy(false);
  }

  if (err === "missing-key") {
    return (
      <div className="mt-4 rounded-md border border-dashed border-border-strong p-4 text-center">
        <p className="text-xs text-text-muted">
          Aggiungi una chiave TMDB gratuita per recuperare copertina, trama e dove guardarlo.
        </p>
        <button
          type="button"
          onClick={openSettings}
          className="mt-2.5 rounded-sm border border-border-strong px-3.5 py-2 text-xs font-medium text-text hover:bg-surface-hover"
        >
          Apri Impostazioni
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={link}
        disabled={busy}
        className="w-full rounded-md border border-dashed px-4 py-3 text-sm font-medium disabled:opacity-60"
        style={{ borderColor: "color-mix(in srgb, var(--accent) 45%, transparent)", color: "var(--accent-text)" }}
      >
        {busy ? "Cerco su TMDB…" : "Recupera copertina e dati da TMDB"}
      </button>
      {err && <p className="mt-2 text-center text-xs text-text-muted">{err}</p>}
    </div>
  );
}
