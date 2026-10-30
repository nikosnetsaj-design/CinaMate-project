import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useLists, type PersonalList } from "../store/useLists";
import { useSelectedItem } from "../store/useSelectedItem";
import { useListItems } from "../lib/useListItems";
import { describeQuery } from "../lib/listing";
import { ListMosaic } from "../components/ListMosaic";
import { PosterArt } from "../components/PosterArt";
import { PosterCard } from "../components/PosterCard";
import { EmptyState } from "../components/EmptyState";
import { ShareSheet } from "../components/ShareSheet";
import { BackIcon, ChevronDownIcon, ChevronRightIcon, ChevronUpIcon, CloseIcon, PlusIcon, ShareIcon, TrashIcon } from "../components/icons";

/**
 * Le liste personali: «Da vedere col partner», «Horror di ottobre».
 *
 * La watchlist unica è troppo grezza per come si sceglie davvero: si sceglie
 * per occasione e per compagnia. Le liste a mano sono scelte, nell'ordine che
 * dici tu; le liste intelligenti sono ricerche della Libreria salvate con un
 * nome, e si aggiornano da sole. Tutte e due si condividono con il link e il
 * codice QR di sempre.
 */

function ListRow({ list, index, total }: { list: PersonalList; index: number; total: number }) {
  const items = useListItems(list);
  const moveList = useLists((s) => s.moveList);
  return (
    <li className="list-row gap-3 py-2.5 pr-2">
      <Link to={`/liste/${list.id}`} viewTransition className="flex min-w-0 flex-1 items-center gap-3">
        <ListMosaic items={items} className="w-14 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-medium text-text">{list.name}</span>
          <span className="block truncate text-sm tabular text-text-muted">
            {items.length} {items.length === 1 ? "titolo" : "titoli"}
            {list.kind === "smart" ? " · si aggiorna da sola" : ""}
          </span>
        </span>
        <ChevronRightIcon size={16} />
      </Link>
      <span className="flex shrink-0 flex-col">
        <button
          type="button"
          onClick={() => moveList(list.id, -1)}
          disabled={index === 0}
          aria-label={`Sposta ${list.name} in alto`}
          className="flex h-6 w-10 items-center justify-center rounded-xs text-text-muted hover:text-text disabled:opacity-25"
        >
          <ChevronUpIcon size={16} />
        </button>
        <button
          type="button"
          onClick={() => moveList(list.id, 1)}
          disabled={index === total - 1}
          aria-label={`Sposta ${list.name} in basso`}
          className="flex h-6 w-10 items-center justify-center rounded-xs text-text-muted hover:text-text disabled:opacity-25"
        >
          <ChevronDownIcon size={16} />
        </button>
      </span>
    </li>
  );
}

