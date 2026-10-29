import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useLists } from "../store/useLists";
import { useLibrary } from "../store/useLibrary";
import { useSelectedItem } from "../store/useSelectedItem";
import { useVisibleItems } from "../lib/useVisibleItems";
import { useAppReady } from "../lib/useAppReady";
import { listItems, type UserList } from "../lib/lists";
import { matchQuality } from "../lib/search";
import { formatRuntime } from "../lib/format";
import { LibraryTabs } from "../components/LibraryTabs";
import { ListMosaic, NewListForm } from "../components/ListsUI";
import { EmptyState } from "../components/EmptyState";
import { PosterCard } from "../components/PosterCard";
import { PosterArt } from "../components/PosterArt";
import { ShareSheet } from "../components/ShareSheet";
import { SearchBar } from "../components/SearchBar";
import { Sheet } from "../components/Sheet";
import {
  BackIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CloseIcon,
  DiceIcon,
  ListIcon,
  ListsIcon,
  PencilIcon,
  PlusIcon,
  ShareIcon,
  TrashIcon,
} from "../components/icons";
import type { Item } from "../types";

/** Nomi da cui partire, quando non c'è ancora nessuna lista: esempi, non categorie. */
const STARTERS = ["Da vedere insieme", "Horror di ottobre", "I preferiti di sempre", "Da recuperare"];

function useItemsById(): Map<string, Item> {
  const items = useVisibleItems();
  return useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
}

/** «12 titoli · 9 visti»: cosa c'è dentro, e quanto ne hai già attraversato. */
function summary(entries: Item[]): string {
  if (entries.length === 0) return "Vuota";
  const watched = entries.filter((i) => i.status === "Visto").length;
  const parts = [`${entries.length} ${entries.length === 1 ? "titolo" : "titoli"}`];
  if (watched > 0) parts.push(watched === entries.length ? "tutti visti" : `${watched} ${watched === 1 ? "visto" : "visti"}`);
  return parts.join(" · ");
}

