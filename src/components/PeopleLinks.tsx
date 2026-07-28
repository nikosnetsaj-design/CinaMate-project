import { useSelectedPerson } from "../store/useSelectedPerson";
import { useSelectedItem } from "../store/useSelectedItem";
import type { Item } from "../types";

/**
 * Cast and director as destinations rather than as trivia. Every name opens the
 * person's page — their filmography, and which of it you already own — which is
 * how "I liked her in this" turns into the next thing to watch.
 */
function PersonChip({ name, prefix }: { name: string; prefix?: string }) {
  const openPerson = useSelectedPerson((s) => s.open);
  const closeItem = useSelectedItem((s) => s.close);

  return (
    <button
      type="button"
      onClick={() => {
        closeItem();
        openPerson(name);
      }}
      aria-label={`Apri la scheda di ${name}`}
      className="rounded-full border border-border-strong px-2.5 py-1 text-xs text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
    >
      {prefix && <span className="text-text-faint">{prefix} </span>}
      {name}
    </button>
  );
}

export function PeopleLinks({ item }: { item: Item }) {
  // A single director field can hold several names — TV shows list every creator.
  const directors = item.director
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
  const cast = item.cast.filter(Boolean).slice(0, 5);

  if (directors.length === 0 && cast.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {directors.map((name) => (
        <PersonChip key={`dir-${name}`} name={name} prefix="Regia ·" />
      ))}
      {cast.map((name) => (
        <PersonChip key={`cast-${name}`} name={name} />
      ))}
    </div>
  );
}
