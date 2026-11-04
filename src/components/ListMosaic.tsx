import { PosterArt } from "./PosterArt";
import { ListIcon } from "./icons";
import type { Item } from "../types";

/**
 * La copertina di una lista: le prime quattro locandine, due per due.
 *
 * Con meno di quattro titoli i posti vuoti restano tinta piatta, non
 * ripetizioni dello stesso poster: una lista di due titoli che sembra di
 * quattro mente su quanto è lunga. Vuota, mostra il segno delle liste.
 */
export function ListMosaic({ items, className = "" }: { items: Item[]; className?: string }) {
  const four = items.slice(0, 4);
  if (four.length === 0) {
    return (
      <div aria-hidden="true" className={`flex aspect-square items-center justify-center rounded-md bg-surface-2 text-text-faint ${className}`}>
        <ListIcon size={22} />
      </div>
    );
  }
  return (
    <div aria-hidden="true" className={`grid aspect-square grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-md bg-surface-2 ${className}`}>
      {Array.from({ length: 4 }, (_, i) =>
        four[i] ? (
          <PosterArt key={four[i].id} item={four[i]} size="sm" showTitle={false} className="h-full w-full rounded-none" />
        ) : (
          <div key={`vuoto-${i}`} className="bg-surface-hover" />
        ),
      )}
    </div>
  );
}
