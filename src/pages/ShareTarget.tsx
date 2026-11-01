import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAddSheet } from "../store/useAddSheet";
import { useCatalogPreview } from "../store/useCatalogPreview";
import { useSettings } from "../store/useSettings";
import { useLibrary } from "../store/useLibrary";
import { findByExternalId } from "../lib/tmdb";
import { parseShared } from "../lib/shareTarget";
import { PageSkeleton } from "../components/Skeletons";

/**
 * La pagina su cui atterra un link condiviso da un'altra app (`share_target`).
 *
 * Non si vede quasi mai: legge i parametri, decide cosa sono (lib/shareTarget)
 * e porta dove serve — la scheda del titolo, il foglio per aggiungerlo, o il
 * link di CineMate stesso. Dalla cronologia se ne va subito, così «indietro»
 * non riapre la stessa condivisione.
 */
export function ShareTarget() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const openPreview = useCatalogPreview((s) => s.open);
  const openAdd = useAddSheet((s) => s.open);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const base = new URL(import.meta.env.BASE_URL, window.location.origin).toString();
    const shared = parseShared({ title: params.get("title"), text: params.get("text"), url: params.get("url") }, base);

    if (!shared) {
      navigate("/", { replace: true });
      useLibrary.getState().pushToast("info", "Dalla condivisione non è arrivato niente da cercare.");
      return;
    }
    if (shared.kind === "app") {
      window.location.replace(shared.href);
      return;
    }
    navigate("/", { replace: true });
    if (shared.kind === "tmdb") {
      openPreview({ tmdbId: shared.tmdbId, mediaType: shared.mediaType, kind: shared.mediaType === "tv" ? "serie" : "film", title: shared.title, year: null, posterPath: null });
      return;
    }
    if (shared.kind === "imdb") {
      if (!tmdbApiKey) {
        openAdd(shared.title);
        return;
      }
      void findByExternalId(shared.imdbId, "imdb_id", tmdbApiKey)
        .then((found) => {
          if (found) openPreview({ tmdbId: found.tmdbId, mediaType: found.mediaType, kind: found.kind, title: found.title, year: found.year, posterPath: found.posterPath });
          else openAdd(shared.title);
        })
        .catch(() => openAdd(shared.title));
      return;
    }
    openAdd(shared.query);
  }, [params, navigate, tmdbApiKey, openPreview, openAdd]);

  return <PageSkeleton />;
}
