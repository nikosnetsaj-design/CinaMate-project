import { useEffect, useState } from "react";
import { Sheet } from "./Sheet";
import { useAddSheet } from "../store/useAddSheet";
import { useLibrary } from "../store/useLibrary";
import { readSharedList, readSharedTitle, type SharedEntry, type SharedList } from "../lib/share";
import { CheckIcon, PlusIcon } from "./icons";

/**
 * Handles a link someone sent you, or a QR code you scanned.
 *
 * Read once on mount and then cleared from the address bar, so a refresh
 * doesn't reopen the same sheet — and so the link doesn't sit in the URL
 * afterwards, where the next thing shared from this device would carry
 * someone else's list along with it.
 *
 * Nothing is imported automatically. A link that silently wrote twenty titles
 * into your library would be a stranger editing your diary; this offers them
 * one at a time through the normal add sheet, which is also what makes the
 * TMDB lookup and the covers work exactly as they do everywhere else.
 */
/**
 * Read at module load, before React runs anything.
 *
 * This has to happen exactly once per page load, and an effect cannot promise
 * that: StrictMode runs effects twice in development, and the first run has
 * already cleared the hash by the time the second looks at it. Capturing here
 * makes the reading independent of how many times the component mounts.
 */
const incoming = (() => {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash;
  const list = readSharedList(hash);
  const title = readSharedTitle(hash);
  if (!list && !title) return null;
  // `replaceState` rather than assigning location.hash: the latter pushes a
  // history entry, so Back would put the link straight back and reopen this.
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  return { list, title };
})();

export function IncomingShare() {
  const [list, setList] = useState<SharedList | null>(incoming?.list ?? null);
  const [title, setTitle] = useState<string | null>(incoming?.title?.title ?? null);
  const openAddSheet = useAddSheet((s) => s.open);
  const items = useLibrary((s) => s.items);

  // A single title needs no sheet of its own: hand it to the add sheet, which
  // already knows how to search TMDB and fill everything in.
  useEffect(() => {
    if (!title) return;
    openAddSheet(title);
    setTitle(null);
  }, [title, openAddSheet]);

  if (!list) return null;

  const owned = new Set(items.map((i) => i.title.toLowerCase()));

  return (
    <Sheet onClose={() => setList(null)} titleId="incoming-share-title">
      <div className="flex flex-col gap-4 p-5 pt-8 sm:p-6">
        <div>
          <h2 id="incoming-share-title" className="t-title text-text">
            {list.n}
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            {list.e.length} titoli condivisi con te. Tocca quelli che vuoi aggiungere: niente entra
            in libreria da solo.
          </p>
        </div>

        <ul className="list-group bg-surface-2 shadow-none" style={{ "--row-inset": "16px" } as React.CSSProperties}>
          {list.e.map((entry: SharedEntry, index) => {
            const already = owned.has(entry.t.toLowerCase());
            return (
              <li key={`${entry.t}-${index}`}>
                <button
                  type="button"
                  disabled={already}
                  onClick={() => openAddSheet(entry.t)}
                  className="list-row min-h-12 justify-between text-sm text-text hover:bg-surface-hover disabled:cursor-default disabled:hover:bg-transparent"
                >
                  <span className="min-w-0 truncate">
                    {entry.t}
                    {entry.y && <span className="tabular text-text-muted"> · {entry.y}</span>}
                  </span>
                  {already ? (
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs text-text-muted">
                      <CheckIcon size={14} />
                      In libreria
                    </span>
                  ) : (
                    <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-accent-text">
                      <PlusIcon size={16} />
                      Aggiungi
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={() => setList(null)}
          className="btn btn-secondary w-full"
        >
          Chiudi
        </button>
      </div>
    </Sheet>
  );
}
