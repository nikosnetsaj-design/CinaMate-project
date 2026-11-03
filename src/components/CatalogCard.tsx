import { PosterArt } from "./PosterArt";
import { CheckIcon, PlusIcon } from "./icons";
import type { CatalogTitle } from "../lib/useAddFromCatalog";
import type { Item } from "../types";
import { t } from "../lib/i18n";

/**
 * Una locandina del catalogo: la stessa in Scopri, nella ricerca, nel foglio
 * di aggiunta.
 *
 * Due gesti, due posti. Il tocco sulla locandina apre la scheda — trama, cast,
 * dove si guarda — senza mettere niente in libreria. Il «+» nell'angolo è la
 * scorciatoia per chi sa già cosa vuole: lo aggiunge a «Da vedere» al volo,
 * con «Annulla» nell'avviso. Se il titolo c'è già, l'angolo lo dice con una
 * spunta e il tocco apre la tua scheda.
 */
export function CatalogCard({
  title,
  owned,
  pending = false,
  onOpen,
  onQuickAdd,
  className = "",
}: {
  title: CatalogTitle;
  owned?: Item;
  pending?: boolean;
  onOpen: () => void;
  onQuickAdd: () => void;
  className?: string;
}) {
  const kindLabel = title.kind === "film" ? t("CatalogCard.film") : title.kind === "doc" ? t("CatalogCard.documentario") : t("CatalogCard.serie");
  return (
    <div className={`group relative text-left ${className}`}>
      <button
        type="button"
        onClick={onOpen}
        aria-label={owned ? t("CatalogCard.apri_la_tua_scheda", { v0: title.title }) : t("CatalogCard.apri_la_scheda_di", { v0: title.title })}
        className="block w-full text-left"
      >
        <PosterArt
          item={{ title: title.title, kind: title.kind, posterPath: title.posterPath }}
          size="sm"
          showTitle={!title.posterPath}
          className="w-full shadow-[var(--shadow-sm)] transition-transform duration-200 group-active:scale-[0.97]"
        />
        <p className="mt-2 line-clamp-2 text-sm font-medium leading-snug text-text">{title.title}</p>
        <p className="tabular text-xs text-text-faint">
          {[title.year, kindLabel].filter(Boolean).join(" · ")}
        </p>
      </button>
      {owned ? (
        <span
          className="pointer-events-none absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full shadow-[var(--shadow-sm)]"
          style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
          aria-hidden="true"
        >
          <CheckIcon size={14} />
        </span>
      ) : (
        <button
          type="button"
          onClick={onQuickAdd}
          disabled={pending}
          aria-label={t("CatalogCard.aggiungi_a_da_vedere", { v0: title.title })}
          className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white shadow-[var(--shadow-sm)] backdrop-blur-md transition-[transform,background-color] hover:bg-black/75 active:scale-90 disabled:opacity-100"
        >
          {pending ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <PlusIcon size={16} />}
        </button>
      )}
    </div>
  );
}