export function Lists() {
  const lists = useLists((s) => s.lists);
  const createManual = useLists((s) => s.createManual);
  const navigate = useNavigate();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-[var(--gutter)] py-6 sm:py-10">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="t-display text-text">Liste</h1>
          <p className="mt-1 text-sm text-text-muted">Per occasione, per compagnia, per stagione.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/liste/${createManual("Nuova lista")}`, { viewTransition: true })}
          className="btn btn-primary shrink-0"
        >
          <PlusIcon size={16} />
          Nuova lista
        </button>
      </div>

      {lists.length === 0 ? (
        <EmptyState
          title="Nessuna lista, per ora."
          description="Creane una qui, aggiungi un titolo dalla sua scheda, o salva una ricerca della Libreria come lista intelligente: si aggiorna da sola."
          action={
            <Link to="/libreria" className="btn btn-secondary">
              Vai alla Libreria
            </Link>
          }
        />
      ) : (
        <ul className="list-group" style={{ "--row-inset": "84px" } as React.CSSProperties}>
          {lists.map((list, i) => (
            <ListRow key={list.id} list={list} index={i} total={lists.length} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function ListDetail() {
  const { id } = useParams();
  const list = useLists((s) => s.lists.find((l) => l.id === id));
  const rename = useLists((s) => s.rename);
  const remove = useLists((s) => s.remove);
  const toggleItem = useLists((s) => s.toggleItem);
  const moveItem = useLists((s) => s.moveItem);
  const openItem = useSelectedItem((s) => s.open);
  const items = useListItems(list);
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(list?.name ?? "");
  const [sharing, setSharing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (!list) {
    return (
      <div className="mx-auto max-w-3xl px-[var(--gutter)] py-10">
        <EmptyState
          title="Questa lista non c'è più."
          description="Forse è stata eliminata, o il link arriva da un altro dispositivo."
          action={
            <Link to="/liste" className="btn btn-secondary">
              Tutte le liste
            </Link>
          }
        />
      </div>
    );
  }

  const criteria = list.kind === "smart" ? describeQuery(list.query) : [];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-[var(--gutter)] py-6 sm:py-10">
      <Link to="/liste" viewTransition className="btn btn-plain btn-sm -ml-3 self-start text-text-muted">
        <BackIcon size={16} />
        Liste
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <ListMosaic items={items} className="w-36 shrink-0 shadow-[var(--shadow-md)] sm:w-44" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-text-muted">{list.kind === "smart" ? "Lista intelligente" : "Lista"}</p>
          {editing ? (
            <form
              className="mt-1 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                rename(list.id, name);
                setEditing(false);
              }}
            >
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-label="Nome della lista"
                className="field min-w-0 flex-1"
              />
              <button type="submit" disabled={!name.trim()} className="btn btn-primary shrink-0">
                Salva
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setName(list.name);
                setEditing(true);
              }}
              className="mt-1 block text-left"
              aria-label={`Rinomina ${list.name}`}
            >
              <h1 className="t-display text-text">{list.name}</h1>
            </button>
          )}
          <p className="mt-1 text-sm tabular text-text-muted">
            {items.length} {items.length === 1 ? "titolo" : "titoli"}
          </p>
          {criteria.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Cosa tiene questa lista">
              {criteria.map((c) => (
                <span key={c} className="rounded-full bg-surface-2 px-3 py-1 text-sm text-text">
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSharing(true)}
            disabled={items.length === 0}
            aria-label="Condividi questa lista"
            className="icon-btn icon-btn-filled disabled:opacity-40"
          >
            <ShareIcon size={18} />
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            aria-label="Elimina questa lista"
            className="icon-btn icon-btn-filled"
          >
            <TrashIcon size={18} />
          </button>
        </div>
      </header>

      {confirmingDelete && (
        <div role="alertdialog" aria-labelledby="delete-list" className="rounded-md bg-surface p-4 shadow-[var(--shadow-sm)]">
          <p id="delete-list" className="text-sm text-text">
            Elimino la lista «{list.name}». I titoli restano nella libreria.
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setConfirmingDelete(false)} className="btn btn-secondary btn-sm">
              Annulla
            </button>
            <button
              type="button"
              onClick={() => {
                remove(list.id);
                navigate("/liste", { replace: true });
              }}
              className="btn btn-danger-fill btn-sm"
            >
              Elimina
            </button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          title={list.kind === "smart" ? "Oggi nessun titolo risponde." : "Ancora vuota."}
          description={
            list.kind === "smart"
              ? "Quando un titolo dello scaffale corrisponderà a queste condizioni, comparirà qui da solo."
              : "Apri un titolo e tocca «Liste» per metterlo qui."
          }
        />
      ) : list.kind === "smart" ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {items.map((item) => (
            <PosterCard key={item.id} item={item} onOpen={openItem} progress />
          ))}
        </div>
      ) : (
        <ol className="list-group" style={{ "--row-inset": "88px" } as React.CSSProperties}>
          {items.map((item, i) => (
            <li key={item.id}>
              <div className="list-row gap-3 py-2 pr-2">
                <span className="w-6 shrink-0 text-center text-sm tabular text-text-faint">{i + 1}</span>
                <button
                  type="button"
                  onClick={() => openItem(item)}
                  aria-label={`Apri dettagli di ${item.title}, ${item.year}`}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <PosterArt item={item} size="sm" showTitle={false} className="w-10 shrink-0 rounded-xs" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-text">{item.title}</span>
                    <span className="block truncate text-xs tabular text-text-muted">
                      {[item.year, item.genre].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </button>
                <span className="flex shrink-0 items-center">
                  <span className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => moveItem(list.id, item.id, -1)}
                      disabled={i === 0}
                      aria-label={`Sposta ${item.title} in alto`}
                      className="flex h-6 w-10 items-center justify-center rounded-xs text-text-muted hover:text-text disabled:opacity-25"
                    >
                      <ChevronUpIcon size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItem(list.id, item.id, 1)}
                      disabled={i === items.length - 1}
                      aria-label={`Sposta ${item.title} in basso`}
                      className="flex h-6 w-10 items-center justify-center rounded-xs text-text-muted hover:text-text disabled:opacity-25"
                    >
                      <ChevronDownIcon size={16} />
                    </button>
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleItem(list.id, item.id)}
                    aria-label={`Togli ${item.title} dalla lista`}
                    className="icon-btn icon-btn-sm text-text-muted"
                  >
                    <CloseIcon size={16} />
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}

      {sharing && <ShareSheet target={{ kind: "list", name: list.name, items }} onClose={() => setSharing(false)} />}
    </div>
  );
}
