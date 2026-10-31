import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { useLibrary } from "../store/useLibrary";
import { useSelectedItem } from "../store/useSelectedItem";
import { duoUrl, intersect, myDuoList, readDuo, spin, type DuoEntry, type DuoMatch } from "../lib/duo";
import { rankShelf } from "../lib/recommend";
import { shareOrCopy } from "../lib/share";
import { PosterArt } from "../components/PosterArt";
import { RowHeader } from "../components/RowHeader";
import { EmptyState } from "../components/EmptyState";
import { CloseIcon, DiceIcon, PeopleIcon, ShareIcon } from "../components/icons";

const QrCode = lazy(() => import("../components/QrCode").then((m) => ({ default: m.QrCode })));

/*
 * La lista ricevuta resta per la sessione: ricaricare la pagina non deve
 * costare un'altra scansione. Finisce lì — chiusa la scheda, non resta niente
 * di qualcun altro su questo dispositivo.
 */
const THEIRS_KEY = "cinemate:duo:theirs";

function loadTheirs(): DuoEntry[] | null {
  // Arrivati da un link o da un QR: il codice è nel frammento.
  const fromLink = readDuo(window.location.hash);
  if (fromLink) {
    try {
      sessionStorage.setItem(THEIRS_KEY, window.location.hash);
    } catch {
      // solo comodità
    }
    return fromLink;
  }
  try {
    const saved = sessionStorage.getItem(THEIRS_KEY);
    return saved ? readDuo(saved) : null;
  } catch {
    return null;
  }
}

/**
 * Stasera in due.
 *
 * Tre passi su una pagina sola, perché sono una sola conversazione sul divano:
 * mostra la tua lista, ricevi la sua, guardate cosa avete in comune — e se
 * non vi decidete, la ruota. Niente lascia il dispositivo tranne il codice,
 * che contiene solo gli identificativi TMDB.
 */
