import { useState } from "react";
import { useSettings } from "../store/useSettings";
import { useLibrary } from "../store/useLibrary";
import { useSelectedItem } from "../store/useSelectedItem";
import { useCatalogPreview } from "../store/useCatalogPreview";
import { draftFromTmdb } from "./addFromTmdb";
import { blankDraft } from "./draft";
import type { CatalogTitle } from "./useAddFromCatalog";
import type { Item, Status } from "../types";
import { statusLabel, t } from "./i18n";

/** La chiave di un titolo del catalogo: lo stesso id TMDB è un film *o* una serie. */
export function catalogKey(title: { tmdbId: number; mediaType: "movie" | "tv" }): string {
  return `${title.mediaType}-${title.tmdbId}`;
}

/** Il titolo della libreria che corrisponde a un risultato del catalogo, se c'è. */
export function ownedFor(items: Item[], title: { tmdbId: number; mediaType: "movie" | "tv" }): Item | undefined {
  return items.find((i) => i.tmdbId === title.tmdbId && (i.tmdbMediaType == null || i.tmdbMediaType === title.mediaType));
}

/**
 * Aggiungere con un tocco, senza modulo.
 *
 * Prima mettere un titolo in libreria voleva dire: aprirlo, premere «Aggiungi»,
 * ritrovarsi davanti un modulo già compilato e premere di nuovo «Aggiungi» in
 * fondo. Tutto quello che il modulo chiedeva lo sa già TMDB; l'unica cosa che
 * sai solo tu è *a che punto sei* — da vedere, lo sto guardando, l'ho visto —
 * e quella è il pulsante che premi. Il resto si cambia dopo, dalla scheda.
 *
 * L'avviso porta «Annulla»: un tocco sbagliato si ritira con un altro tocco.
 */
export function useQuickAdd() {
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  /** I titoli in arrivo, per far girare l'attesa solo sulla carta toccata. */
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());

  async function quickAdd(title: CatalogTitle, status: Status = "Da vedere"): Promise<Item | null> {
    const library = useLibrary.getState();
    const already = ownedFor(library.items, title);
    if (already) return already;
    if (!tmdbApiKey) {
      library.pushToast("error", t("useAddFromCatalog.serve_la_chiave_tmdb"));
      return null;
    }
    const key = catalogKey(title);
    setPending((s) => new Set(s).add(key));
    try {
      const draft = await draftFromTmdb(title.tmdbId, title.mediaType, title.kind, tmdbApiKey, {
        title: title.title,
        year: title.year,
        posterPath: title.posterPath,
      });
      // Due tocchi rapidi sulla stessa carta non fanno due copie.
      const raced = ownedFor(useLibrary.getState().items, title);
      if (raced) return raced;
      const data = { ...blankDraft(), ...draft, status };
      // «L'ho visto», per una serie, vuol dire tutta.
      if (status === "Visto" && data.episodes) data.seen = data.episodes;
      const item = useLibrary.getState().addItem(data, { silent: true });
      useLibrary.getState().pushToast("success", t("useQuickAdd.aggiunto_in", { v0: item.title, v1: statusLabel(status) }), {
        label: t("useQuickAdd.annulla"),
        run: () => {
          if (useSelectedItem.getState().item?.id === item.id) useSelectedItem.getState().close();
          useLibrary.getState().removeItem(item.id);
        },
      });
      return item;
    } catch {
      useLibrary.getState().pushToast("error", t("useAddFromCatalog.non_e_stato_possibile"));
      return null;
    } finally {
      setPending((s) => {
        const next = new Set(s);
        next.delete(key);
        return next;
      });
    }
  }

  return { quickAdd, pending };
}

/**
 * I due gesti di una locandina del catalogo, per chi ne mostra tante: aprire
 * la scheda (la tua, se il titolo c'è già) e aggiungerlo al volo.
 */
export function useCatalogActions(onBeforeOpen?: () => void) {
  const items = useLibrary((s) => s.items);
  const { quickAdd, pending } = useQuickAdd();

  function open(title: CatalogTitle) {
    const owned = ownedFor(items, title);
    onBeforeOpen?.();
    if (owned) useSelectedItem.getState().open(owned);
    else useCatalogPreview.getState().open(title);
  }

  return {
    open,
    quickAdd: (title: CatalogTitle) => void quickAdd(title),
    owned: (title: CatalogTitle) => ownedFor(items, title),
    isPending: (title: CatalogTitle) => pending.has(catalogKey(title)),
  };
}