export function Lists() {
  const ready = useAppReady();
  const lists = useLists((s) => s.lists);
  const create = useLists((s) => s.create);
  const byId = useItemsById();
  const navigate = useNavigate();

  const open = (id: string | null) => {
    if (id) navigate(`/liste/${encodeURIComponent(id)}`, { viewTransition: true });
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-[var(--gutter)] py-6 sm:py-10">
      <div>
        <h1 className="t-display text-text">Liste</h1>
        <p className="mt-1 text-sm text-text-muted">Le fai tu: per una persona, per una stagione, per una sera.</p>
      </div>

      <LibraryTabs />

      {!ready ? null : lists.length === 0 ? (
        <EmptyState
          icon={<ListsIcon size={24} />}
          title="Nessuna lista, per ora"
          description="Una lista è un nome scelto da te. I titoli ci entrano dalla loro scheda, o da qui con «Aggiungi titoli»."
          action={
            <div className="flex flex-col items-center gap-4">
              <div className="flex flex-wrap justify-center gap-2">
                {STARTERS.map((name) => (
                  <button key={name} type="button" onClick={() => open(create(name))} className="chip">
                    <PlusIcon size={14} />
                    {name}
                  </button>
                ))}
              </div>
              <div className="w-full max-w-sm">
                <NewListForm onCreate={(name) => open(create(name))} />
              </div>
            </div>
          }
        />
      ) : (
        <>
          <NewListForm onCreate={(name) => open(create(name))} />
          <ul className="list-group">
            {lists.map((list) => {
              const entries = listItems(list, byId);
              return (
                <li key={list.id}>
                  <Link to={`/liste/${encodeURIComponent(list.id)}`} viewTransition className="list-row gap-4">
                    <ListMosaic list={list} byId={byId} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-medium text-text">{list.name}</span>
                      <span className="mt-0.5 block text-sm tabular text-text-muted">{summary(entries)}</span>
                    </span>
                    <span className="shrink-0 text-text-faint">
                      <ChevronRightIcon size={18} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

export function ListDetail() {
  const { id = "" } = useParams();
  const list = useLists((s) => s.lists.find((l) => l.id === id));
  const ready = useAppReady();

  if (!list) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-[var(--gutter)] py-6 sm:py-10">
        <LibraryTabs />
        {ready && (
          <EmptyState
            icon={<ListsIcon size={24} />}
            title="Questa lista non c'è più"
            description="Forse l'hai eliminata, o il collegamento viene da un altro dispositivo: le liste vivono su quello in cui le crei, e viaggiano col backup."
            action={
              <Link to="/liste" className="btn btn-secondary">
                Tutte le liste
              </Link>
            }
          />
        )}
      </div>
    );
  }
  // Rimontato per lista: le modalità (rinomina, ordina, conferma) sono di
  // quella lista, e portarle su un'altra sarebbe una sorpresa.
  return <ListView key={list.id} list={list} />;
}

function ListView({ list }: { list: UserList }) {
  const byId = useItemsById();
  const rename = useLists((s) => s.rename);
  const remove = useLists((s) => s.remove);
  const removeItem = useLists((s) => s.removeItem);
  const move = useLists((s) => s.move);
  const openItem = useSelectedItem((s) => s.open);
  const pushToast = useLibrary((s) => s.pushToast);
  const navigate = useNavigate();

  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(list.name);
  const [ordering, setOrdering] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [picking, setPicking] = useState(false);
  const [sharing, setSharing] = useState(false);

  const entries = listItems(list, byId);
  const watched = entries.filter((i) => i.status === "Visto").length;
  const pct = entries.length ? Math.round((watched / entries.length) * 100) : 0;
  const minutesLeft = entries
    .filter((i) => i.status !== "Visto")
    .reduce((sum, i) => sum + (i.kind === "film" || i.kind === "doc" ? i.runtime : i.runtime * Math.max(0, (i.episodes ?? 0) - (i.seen || 0))), 0);

  /**
   * «Scegli tu»: uno a caso fra quelli che non hai ancora visto. È il motivo
   * per cui esiste una lista «Da vedere insieme» — la sera in cui nessuno dei
   * due vuole decidere. Dice da dove ha pescato, perché un consiglio senza il
   * suo perché è pubblicità (regola di prodotto n. 2).
   */
  function pickForMe() {
    const pool = entries.filter((i) => i.status !== "Visto" && i.status !== "Abbandonato");
    if (pool.length === 0) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    pushToast("info", `A caso fra ${pool.length === 1 ? "l'unico" : `i ${pool.length}`} della lista ancora da vedere.`);
    openItem(pick);
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-[var(--gutter)] py-6 sm:py-10">
      <Link to="/liste" viewTransition className="btn btn-plain btn-sm -ml-3 self-start">
        <BackIcon size={16} />
        Liste
      </Link>

      {renaming ? (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            rename(list.id, draftName);
            setRenaming(false);
          }}
        >
          <label htmlFor="list-name" className="sr-only">
            Nuovo nome della lista
          </label>
          <input
            id="list-name"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            autoFocus
            maxLength={60}
            className="field min-w-0 flex-1 basis-56"
          />
          <button type="submit" disabled={!draftName.trim()} className="btn btn-primary disabled:opacity-40">
            Salva
          </button>
          <button
            type="button"
            onClick={() => {
              setDraftName(list.name);
              setRenaming(false);
            }}
            className="btn btn-secondary"
          >
            Annulla
          </button>
        </form>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="t-display break-words text-text">{list.name}</h1>
            <p className="mt-1 text-sm tabular text-text-muted">
              {summary(entries)}
              {minutesLeft > 0 && ` · ${formatRuntime(minutesLeft)} da vedere`}
            </p>
          </div>
          <button type="button" onClick={() => setRenaming(true)} aria-label="Rinomina la lista" className="icon-btn shrink-0">
            <PencilIcon size={18} />
          </button>
        </div>
      )}

      {entries.length > 0 && (
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label="Titoli visti" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${pct}%`, background: "var(--accent)" }} />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setPicking(true)} className="btn btn-primary btn-sm">
          <PlusIcon size={16} />
          Aggiungi titoli
        </button>
        {entries.some((i) => i.status !== "Visto" && i.status !== "Abbandonato") && (
          <button type="button" onClick={pickForMe} className="btn btn-secondary btn-sm">
            <DiceIcon size={16} />
            Scegli tu
          </button>
        )}
        {entries.length > 1 && (
          <button type="button" onClick={() => setOrdering((v) => !v)} aria-pressed={ordering} className="btn btn-secondary btn-sm">
            {ordering ? <CheckIcon size={16} /> : <ListIcon size={16} />}
            {ordering ? "Fatto" : "Riordina"}
          </button>
        )}
        {entries.length > 0 && (
          <button type="button" onClick={() => setSharing(true)} className="btn btn-secondary btn-sm">
            <ShareIcon size={16} />
            Condividi
          </button>
        )}
        <button type="button" onClick={() => setConfirmingDelete(true)} className="btn btn-danger btn-sm">
          <TrashIcon size={16} />
          Elimina
        </button>
      </div>

      {confirmingDelete && (
        <div
          role="alertdialog"
          aria-labelledby="list-delete-confirm"
          className="rounded-lg p-4"
          style={{ background: "color-mix(in srgb, var(--danger) 10%, var(--surface))" }}
        >
          <p id="list-delete-confirm" className="text-sm text-text">
            Elimino la lista «{list.name}»? I titoli restano in libreria: sparisce solo la lista.
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => setConfirmingDelete(false)} className="btn btn-secondary flex-1">
              Annulla
            </button>
            <button
              type="button"
              onClick={() => {
                remove(list.id);
                pushToast("info", `Lista «${list.name}» eliminata.`);
                navigate("/liste", { replace: true });
              }}
              className="btn btn-danger-fill flex-1"
            >
              Elimina
            </button>
          </div>
        </div>
      )}

      {entries.length === 0 ? (
        <EmptyState
          icon={<ListsIcon size={24} />}
          title="La lista è vuota"
          description="Aggiungi i titoli da qui, oppure dalla loro scheda: in Dettagli c'è una pastiglia per ogni lista."
          action={
            <button type="button" onClick={() => setPicking(true)} className="btn btn-primary">
              Aggiungi titoli
            </button>
          }
        />
      ) : ordering ? (
        <ol className="list-group">
          {entries.map((item, index) => (
            <li key={item.id} className="list-row gap-3">
              <span className="w-6 shrink-0 text-right text-sm tabular text-text-faint">{index + 1}</span>
              <PosterArt item={item} size="sm" showTitle={false} className="w-10 shrink-0 rounded-xs" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-text">{item.title}</span>
              <span className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => move(list.id, item.id, -1)}
                  disabled={index === 0}
                  aria-label={`Sposta ${item.title} più su`}
                  className="icon-btn icon-btn-sm disabled:opacity-30"
                >
                  <ChevronUpIcon size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => move(list.id, item.id, 1)}
                  disabled={index === entries.length - 1}
                  aria-label={`Sposta ${item.title} più giù`}
                  className="icon-btn icon-btn-sm disabled:opacity-30"
                >
                  <ChevronDownIcon size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(list.id, item.id)}
                  aria-label={`Togli ${item.title} dalla lista`}
                  className="icon-btn icon-btn-sm"
                >
                  <CloseIcon size={16} />
                </button>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {entries.map((item) => (
            <PosterCard key={item.id} item={item} onOpen={openItem} progress />
          ))}
        </div>
      )}

      {picking && <ListPickerSheet list={list} onClose={() => setPicking(false)} />}
      {sharing && <ShareSheet target={{ kind: "list", name: list.name, items: entries }} onClose={() => setSharing(false)} />}
    </div>
  );
}

/**
 * Scegliere i titoli dalla libreria, senza aprirli uno per uno.
 *
 * Ogni riga è un interruttore: tocchi ed entra, ritocchi ed esce. In cima ci
 * sono quelli già dentro, così si vede subito cosa c'è e si toglie senza
 * cercarlo; sotto, il resto dello scaffale dal più recente. Oltre duecento
 * risultati si chiede di restringere invece di disegnare mille righe.
 */
function ListPickerSheet({ list, onClose }: { list: UserList; onClose: () => void }) {
  const items = useVisibleItems();
  const toggleItem = useLists((s) => s.toggleItem);
  const live = useLists((s) => s.lists.find((l) => l.id === list.id)) ?? list;
  const [q, setQ] = useState("");
  const inside = new Set(live.itemIds);

  const LIMIT = 200;
  const matches = useMemo(
    () => items.filter((item) => matchQuality(item, q) !== "none"),
    [items, q],
  );
  const ordered = useMemo(
    () => [...matches.filter((i) => list.itemIds.includes(i.id)), ...matches.filter((i) => !list.itemIds.includes(i.id))],
    // L'ordine si fissa all'apertura e a ogni ricerca, non a ogni tocco: una
    // riga che salta in cima mentre la tocchi è una riga che non trovi più.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [matches],
  );

  return (
    <Sheet onClose={onClose} titleId="list-picker-title">
      <div className="flex flex-col gap-4 p-5 pt-8 sm:p-6">
        <div>
          <h2 id="list-picker-title" className="t-title pr-10 text-text">
            Aggiungi a «{live.name}»
          </h2>
          <p className="mt-1 text-sm tabular text-text-muted">
            {inside.size} {inside.size === 1 ? "titolo" : "titoli"} nella lista
          </p>
        </div>
        <SearchBar value={q} onChange={setQ} placeholder="Cerca nella libreria…" />
        {items.length === 0 ? (
          <p className="text-sm text-text-muted">La libreria è vuota: aggiungi prima qualche titolo.</p>
        ) : ordered.length === 0 ? (
          <p className="text-sm text-text-muted">Niente con «{q}».</p>
        ) : (
          <ul className="list-group bg-surface-2 shadow-none" style={{ "--row-inset": "16px" } as React.CSSProperties}>
            {ordered.slice(0, LIMIT).map((item) => {
              const on = inside.has(item.id);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleItem(list.id, item.id)}
                    className="list-row min-h-14 gap-3 hover:bg-surface-hover"
                  >
                    <PosterArt item={item} size="sm" showTitle={false} className="w-9 shrink-0 rounded-xs" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-text">{item.title}</span>
                      <span className="block truncate text-xs tabular text-text-muted">
                        {[item.year || null, item.status].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${on ? "bg-accent text-accent-contrast" : "bg-surface text-text-faint"}`}
                    >
                      {on ? <CheckIcon size={16} /> : <PlusIcon size={16} />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {ordered.length > LIMIT && (
          <p className="text-xs text-text-muted">Ne mostro {LIMIT} su {ordered.length}: scrivi qualcosa per restringere.</p>
        )}
        <button type="button" onClick={onClose} className="btn btn-primary w-full">
          Fatto
        </button>
      </div>
    </Sheet>
  );
}
