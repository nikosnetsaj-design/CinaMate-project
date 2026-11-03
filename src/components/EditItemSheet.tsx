import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Sheet } from "./Sheet";
import { VoteScale } from "./VoteScale";
import { PosterArt } from "./PosterArt";
import { StatusMark } from "./StatusChip";
import { ChevronDownIcon, HeartIcon } from "./icons";
import { voteWord } from "../lib/vote";
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-text-muted">{label}</span>
      {children}
    </label>
  );
}

/**
 * Il modulo, per quello che il catalogo non sa.
 *
 * Arriva qui chi aggiunge a mano (un film raro, un corto, una cosa vista in
 * un festival) o chi modifica. Prima era un muro di campi tutti uguali, dal
 * titolo alle avvertenze. Adesso in alto c'è solo l'essenziale — la locandina
 * che si disegna mentre scrivi il titolo, tipo, anno, a che punto sei, il tuo
 * voto sulla stessa scala del foglio del voto — e il resto (genere, durata,
 * dove, qualità, link, note) sta in «Più dettagli», chiuso finché non serve.
 * Il pulsante per salvare resta sempre in vista, in fondo.
 */
function EditItemForm() {
  const { editingId, draft, patch, close } = useEditSheet();
  const addItem = useLibrary((s) => s.addItem);
  const updateItem = useLibrary((s) => s.updateItem);
  const items = useLibrary((s) => s.items);
  const openDetail = useSelectedItem((s) => s.open);
  const titleId = "edit-sheet-title";
  // Nuovo: i dettagli chiusi. In modifica aperti, perché di solito si viene
  // proprio per quelli (le note, la piattaforma).
  const [more, setMore] = useState(editingId !== null);

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

  const isSeries = draft.kind !== "film";

  return (
    <Sheet onClose={close} titleId={titleId} maxWidthClass="max-w-xl">
      <div className="flex flex-col gap-6 p-5 pt-8 sm:p-7 sm:pt-9">
        {/* La locandina si disegna dal titolo mentre lo scrivi: è la stessa
            che avrà sullo scaffale. */}
        <div className="flex items-end gap-4 pr-10">
          <PosterArt
            item={{ title: draft.title || "…", kind: draft.kind, posterPath: draft.posterPath }}
            size="sm"
            className="w-20 shrink-0 shadow-[var(--shadow-md)]"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold" style={{ color: "var(--accent-text)" }}>
              {editingId ? t("EditItemSheet.modifica_titolo") : t("EditItemSheet.aggiungi_a_mano")}
            </p>
            <h2 id={titleId} className="sr-only">
              {editingId ? t("EditItemSheet.modifica_titolo") : t("EditItemSheet.aggiungi_alla_libreria")}
            </h2>
            <input
              autoFocus={!editingId}
              value={draft.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder={t("EditItemSheet.titolo")}
              aria-label={t("EditItemSheet.titolo")}
              className="mt-1 w-full border-b border-border-strong bg-transparent pb-1.5 font-display text-2xl font-semibold text-text outline-none transition-colors placeholder:text-text-faint focus:border-accent"
            />
          </div>
        </div>

        <div className="segmented segmented-full" role="radiogroup" aria-label={t("EditItemSheet.tipo")}>
          {(Object.keys(KIND_LABELS) as Kind[]).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={draft.kind === k} aria-selected={draft.kind === k} onClick={() => patch({ kind: k })}>
              {KIND_LABELS[k]}
            </button>
          ))}
        </div>

        <div className={`grid gap-3 ${isSeries ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2"}`}>
          <Field label={t("EditItemSheet.anno")}>
            <input type="number" inputMode="numeric" value={draft.year} onChange={(e) => patch({ year: Number(e.target.value) })} className={inputCls} />
          </Field>
          <Field label={isSeries ? t("EditItemSheet.min_episodio") : t("EditItemSheet.durata_min")}>
            <input
              type="number"
              inputMode="numeric"
              value={draft.runtime || ""}
              onChange={(e) => patch({ runtime: Number(e.target.value) })}
              placeholder={isSeries ? "45" : "120"}
              className={inputCls}
            />
          </Field>
          {isSeries && (
            <>
              <Field label={t("EditItemSheet.ep_totali")}>
                <input
                  type="number"
                  inputMode="numeric"
                  value={draft.episodes ?? ""}
                  onChange={(e) => patch({ episodes: e.target.value ? Number(e.target.value) : null })}
                  placeholder="24"
                  className={inputCls}
                />
              </Field>
              <Field label={t("EditItemSheet.stagioni")}>
                <input
                  type="number"
                  inputMode="numeric"
                  value={draft.seasons ?? ""}
                  onChange={(e) => patch({ seasons: e.target.value ? Number(e.target.value) : null })}
                  placeholder="3"
                  className={inputCls}
                />
              </Field>
            </>
          )}
        </div>

        <div>
          <span className="mb-2 block text-sm font-medium text-text-muted">{t("EditItemSheet.stato")}</span>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <button key={s} type="button" onClick={() => patch({ status: s })} aria-pressed={draft.status === s} className="chip">
                <StatusMark status={s} />
                {statusLabel(s)}
              </button>
            ))}
          </div>
          {isSeries && draft.status === "In visione" && (
            <div className="mt-3 max-w-40">
              <Field label={t("EditItemSheet.ep_visti")}>
                <input type="number" inputMode="numeric" value={draft.seen || 0} onChange={(e) => patch({ seen: Number(e.target.value) })} className={inputCls} />
              </Field>
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium text-text-muted">{t("EditItemSheet.il_tuo_voto")}</span>
            <span className="text-sm text-text">
              {draft.vote ? (
                <>
                  <span className="font-semibold tabular">{draft.vote}</span> · {voteWord(draft.vote)}
                  <button type="button" onClick={() => patch({ vote: null })} className="ml-2 text-xs text-text-muted underline-offset-2 hover:underline">
                    {t("EditItemSheet.togli")}
                  </button>
                </>
              ) : (
                <span className="text-text-faint">{t("EditItemSheet.facoltativo")}</span>
              )}
            </span>
          </div>
          <VoteScale
            size="md"
            value={draft.vote}
            label={t("EditItemSheet.il_tuo_voto")}
            onChange={(vote) => patch({ vote })}
            onCommit={(vote) => patch({ vote })}
            onClear={() => patch({ vote: null })}
          />
        </div>

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

        <div className="border-t border-separator pt-2">
          <button
            type="button"
            onClick={() => setMore(!more)}
            aria-expanded={more}
            className="flex w-full items-center justify-between py-2 text-left text-sm font-medium text-text"
          >
            <span>
              {t("EditItemSheet.piu_dettagli")}
              <span className="ml-2 font-normal text-text-faint">{t("EditItemSheet.genere_dove_note")}</span>
            </span>
            <span className={`text-text-muted transition-transform ${more ? "rotate-180" : ""}`} aria-hidden="true">
              <ChevronDownIcon size={18} />
            </span>
          </button>

          {more && (
            <div className="mt-3 flex flex-col gap-5">
              <Field label={t("EditItemSheet.genere")}>
                <input value={draft.genre} onChange={(e) => patch({ genre: e.target.value })} placeholder={t("EditItemSheet.drammatico")} className={inputCls} />
              </Field>

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
                <p className="mt-2 text-xs text-text-muted">{t("EditItemSheet.la_qualita_della_copia")}</p>
              </div>

              <Field label={t("EditItemSheet.note_personali")}>
                <textarea
                  value={draft.notes}
                  onChange={(e) => patch({ notes: e.target.value })}
                  placeholder={t("EditItemSheet.cosa_ne_pensi_spoiler")}
                  rows={3}
                  className={`${inputCls} h-auto resize-none py-3`}
                />
              </Field>

              <div>
                <span className="mb-2 block text-sm font-medium text-text-muted">{t("EditItemSheet.link_personalizzati")}</span>
                <p className="mb-2 text-xs text-text-muted">{t("EditItemSheet.aggiungi_fino_a_2")}</p>
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
              <Field label={t("EditItemSheet.avvertenze")}>
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
              </Field>
            </div>
          )}
        </div>

        {/* Sempre in vista: salvare non deve voler dire scorrere fino in fondo. */}
        <div className="sticky bottom-0 -mx-5 -mb-5 bg-surface px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-1px_0_var(--separator)] sm:-mx-7 sm:-mb-7 sm:px-7 sm:pb-7">
          <button type="button" onClick={save} disabled={!draft.title.trim()} className="btn btn-primary btn-lg w-full">
            {editingId ? t("EditItemSheet.salva_modifiche") : t("EditItemSheet.aggiungi_alla_libreria")}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

export function EditItemSheetPortal() {
  const isOpen = useEditSheet((s) => s.isOpen);
  const editingId = useEditSheet((s) => s.editingId);
  return <AnimatePresence>{isOpen && <EditItemForm key={editingId ?? "new"} />}</AnimatePresence>;
}
