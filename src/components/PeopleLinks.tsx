import { useSelectedPerson } from "../store/useSelectedPerson";
import { useSelectedItem } from "../store/useSelectedItem";
import type { Item } from "../types";

/**
 * Le persone come destinazioni, non come curiosità: ogni nome apre la sua
 * scheda — filmografia, e quanto di quella hai già — che è il modo in cui "mi
 * piaceva in quell'altro" diventa la prossima cosa da vedere.
 *
 * Qui restano regia e creatori. Il cast è passato a `CastGrid`, che ne mostra i
 * volti quando TMDB li ha e ricade su queste stesse pastiglie quando non li ha.
 */
export function PersonChip({ name, prefix }: { name: string; prefix?: string }) {
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

  if (directors.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {directors.map((name) => (
        <PersonChip key={`dir-${name}`} name={name} prefix="Regia ·" />
      ))}
    </div>
  );
}