export function Duo() {
  const items = useLibrary((s) => s.items);
  const pushToast = useLibrary((s) => s.pushToast);
  const openItem = useSelectedItem((s) => s.open);
  const reduceMotion = useReducedMotion();
  const [theirs, setTheirs] = useState<DuoEntry[] | null>(loadTheirs);
  const [pasted, setPasted] = useState("");
  const [pasteError, setPasteError] = useState(false);
  const [pick, setPick] = useState<DuoMatch | null>(null);
  const [spins, setSpins] = useState(0);

  // Il codice letto si toglie dalla barra degli indirizzi: condividere questa
  // pagina più tardi non deve portarsi dietro la lista di un altro.
  useEffect(() => {
    if (window.location.hash.includes("due=")) window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }, []);

  const mine = useMemo(() => myDuoList(items), [items]);
  const unlinked = useMemo(() => items.filter((i) => i.status === "Da vedere" && !i.tmdbId).length, [items]);
  const url = useMemo(() => (mine.length ? duoUrl(mine) : ""), [mine]);
  const reasons = useMemo(() => new Map(rankShelf(items, mine).filter((r) => r.total > 0).map((r) => [r.item.id, r.reason])), [items, mine]);
  const matches = useMemo(() => (theirs ? intersect(mine, theirs, reasons) : []), [mine, theirs, reasons]);

  function receive(text: string) {
    const list = readDuo(text);
    if (!list) {
      setPasteError(true);
      return;
    }
    try {
      sessionStorage.setItem(THEIRS_KEY, `#due=${text.match(/due=([0-9a-z.]+)/i)?.[1] ?? text.trim()}`);
    } catch {
      // solo comodità
    }
    setTheirs(list);
    setPasted("");
    setPasteError(false);
    setPick(null);
  }

  function forget() {
    try {
      sessionStorage.removeItem(THEIRS_KEY);
    } catch {
      // niente da togliere
    }
    setTheirs(null);
    setPick(null);
  }

  function roll() {
    setPick((current) => spin(matches, Math.random, current?.item.id));
    setSpins((n) => n + 1);
  }

  async function send() {
    const outcome = await shareOrCopy({ title: "Stasera in due", text: "La mia lista «Da vedere», per scegliere insieme.", url });
    if (outcome === "copied") pushToast("success", "Link copiato negli appunti.");
    if (outcome === "failed") pushToast("error", "Non è stato possibile condividere: copia il link a mano.");
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 px-[var(--gutter)] py-6 sm:py-10">
      <div>
        <h1 className="t-display text-text">Stasera in due</h1>
        <p className="mt-1 max-w-prose text-sm text-text-muted">
          Scambiatevi le liste «Da vedere» e guardate cosa avete in comune. Il codice porta solo gli identificativi del
          catalogo, nell'ordine dei tuoi gusti: niente nomi, voti o diario.
        </p>
      </div>

      <div className="grid gap-10 md:grid-cols-2 md:gap-6">
        {/* --- La tua lista ------------------------------------------- */}
        <section className="flex flex-col gap-4">
          <RowHeader title="La tua lista" />
          {mine.length === 0 ? (
            <p className="text-sm text-text-muted">
              Nella tua lista «Da vedere» non ci sono titoli collegati al catalogo
              {unlinked > 0 ? ` (${unlinked} senza collegamento: si collegano da soli con la chiave TMDB)` : ""}. Aggiungine
              qualcuno e torna qui.
            </p>
          ) : (
            <div className="flex flex-col items-center gap-4 rounded-lg bg-surface p-5 shadow-[var(--shadow-sm)]">
              <div className="rounded-md bg-white p-3">
                <Suspense fallback={<div className="h-[200px] w-[200px]" />}>
                  <QrCode value={url} size={200} label="Codice QR della tua lista Da vedere" />
                </Suspense>
              </div>
              <p className="text-center text-sm text-text-muted">
                {mine.length} {mine.length === 1 ? "titolo" : "titoli"}. Fai inquadrare il codice, o manda il link.
              </p>
              <button type="button" className="btn btn-secondary" onClick={() => void send()}>
                <ShareIcon size={16} />
                Manda il link
              </button>
            </div>
          )}
        </section>

        {/* --- La sua lista ------------------------------------------ */}
        <section className="flex flex-col gap-4">
          <RowHeader title="La sua lista" />
          {theirs ? (
            <div className="flex items-center justify-between gap-3 rounded-lg bg-surface p-4 shadow-[var(--shadow-sm)]">
              <p className="text-sm text-text">
                Ricevuta: {theirs.length} {theirs.length === 1 ? "titolo" : "titoli"}.
              </p>
              <button type="button" className="btn btn-plain btn-sm" onClick={forget}>
                <CloseIcon size={14} />
                Dimentica
              </button>
            </div>
          ) : (
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                receive(pasted);
              }}
            >
              <p className="text-sm text-text-muted">
                Inquadra il suo codice con la fotocamera: il link apre questa pagina. Oppure incolla qui il link che ti ha
                mandato.
              </p>
              <div className="flex gap-2">
                <input
                  value={pasted}
                  onChange={(e) => {
                    setPasted(e.target.value);
                    setPasteError(false);
                  }}
                  placeholder="https://…/stasera-in-due#due=…"
                  aria-label="Link o codice dell'altra lista"
                  aria-invalid={pasteError}
                  aria-describedby={pasteError ? "duo-paste-error" : undefined}
                  className="field min-w-0 flex-1"
                />
                <button type="submit" className="btn btn-primary shrink-0" disabled={!pasted.trim()}>
                  Confronta
                </button>
              </div>
              {pasteError && (
                <p id="duo-paste-error" role="alert" className="text-xs" style={{ color: "var(--danger)" }}>
                  Questo non è un link di «Stasera in due», o è arrivato tagliato.
                </p>
              )}
            </form>
          )}
        </section>
      </div>

      {/* --- In comune ------------------------------------------------ */}
      {theirs &&
        (matches.length === 0 ? (
          <EmptyState
            icon={<PeopleIcon size={22} />}
            title="Nessun titolo in comune."
            description="Le due liste non si toccano. Scegliete uno dei suoi da aggiungere alla tua, o fate il contrario."
          />
        ) : (
          <section className="flex flex-col gap-4">
            <RowHeader
              title="In comune"
              count={matches.length}
              trailing={
                <button type="button" className="btn btn-primary btn-sm" onClick={roll}>
                  <DiceIcon size={14} />
                  {pick ? "Un altro" : "Gira la ruota"}
                </button>
              }
            />

            <AnimatePresence mode="wait">
              {pick && (
                <m.div
                  key={spins}
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, rotate: -2 }}
                  animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, rotate: 0 }}
                  exit={{ opacity: 0 }}
                  transition={reduceMotion ? { duration: 0.15 } : { type: "spring", stiffness: 260, damping: 22 }}
                  className="flex items-center gap-4 rounded-lg bg-surface p-4 shadow-[var(--shadow-sm)]"
                  aria-live="polite"
                >
                  <PosterArt item={pick.item} size="md" showTitle={false} className="w-20 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-text-muted">Stasera</p>
                    <p className="t-title truncate text-text">{pick.item.title}</p>
                    <p className="mt-0.5 text-sm text-text-muted">
                      Compatibilità {pick.compat}% · {pick.reason}
                    </p>
                    <button type="button" className="btn btn-secondary btn-sm mt-2.5" onClick={() => openItem(pick.item)}>
                      Apri la scheda
                    </button>
                  </div>
                </m.div>
              )}
            </AnimatePresence>

            <ol className="list-group" style={{ "--row-inset": "72px" } as React.CSSProperties}>
              {matches.map((m) => (
                <li key={m.item.id}>
                  <button type="button" onClick={() => openItem(m.item)} className="list-row gap-3 py-2.5" aria-label={`Apri dettagli di ${m.item.title}, compatibilità ${m.compat}%`}>
                    <PosterArt item={m.item} size="sm" showTitle={false} className="w-10 shrink-0" />
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-sm font-medium text-text">{m.item.title}</span>
                      <span className="block truncate text-xs text-text-muted">{m.reason}</span>
                    </span>
                    <span className="t-figure shrink-0 tabular text-text">{m.compat}%</span>
                  </button>
                </li>
              ))}
            </ol>
            <p className="text-xs text-text-faint">
              La compatibilità è quanto il titolo sta in alto in tutte e due le liste.
              {theirs.length - matches.length === 1 && " Nella sua lista c'è un altro titolo che tu non hai."}
              {theirs.length - matches.length > 1 && ` Nella sua lista ce ne sono altri ${theirs.length - matches.length} che tu non hai.`}
            </p>
          </section>
        ))}
    </div>
  );
}
