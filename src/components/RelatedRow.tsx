import { useLibrary } from "../store/useLibrary";
import { useSelectedItem } from "../store/useSelectedItem";
import { useCatalogPreview } from "../store/useCatalogPreview";
import { useTitleExtras } from "../lib/useTitleExtras";
import { PosterArt } from "./PosterArt";
import type { Item } from "../types";

/**
 * «Se ti è piaciuto questo» — con le locandine, non con i nomi.
 *
 * Nella libreria ogni titolo porta con sé tre titoli simili come stringhe,
 * scritte al momento dell'aggiunta: bastavano per una riga di pastiglie e non
 * bastano per scegliere, perché di un film che non hai visto il nome da solo
 * non dice niente. Qui sono venti, arrivano da TMDB nel momento in cui apri la
 * scheda (quindi non invecchiano mai) e ognuno mostra la copertina.
 *
 * Quelli che hai già in libreria portano il segno e aprono la loro scheda; gli
 * altri aprono la scheda del catalogo, dove si legge tutto senza aggiungere
 * niente — e da lì si aggiunge, se lo si vuole.
 */
export function RelatedRow({ item }: { item: Item }) {
  const { extras, loading } = useTitleExtras(item);
  const items = useLibrary((s) => s.items);
  const openItem = useSelectedItem((s) => s.open);
  const openPreview = useCatalogPreview((s) => s.open);

  if (loading) {
    return (
      <div className="flex gap-3 overflow-hidden" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton aspect-[2/3] w-24 shrink-0 rounded-sm" />
        ))}
      </div>
    );
  }

  const related = (extras?.related ?? []).filter((r) => r.tmdbId !== item.tmdbId);
  if (related.length === 0) return null;

  return (
    <section>
      <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-text-faint">
        {item.kind === "film" || item.kind === "doc" ? "Film correlati" : "Serie correlate"}
      </span>
      <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
        {related.map((r) => {
          const owned = items.find((i) => i.tmdbId === r.tmdbId && i.tmdbMediaType === r.mediaType);
          return (
            <button
              key={`${r.mediaType}-${r.tmdbId}`}
              type="button"
              onClick={() =>
                owned
                  ? openItem(owned)
                  : openPreview({
                      tmdbId: r.tmdbId,
                      mediaType: r.mediaType,
                      kind: r.kind,
                      title: r.title,
                      year: r.year,
                      posterPath: r.posterPath,
                    })
              }
              aria-label={owned ? `Apri dettagli di ${r.title}` : `Apri la scheda di ${r.title}`}
              // `self-start`: un pulsante centra il proprio contenuto, e in una
              // fila dove un titolo va a capo e l'altro no le locandine
              // finirebbero su due altezze diverse.
              className="w-24 shrink-0 self-start text-left"
            >
              <span className="relative block">
                <PosterArt
                  item={{ title: r.title, kind: r.kind, posterPath: r.posterPath }}
                  size="sm"
                  showTitle={!r.posterPath}
                  className="w-24"
                />
                {owned ? (
                  <span
                    className="absolute right-1 top-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                    style={{
                      background: owned.status === "Visto" ? "var(--status-done)" : "var(--accent)",
                      color: "var(--accent-contrast)",
                    }}
                  >
                    {owned.status === "Visto" ? "✓" : "◷"}
                  </span>
                ) : (
                  <span className="absolute inset-x-0 bottom-0 bg-black/60 py-1 text-center text-[10px] font-semibold text-white">
                    Vedi scheda
                  </span>
                )}
              </span>
              <p className="mt-1.5 line-clamp-2 text-xs font-medium text-text">{r.title}</p>
              <p className="font-mono tabular text-[10px] text-text-faint">{r.year ?? ""}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
