import { AnimatePresence } from "framer-motion";
import { Sheet } from "./Sheet";
import { VotePicker } from "./VotePicker";
import { HeartIcon } from "./icons";
import { useEditSheet } from "../store/useEditSheet";
import { useLibrary } from "../store/useLibrary";
import { useSelectedItem } from "../store/useSelectedItem";
import { STATUSES } from "../lib/status";
import { PLATFORMS, QUALITIES } from "../types";
import type { Kind } from "../types";
import { platformLabel, statusLabel, t } from "../lib/i18n";

const KIND_LABELS: Record<Kind, string> = {
  film: t("EditItemSheet.film"),
  serie: t("EditItemSheet.serie_tv"),
  anime: "Anime",
  doc: t("EditItemSheet.documentario"),
};

const inputCls = "field";

function Pill({ children, active, onClick }: { children: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="chip"
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
        <h2 id={titleId} className="t-title text-text">
          {editingId ? t("EditItemSheet.modifica_titolo") : t("EditItemSheet.aggiungi_alla_libreria")}
        </h2>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text-muted">{t("EditItemSheet.titolo")}</span>
          <input
            autoFocus
            value={draft.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder={t("EditItemSheet.titolo")}
            className={inputCls}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text-muted">{t("EditItemSheet.tipo")}</span>
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
            <span className="text-sm font-medium text-text-muted">{t("EditItemSheet.anno")}</span>
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
            <span className="text-sm font-medium text-text-muted">{t("EditItemSheet.genere")}</span>
            <input
              value={draft.genre}
              onChange={(e) => patch({ genre: e.target.value })}
              placeholder={t("EditItemSheet.drammatico")}
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text-muted">
              {draft.kind === "film" ? t("EditItemSheet.durata_min") : t("EditItemSheet.min_episodio")}
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
          <span className="mb-2 block text-sm font-medium text-text-muted">{t("EditItemSheet.stato")}</span>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <Pill key={s} active={draft.status === s} onClick={() => patch({ status: s })}>
                {statusLabel(s)}
              </Pill>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-2 block text-sm font-medium text-text-muted">{t("EditItemSheet.dove")}</span>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <Pill key={p} active={draft.platform === p} onClick={() => patch({ platform: p })}>
                {platformLabel(p)}
              </Pill>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-2 block text-sm font-medium text-text-muted">{t("EditItemSheet.qualita")}</span>
          <div className="flex flex-wrap gap-2">
            {QUALITIES.map((quality) => (
              <Pill
                key={quality}
                active={draft.quality === quality}
                // Tapping the active one clears it: "non lo so" is a real
                // answer here and there has to be a way back to it.
                onClick={() => patch({ quality: draft.quality === quality ? null : quality })}
              >
                {quality}
              </Pill>
            ))}
          </div>
          <p className="mt-2 text-xs text-text-muted">
            {t("EditItemSheet.la_qualita_della_copia")}
          </p>
        </div>

        {draft.kind !== "film" && (
          <div className="grid grid-cols-3 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-text-muted">{t("EditItemSheet.ep_visti")}</span>
              <input
                type="number"
                value={draft.seen || 0}
                onChange={(e) => patch({ seen: Number(e.target.value) })}
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-text-muted">{t("EditItemSheet.ep_totali")}</span>
              <input
                type="number"
                value={draft.episodes ?? ""}
                onChange={(e) => patch({ episodes: e.target.value ? Number(e.target.value) : null })}
                placeholder="24"
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-text-muted">{t("EditItemSheet.stagioni")}</span>
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
          <span className="mb-2 block text-sm font-medium text-text-muted">{t("EditItemSheet.il_tuo_voto")}</span>
          <VotePicker value={draft.vote} onChange={(vote) => patch({ vote })} />
        </div>

        <div>
          <span className="mb-2 block text-sm font-medium text-text-muted">
            {t("EditItemSheet.link_personalizzati")}
          </span>
          <p className="mb-2 text-xs text-text-muted">
            {t("EditItemSheet.aggiungi_fino_a_2")}
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

        {/* Quello che il player scrive nel cartello dei primi secondi, sotto la
            sigla della classificazione. A mano perché nessun catalogo pubblico
            le espone in modo affidabile: meglio vuoto che inventato. */}
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text-muted">{t("EditItemSheet.avvertenze")}</span>
          <input
            value={draft.contentWarnings ?? ""}
            onChange={(e) => patch({ contentWarnings: e.target.value })}
            placeholder={t("EditItemSheet.linguaggio_forte_consumo_di")}
            className={inputCls}
          />
          <span className="text-xs text-text-muted">
            {t("EditItemSheet.separate_da_virgola_compaiono")}
            {draft.certification ? ` (${draft.certification})` : ""}.
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text-muted">{t("EditItemSheet.note_personali")}</span>
          <textarea
            value={draft.notes}
            onChange={(e) => patch({ notes: e.target.value })}
            placeholder={t("EditItemSheet.cosa_ne_pensi_spoiler")}
            rows={3}
            className={`${inputCls} h-auto resize-none py-3`}
          />
        </label>

        {/* Un interruttore con il suo nome: tutta la riga si tocca, e lo
            stato si legge dal pomello come in ogni impostazione di sistema. */}
        <button
          type="button"
          role="switch"
          onClick={() => patch({ fav: !draft.fav })}
          aria-checked={draft.fav}
          className="flex min-h-12 items-center gap-3 rounded-md bg-surface-2 px-4 text-left text-sm font-medium text-text"
        >
          <span className={draft.fav ? "text-accent-text" : "text-text-muted"}>
            <HeartIcon size={18} filled={draft.fav} />
          </span>
          <span className="flex-1">{t("EditItemSheet.tra_i_preferiti")}</span>
          <span aria-hidden="true" className="switch" data-on={draft.fav} />
        </button>

        <button
          type="button"
          onClick={save}
          disabled={!draft.title.trim()}
          className="btn btn-primary btn-lg"
        >
          {editingId ? t("EditItemSheet.salva_modifiche") : t("EditItemSheet.aggiungi_alla_libreria")}
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
