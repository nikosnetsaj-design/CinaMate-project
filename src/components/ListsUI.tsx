import { useId, useState } from "react";
import { PosterArt } from "./PosterArt";
import { CheckIcon, PlusIcon } from "./icons";
import { useLists } from "../store/useLists";
import { LIST_NAME_MAX, listItems, type UserList } from "../lib/lists";
import { paletteFor } from "../lib/palette";
import type { Item } from "../types";

/**
 * Il campo per dare un nome a una lista nuova, con il suo bottone.
 *
 * Un form vero, non un input con un `onKeyDown`: Invio crea la lista anche
 * dalla tastiera del telefono, che il tasto lo chiama «Vai», e il bottone si
 * spegne finché il nome è vuoto invece di creare una lista senza nome.
 */
export function NewListForm({
  onCreate,
  onCancel,
  autoFocus = false,
  submitLabel = "Crea",
}: {
  onCreate: (name: string) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
  submitLabel?: string;
}) {
  const [name, setName] = useState("");
  const inputId = useId();
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onCreate(name);
        setName("");
      }}
    >
      <label htmlFor={inputId} className="sr-only">
        Nome della lista
      </label>
      <input
        id={inputId}
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={LIST_NAME_MAX}
        placeholder="Nome della nuova lista"
        autoFocus={autoFocus}
        enterKeyHint="done"
        className="field min-w-0 flex-1"
      />
      <button type="submit" disabled={!name.trim()} className="btn btn-primary shrink-0 disabled:opacity-40">
        {submitLabel}
      </button>
      {onCancel && (
        <button type="button" onClick={onCancel} className="btn btn-secondary shrink-0">
          Annulla
        </button>
      )}
    </form>
  );
}

/**
 * La copertina di una lista: le prime quattro locandine in una griglia due
 * per due. Una lista con un titolo solo ne mostra uno a tutta copertina, una
 * vuota la sfumatura generata dal suo nome — la stessa delle locandine che
 * mancano, così una lista appena creata non è un buco grigio.
 */
export function ListMosaic({ list, byId, className = "w-14" }: { list: UserList; byId: Map<string, Item>; className?: string }) {
  const covers = listItems(list, byId).slice(0, 4);
  const [a, b] = paletteFor(list.name);
  if (covers.length === 0) {
    return (
      <div
        aria-hidden="true"
        className={`aspect-square shrink-0 rounded-xs ${className}`}
        style={{ background: `linear-gradient(150deg, ${b}, ${a})` }}
      />
    );
  }
  if (covers.length < 4) {
    return (
      <div aria-hidden="true" className={`aspect-square shrink-0 overflow-hidden rounded-xs ${className}`}>
        <PosterArt item={covers[0]} size="sm" showTitle={false} className="h-full w-full rounded-none" />
      </div>
    );
  }
  return (
    <div aria-hidden="true" className={`grid aspect-square shrink-0 grid-cols-2 grid-rows-2 overflow-hidden rounded-xs ${className}`}>
      {covers.map((item) => (
        <PosterArt key={item.id} item={item} size="sm" showTitle={false} className="h-full w-full rounded-none" />
      ))}
    </div>
  );
}

/**
 * Le liste nella scheda di un titolo: una pastiglia per lista, accesa se il
 * titolo c'è. Lo stesso gesto delle pastiglie dello stato qui sopra — tocchi
 * e cambia — perché è la stessa domanda posta a un'altra scala: dove sta
 * questo titolo nella tua vita, oltre che a che punto sei.
 */
export function ItemListsChips({ item }: { item: Item }) {
  const lists = useLists((s) => s.lists);
  const toggleItem = useLists((s) => s.toggleItem);
  const create = useLists((s) => s.create);
  const [creating, setCreating] = useState(false);
  const labelId = useId();

  return (
    <div className="mt-5">
      <span id={labelId} className="mb-2 block text-sm font-medium text-text">
        Liste
      </span>
      <div className="flex flex-wrap gap-2" role="group" aria-labelledby={labelId}>
        {lists.map((list) => {
          const inside = list.itemIds.includes(item.id);
          return (
            <button
              key={list.id}
              type="button"
              aria-pressed={inside}
              onClick={() => toggleItem(list.id, item.id)}
              className="chip max-w-full"
            >
              {inside && <CheckIcon size={14} />}
              <span className="truncate">{list.name}</span>
            </button>
          );
        })}
        {!creating && (
          <button type="button" onClick={() => setCreating(true)} className="chip">
            <PlusIcon size={14} />
            {lists.length === 0 ? "Crea una lista" : "Nuova lista"}
          </button>
        )}
      </div>
      {creating && (
        <div className="mt-2.5">
          <NewListForm
            autoFocus
            submitLabel="Crea e aggiungi"
            onCancel={() => setCreating(false)}
            onCreate={(name) => {
              // Nasce con questo titolo dentro: è il motivo per cui la stai
              // creando da qui e non dalla pagina delle liste.
              create(name, [item.id]);
              setCreating(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
