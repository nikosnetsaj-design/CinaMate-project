import { AnimatePresence } from "framer-motion";
import { Sheet } from "./Sheet";
import { VotePicker } from "./VotePicker";
import { HeartIcon } from "./icons";
import { useEditSheet } from "../store/useEditSheet";
import { useLibrary } from "../store/useLibrary";
import { useSelectedItem } from "../store/useSelectedItem";
import { STATUSES } from "../lib/status";
import { PLATFORMS } from "../types";
import type { Kind } from "../types";

const KIND_LABELS: Record<Kind, string> = {
  film: "Film",
  serie: "Serie TV",
  anime: "Anime",
  doc: "Documentario",
};

const inputCls =
  "w-full rounded-sm border border-border-strong bg-surface px-3 py-2.5 text-sm text-text placeholder:text-text-faint focus:border-accent";

function Pill({ children, active, onClick }: { children: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? "border-transparent" : "border-border-strong text-text-muted hover:bg-surface-hover"
      }`}
      style={active ? { background: "var(--accent)", color: "var(--accent-contrast)" } : undefined}
    >
      {children}
    </button>
  );
}

function EditItemForm() {
  const { editingId, draft, patch, close } = useEditSheet();
  const addItem = useLibrary((s) => s.addItem);
  const updateItem = useLibrary((s) => s.updateItem);
  const items = useLibrary((s) => s.items);
  const openDetail = useSelectedItem((s) => s.open);
  const titleId = "edit-sheet-title";

  function save() {
    if (!draft.title.trim()) return;
    const cleaned = { ...draft, links: draft.links.map((l) => l.trim()).filter(Boolean) };
    if (editingId) {
      updateItem(editingId, cleaned);
      const updated = items.find((i) => i.id === editingId);
      if (updated) openDetail({ ...updated, ...cleaned, id: editingId });
    } else {
      addItem(cleaned);
    }
    close();
  }

  return (
    <Sheet onClose={close} titleId={titleId}>
      <div className="flex flex-col gap-5 p-5 pt-8 sm:p-6">
        <h2 id={titleId} className="font-display text-xl font-semibold text-text">
          {editingId ? "Modifica titolo" : "Aggiungi alla libreria"}
        </h2>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-text-faint">Titolo</span>
          <input
            autoFocus
            value={draft.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="Titolo"
            className={inputCls}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-text-faint">Tipo</span>
            <select
              value={draft.kind}
              onChange={(e) => patch({ kind: e.target.value as Kind })}
              className={inputCls}
            >
              {(Object.keys(KIND_LABELS) as Kind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-text-faint">Anno</span>
            <input
              type="number"
              value={draft.year}
              onChange={(e) => patch({ year: Number(e.target.value) })}
              className={inputCls}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-text-faint">Genere</span>
            <input
              value={draft.genre}
              onChange={(e) => patch({ genre: e.target.value })}
              placeholder="Drammatico"
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-text-faint">
              {draft.kind === "film" ? "Durata (min)" : "Min / episodio"}
            </span>
            <input
              type="number"
              value={draft.runtime || ""}
              onChange={(e) => patch({ runtime: Number(e.target.value) })}
              placeholder="120"
              className={inputCls}
            />
          </label>
        </div>

        <div>
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-text-faint">Stato</span>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <Pill key={s} active={draft.status === s} onClick={() => patch({ status: s })}>
                {s}
              </Pill>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-text-faint">Dove</span>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <Pill key={p} active={draft.platform === p} onClick={() => patch({ platform: p })}>
                {p}
              </Pill>
            ))}
          </div>
        </div>

        {draft.kind !== "film" && (
          <div className="grid grid-cols-3 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-text-faint">Ep. visti</span>
              <input
                type="number"
                value={draft.seen || 0}
                onChange={(e) => patch({ seen: Number(e.target.value) })}
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-text-faint">Ep. totali</span>
              <input
                type="number"
                value={draft.episodes ?? ""}
                onChange={(e) => patch({ episodes: e.target.value ? Number(e.target.value) : null })}
                placeholder="24"
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-text-faint">Stagioni</span>
              <input
                type="number"
                value={draft.seasons ?? ""}
                onChange={(e) => patch({ seasons: e.target.value ? Number(e.target.value) : null })}
                placeholder="3"
                className={inputCls}
              />
            </label>
          </div>
        )}

        <div>
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-faint">Il tuo voto</span>
          <VotePicker value={draft.vote} onChange={(vote) => patch({ vote })} />
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-faint">
            Link personalizzati
          </span>
          <p className="mb-2 text-xs text-text-faint">
            Aggiungi fino a 2 link tuoi — un trailer, una pagina di uno streaming legale, qualsiasi cosa.
          </p>
          <div className="flex flex-col gap-2">
            {[0, 1].map((i) => (
              <input
                key={i}
                type="url"
                value={draft.links[i] ?? ""}
                onChange={(e) => {
                  const next = [...draft.links];
                  next[i] = e.target.value;
                  patch({ links: next });
                }}
                placeholder={`https://…  (link ${i + 1})`}
                className={inputCls}
              />
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-text-faint">Note personali</span>
          <textarea
            value={draft.notes}
            onChange={(e) => patch({ notes: e.target.value })}
            placeholder="Cosa ne pensi? Spoiler liberi."
            rows={3}
            className={`${inputCls} resize-none`}
          />
        </label>

        <button
          type="button"
          onClick={() => patch({ fav: !draft.fav })}
          aria-pressed={draft.fav}
          className="flex items-center gap-2.5 text-sm text-text-muted"
        >
          <span
            className="flex h-6 w-6 items-center justify-center rounded-md"
            style={{ background: draft.fav ? "var(--rust)" : "var(--surface-hover)", color: draft.fav ? "var(--rust-contrast)" : "var(--text-faint)" }}
          >
            <HeartIcon size={13} filled={draft.fav} />
          </span>
          Aggiungi ai preferiti
        </button>

        <button
          type="button"
          onClick={save}
          disabled={!draft.title.trim()}
          className="rounded-sm px-4 py-3 text-sm font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
        >
          {editingId ? "Salva modifiche" : "Aggiungi alla libreria"}
        </button>
      </div>
    </Sheet>
  );
}

export function EditItemSheetPortal() {
  const isOpen = useEditSheet((s) => s.isOpen);
  const editingId = useEditSheet((s) => s.editingId);
  return <AnimatePresence>{isOpen && <EditItemForm key={editingId ?? "new"} />}</AnimatePresence>;
}
