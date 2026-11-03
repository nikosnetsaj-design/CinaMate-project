import { useEffect, useRef, useState } from "react";
import { VoteScale } from "./VoteScale";
import { AnimatePresence, m } from "framer-motion";
import { Sheet } from "./Sheet";
import { PosterArt } from "./PosterArt";
import { CheckIcon } from "./icons";
import { useRateSheet } from "../store/useRateSheet";
import { useLibrary } from "../store/useLibrary";
import { voteColor, voteWord } from "../lib/vote";
import type { Item } from "../types";
import { t } from "../lib/i18n";

/**
 * Il voto con un tocco.
 *
 * Prima «Voto» apriva il modulo intero di modifica, e il voto stava in fondo,
 * sotto genere, durata e piattaforma: per dire «8» bisognava scorrere un
 * modulo. Adesso è un foglio solo per quello — una scala da 1 a 10 che si
 * tocca o si trascina col dito, il numero grande che cambia mentre ti muovi,
 * la parola che lo dice («Ottimo»). Quando alzi il dito il voto è salvato e il
 * foglio si chiude da solo: non c'è un «Salva» da cercare.
 *
 * La scala è `VoteScale`, la stessa del modulo di modifica.
 */

const CLOSE_AFTER_MS = 650;

function RateContent({ item }: { item: Item }) {
  const close = useRateSheet((s) => s.close);
  const updateItem = useLibrary((s) => s.updateItem);
  const setStatus = useLibrary((s) => s.setStatus);
  const pushToast = useLibrary((s) => s.pushToast);

  const [value, setValue] = useState<number | null>(item.vote);
  const [saved, setSaved] = useState(false);
  // Un film votato è un film visto: la spunta è già messa, e si può togliere.
  // Per una serie no — si vota anche a metà, e «vista» vorrebbe dire finita.
  const canMarkWatched = item.status !== "Visto" && (item.kind === "film" || item.kind === "doc");
  const [markWatched, setMarkWatched] = useState(canMarkWatched);
  const timer = useRef<number | undefined>(undefined);
  const titleId = "rate-sheet-title";

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function preview(next: number) {
    setValue(next);
    setSaved(false);
  }

  function save(next: number, thenClose: boolean) {
    setValue(next);
    updateItem(item.id, { vote: next });
    if (markWatched && canMarkWatched) setStatus(item.id, "Visto");
    setSaved(true);
    window.clearTimeout(timer.current);
    if (thenClose) {
      timer.current = window.setTimeout(() => {
        close();
        pushToast("success", t("RateSheet.voto_salvato", { v0: item.title, v1: next, v2: voteWord(next) }));
      }, CLOSE_AFTER_MS);
    }
  }

  function remove() {
    updateItem(item.id, { vote: null });
    close();
    pushToast("info", t("RateSheet.voto_tolto", { v0: item.title }));
  }

  const tone = value ? voteColor(value) : "var(--text-faint)";

  return (
    <Sheet onClose={close} titleId={titleId} maxWidthClass="max-w-md">
      <div className="flex flex-col gap-6 p-6 pt-7">
        <div className="flex items-center gap-3 pr-8">
          <PosterArt item={item} size="sm" showTitle={false} className="w-11 shrink-0 shadow-[var(--shadow-sm)]" />
          <div className="min-w-0">
            <p className="text-xs font-semibold" style={{ color: "var(--accent-text)" }}>
              {t("RateSheet.il_tuo_voto")}
            </p>
            <h2 id={titleId} className="t-section truncate text-text">
              {item.title}
            </h2>
          </div>
        </div>

        {/* Il numero grande: cambia mentre il dito scorre, prima di alzarlo. */}
        <div className="flex h-28 flex-col items-center justify-center" aria-hidden="true">
          <AnimatePresence mode="popLayout" initial={false}>
            <m.span
              key={value ?? "none"}
              initial={{ opacity: 0, y: 10, scale: 0.86 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 520, damping: 34 }}
              className="font-display text-7xl font-semibold leading-none tabular"
              style={{ color: tone }}
            >
              {value ?? "–"}
            </m.span>
          </AnimatePresence>
          <span className="mt-2 h-5 text-sm font-medium text-text-muted">
            {value ? voteWord(value) : t("RateSheet.tocca_o_trascina")}
          </span>
        </div>

        <VoteScale
          value={value}
          label={t("RateSheet.il_tuo_voto")}
          onChange={preview}
          // Col dito: alzarlo salva e chiude. Con le frecce: salva e resta, si
          // chiude con Invio.
          onCommit={(next, how) => save(next, how !== "key")}
          onClear={item.vote != null ? remove : undefined}
        />

        <div className="-mt-3 flex h-5 items-center justify-center gap-1.5 text-xs text-text-muted" aria-live="polite">
          {saved ? (
            <>
              <span style={{ color: "var(--success)" }}>
                <CheckIcon size={14} />
              </span>
              {t("RateSheet.salvato")}
            </>
          ) : (
            value != null && t("RateSheet.alza_il_dito_per")
          )}
        </div>

        {canMarkWatched && (
          <button
            type="button"
            role="switch"
            aria-checked={markWatched}
            onClick={() => setMarkWatched(!markWatched)}
            className="flex min-h-12 items-center gap-3 rounded-md bg-surface-2 px-4 text-left text-sm font-medium text-text"
          >
            <span className="flex-1">{t("RateSheet.segnalo_anche_come_visto")}</span>
            <span aria-hidden="true" className="switch" data-on={markWatched} />
          </button>
        )}

        {item.vote != null && (
          <button type="button" onClick={remove} className="btn btn-plain -mt-2 self-center text-text-muted">
            {t("RateSheet.togli_il_voto")}
          </button>
        )}
      </div>
    </Sheet>
  );
}

export function RateSheetPortal() {
  const itemId = useRateSheet((s) => s.itemId);
  const item = useLibrary((s) => (itemId ? s.items.find((i) => i.id === itemId) ?? null : null));
  return <AnimatePresence>{item && <RateContent key={item.id} item={item} />}</AnimatePresence>;
}
