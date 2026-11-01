import { useState } from "react";
import { Link } from "react-router-dom";
import { Sheet } from "./Sheet";
import { useLists } from "../store/useLists";
import type { Item } from "../types";
import { PlusIcon } from "./icons";

/**
 * In quali liste sta questo titolo. Un interruttore per lista: si mette e si
 * toglie con lo stesso gesto, e si vede subito dove sta già. Le liste
 * intelligenti non compaiono — lì un titolo entra se risponde alla ricerca,
 * non perché lo metti tu.
 */
export function ListPickerSheet({ item, onClose }: { item: Item; onClose: () => void }) {
  const lists = useLists((s) => s.lists);
  const toggleItem = useLists((s) => s.toggleItem);
  const createManual = useLists((s) => s.createManual);
  const [name, setName] = useState("");
  const manual = lists.filter((l) => l.kind === "manual");
  const titleId = "list-picker-title";

  return (
    <Sheet onClose={onClose} titleId={titleId} maxWidthClass="max-w-md">
      <div className="flex flex-col gap-5 p-5 pt-8 sm:p-6">
        <div>
          <h2 id={titleId} className="t-title text-text">
            Liste
          </h2>
          <p className="mt-1 text-sm text-text-muted">Dove tenere «{item.title}».</p>
        </div>

        {manual.length > 0 && (
          <ul className="list-group bg-surface-2 shadow-none" style={{ "--row-inset": "16px" } as React.CSSProperties}>
            {manual.map((list) => {
              const inside = list.itemIds.includes(item.id);
              return (
                <li key={list.id}>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={inside}
                    onClick={() => toggleItem(list.id, item.id)}
                    className="list-row min-h-12 justify-between hover:bg-surface-hover"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-text">{list.name}</span>
                      <span className="block text-xs tabular text-text-muted">
                        {list.itemIds.length} {list.itemIds.length === 1 ? "titolo" : "titoli"}
                      </span>
                    </span>
                    <span aria-hidden="true" className="switch" data-on={inside} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            createManual(name.trim() || "Nuova lista", [item.id]);
            setName("");
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nuova lista, es. Da vedere col partner"
            aria-label="Nome della nuova lista"
            className="field min-w-0 flex-1"
          />
          <button type="submit" className="btn btn-secondary shrink-0" aria-label="Crea la lista con questo titolo">
            <PlusIcon size={16} />
            Crea
          </button>
        </form>

        <Link to="/liste" onClick={onClose} className="btn btn-plain btn-sm -ml-3 self-start">
          Tutte le liste
        </Link>
      </div>
    </Sheet>
  );
}
