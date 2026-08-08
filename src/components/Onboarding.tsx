import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useLibrary } from "../store/useLibrary";
import { useSettings } from "../store/useSettings";
import { useOnboarding } from "../store/useOnboarding";
import { useFocusTrap } from "../lib/useFocusTrap";
import { TASTE_PICKS, seedDraft, type SeedPick } from "../lib/seedShelf";
import { searchTitles } from "../lib/tmdb";
import { PosterArt } from "./PosterArt";
import { CheckIcon, ReelMark } from "./icons";

/**
 * Il primo minuto.
 *
 * Prima non esisteva. L'app si apriva su «La tua libreria è vuota» e su un
 * pulsante che portava a una casella di ricerca — una casella che, senza la
 * chiave del catalogo, non avrebbe risposto mai. Chi apriva CineMate per la
 * prima volta si trovava davanti l'unica schermata del prodotto da cui non si
 * esce, e non gli veniva detto perché.
 *
 * L'ordine delle quattro schermate è la sostanza dell'intervento, non la sua
 * confezione: **si dà valore prima di chiedere.** Prima si fa vedere com'è
 * l'app piena, poi si costruisce lo scaffale con tre tocchi, e la chiave —
 * l'unica cosa che assomigli a una configurazione — arriva per ultima, quando
 * c'è già qualcosa che se ne avvantaggia, spiegata per quello che accende e
 * non per quello che è. Ed è saltabile: chi non la vuole resta con un diario
 * che funziona tutto, invece di restare con niente.
 */

const CARD =
  "relative z-10 flex w-full flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-[var(--shadow-lg)]";

/** L'azione piena: una sola per schermata, sempre nello stesso posto. */
function Primary({
  children,
  onClick,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-sm px-4 py-3 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40"
      style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
    >
      {children}
    </button>
  );
}

/** L'uscita: sempre presente, mai in evidenza. */
function Quiet({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-sm px-4 py-2.5 text-sm font-medium text-text-muted transition-colors hover:text-text"
    >
      {children}
    </button>
  );
}

/**
 * Il muro di copertine: com'è CineMate quando è piena.
 *
 * È decorativo e lo dichiara (`aria-hidden`): non c'è niente da toccare e
 * niente da leggere, serve a rispondere con un'immagine sola alla domanda che
 * la scatola vuota lasciava aperta. Le copertine sono disegnate dal titolo —
 * nessuna immagine da scaricare, quindi il muro è pieno anche in aereo.
 */
function PosterWall() {
  const wall = useMemo(() => TASTE_PICKS.slice(0, 12), []);
  return (
    <div aria-hidden="true" className="relative h-44 overflow-hidden sm:h-52">
      <div className="flex -rotate-6 scale-125 gap-2 px-2 pt-2">
        {wall.map((pick) => (
          <div key={pick.title} className="w-[68px] shrink-0 sm:w-[84px]">
            <PosterArt item={{ title: pick.title, kind: pick.kind }} size="sm" />
          </div>
        ))}
      </div>
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(to top, var(--surface) 12%, transparent 78%)" }}
      />
    </div>
  );
}

/* ── 1. Benvenuto ─────────────────────────────────────────────────────── */

function Welcome({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  return (
    <>
      <PosterWall />
      <div className="flex flex-col gap-5 p-6 pt-1">
        <div className="flex flex-col gap-2.5">
          <span className="flex items-center gap-2 text-text-muted">
            <ReelMark size={20} />
            <span className="t-label text-text-faint">CineMate</span>
          </span>
          <h2 className="t-title text-text">Questa è CineMate con la libreria di qualcun altro.</h2>
          <p className="t-body text-text-muted">
            Tiene il diario di cosa hai visto, decide cosa guardare stasera e sa in che ordine.
            Resta su questo dispositivo. Rendila tua: un minuto.
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <Primary onClick={onNext}>Comincia</Primary>
          <Quiet onClick={onSkip}>Guardo da solo</Quiet>
        </div>
      </div>
    </>
  );
}

/* ── 2. Cosa hai visto ────────────────────────────────────────────────── */

const MIN_PICKS = 3;

function Taste({ onNext, onSkip }: { onNext: (picked: SeedPick[]) => void; onSkip: () => void }) {
  const [chosen, setChosen] = useState<Set<string>>(new Set());

  function toggle(title: string) {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  }

  const enough = chosen.size >= MIN_PICKS;

  return (
    <>
      <div className="flex flex-col gap-1.5 p-6 pb-4">
        <h2 className="t-title text-text">Tocca quelli che hai già visto.</h2>
        <p className="t-body text-text-muted">
          Bastano tre. Da qui capisco cosa proporti — e il tuo scaffale comincia da questi.
        </p>
      </div>

      <div className="max-h-[46vh] overflow-y-auto px-6">
        <ul className="grid grid-cols-3 gap-2.5 pb-2 sm:grid-cols-4">
          {TASTE_PICKS.map((pick) => {
            const on = chosen.has(pick.title);
            return (
              <li key={pick.title}>
                <button
                  type="button"
                  onClick={() => toggle(pick.title)}
                  aria-pressed={on}
                  className="relative block w-full overflow-hidden rounded-sm transition-transform"
                  style={{ transform: on ? "scale(0.94)" : undefined }}
                >
                  <PosterArt item={{ title: pick.title, kind: pick.kind }} size="sm" />
                  {on && (
                    <>
                      <span
                        aria-hidden="true"
                        className="absolute inset-0 rounded-sm"
                        style={{ background: "color-mix(in srgb, var(--accent) 34%, transparent)" }}
                      />
                      <span
                        aria-hidden="true"
                        className="absolute inset-0 rounded-sm border-2"
                        style={{ borderColor: "var(--accent)" }}
                      />
                      <span
                        aria-hidden="true"
                        className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full"
                        style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
                      >
                        <CheckIcon size={14} />
                      </span>
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-col gap-1 border-t border-border p-6 pt-4">
        {/* Il conteggio è un fatto, non un rimprovero: dice quanto manca e
            sparisce quando non manca più niente. */}
        <p aria-live="polite" className="mb-1 text-center t-caption text-text-faint">
          {enough
            ? `${chosen.size} scelt${chosen.size === 1 ? "o" : "i"} — vanno bene`
            : `Ancora ${MIN_PICKS - chosen.size} per continuare`}
        </p>
        <Primary
          disabled={!enough}
          onClick={() => onNext(TASTE_PICKS.filter((p) => chosen.has(p.title)))}
        >
          Continua
        </Primary>
        <Quiet onClick={onSkip}>Riempio da solo</Quiet>
      </div>
    </>
  );
}

/* ── 3. La chiave del catalogo ────────────────────────────────────────── */

type KeyState = "idle" | "checking" | "bad" | "good";

function Catalogue({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  const setTmdbApiKey = useSettings((s) => s.setTmdbApiKey);
  const [key, setKey] = useState("");
  const [state, setState] = useState<KeyState>("idle");
  const timer = useRef<number | null>(null);

  /*
   * La chiave si verifica mentre la si incolla.
   *
   * Il modo in cui questo andava storto prima non era «la chiave sbagliata»:
   * era scoprirlo tre schermate dopo, davanti a una ricerca muta, senza un
   * modo di collegare le due cose. Una richiesta sola e la risposta è
   * immediata — e a quel punto l'errore è ancora accanto al campo che lo ha
   * prodotto.
   */
  useEffect(() => {
    const trimmed = key.trim();
    if (timer.current) window.clearTimeout(timer.current);
    if (!trimmed) {
      setState("idle");
      return;
    }
    setState("checking");
    timer.current = window.setTimeout(async () => {
      try {
        await searchTitles("matrix", trimmed);
        setState("good");
        setTmdbApiKey(trimmed);
      } catch {
        setState("bad");
      }
    }, 500);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [key, setTmdbApiKey]);

  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="flex flex-col gap-2.5">
        <h2 className="t-title text-text">Il catalogo.</h2>
        <p className="t-body text-text-muted">
          Copertine, trame, cast e date d'uscita arrivano da <strong className="text-text">TMDB</strong>,
          un archivio aperto e gratuito. Serve una chiave tua: è gratis, ci vogliono due minuti,
          e resta su questo dispositivo.
        </p>
      </div>

      <a
        href="https://www.themoviedb.org/settings/api"
        target="_blank"
        rel="noreferrer"
        className="rounded-sm border border-border-strong px-4 py-2.5 text-center text-sm font-medium text-text transition-colors hover:bg-surface-hover"
      >
        Apri TMDB per prenderla ↗
      </a>

      <div className="flex flex-col gap-2">
        <label htmlFor="onb-key" className="t-label text-text-faint">
          Incolla qui la chiave
        </label>
        <input
          id="onb-key"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          placeholder="es. 8f2c…"
          className="w-full rounded-sm border border-border-strong bg-surface-2 px-3 py-2.5 font-mono text-sm text-text placeholder:text-text-faint focus:border-accent"
        />
        <p aria-live="polite" className="min-h-[1.25rem] t-caption">
          {state === "checking" && <span className="text-text-faint">Controllo…</span>}
          {state === "good" && (
            <span style={{ color: "var(--accent-text)" }}>Funziona. Il catalogo è acceso.</span>
          )}
          {state === "bad" && (
            <span style={{ color: "var(--danger)" }}>
              TMDB non l'ha accettata. Controlla di aver copiato la chiave per intero.
            </span>
          )}
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <Primary disabled={state !== "good"} onClick={onDone}>
          {state === "good" ? "Fatto" : "Continua"}
        </Primary>
        <Quiet onClick={onSkip}>Lo faccio dopo</Quiet>
      </div>
    </div>
  );
}

/* ── 4. Fatto ─────────────────────────────────────────────────────────── */

function Done({ added, onClose }: { added: number; onClose: () => void }) {
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  return (
    <div className="flex flex-col gap-5 p-6">
      <span
        className="flex h-12 w-12 items-center justify-center rounded-full"
        style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
      >
        <CheckIcon size={22} />
      </span>
      <div className="flex flex-col gap-2">
        <h2 className="t-title text-text">Il tuo scaffale.</h2>
        <p className="t-body text-text-muted">
          {added > 0
            ? `${added} titol${added === 1 ? "o" : "i"} in libreria.`
            : "La libreria è ancora vuota, e va bene così."}{" "}
          {tmdbApiKey
            ? "Copertine e trame stanno arrivando da sole: da qui in poi basta cercare."
            : "Senza la chiave del catalogo restano le copertine disegnate: puoi accenderlo quando vuoi dalle Impostazioni."}
        </p>
      </div>
      <Primary onClick={onClose}>Entra</Primary>
    </div>
  );
}

/* ── Il contenitore ───────────────────────────────────────────────────── */

type Step = "welcome" | "taste" | "catalogue" | "done";

/**
 * Il cancello: decide *una volta sola* se il flusso va mostrato.
 *
 * Sta separato dal flusso per due ragioni, ed entrambe erano bug veri prima
 * che lo fossero in teoria.
 *
 * La prima: la condizione «la libreria è vuota» si rivaluta a ogni render, e
 * il flusso stesso riempie la libreria alla seconda schermata. Tenendo la
 * decisione dentro il flusso, i tre titoli scelti lo facevano sparire in
 * faccia a chi li aveva appena scelti — proprio prima della schermata della
 * chiave, cioè della sola cosa che il flusso doveva ottenere. La decisione
 * si prende al primo render e non si tocca più.
 *
 * La seconda: `useFocusTrap` blocca lo scorrimento della pagina quando si
 * monta. Con i suoi hook dentro un componente sempre montato, quel blocco
 * arrivava a *tutti*, compreso chi l'onboarding non doveva nemmeno vederlo.
 * Adesso gli hook vivono nel flusso, che esiste solo mentre è a schermo.
 */
export function Onboarding() {
  const done = useOnboarding((s) => s.done);
  const replaying = useOnboarding((s) => s.replaying);

  // La libreria si carica da `localStorage` in modo sincrono, quindi al primo
  // render questo numero è già quello vero e non uno zero di passaggio.
  const [emptyAtStart] = useState(() => useLibrary.getState().items.length === 0);

  if (!replaying && (done || !emptyAtStart)) return null;
  return <OnboardingFlow />;
}

function OnboardingFlow() {
  const finish = useOnboarding((s) => s.finish);
  const addItems = useLibrary((s) => s.addItems);

  const [step, setStep] = useState<Step>("welcome");
  const [added, setAdded] = useState(0);
  const containerRef = useFocusTrap(finish);

  function keep(picked: SeedPick[]) {
    // In blocco: tre titoli sono una scelta sola, e vanno confermati una volta.
    addItems(picked.map(seedDraft));
    setAdded(picked.length);
    setStep("catalogue");
  }

  return createPortal(
    <div className="fixed inset-0 z-70 flex items-end justify-center sm:items-center sm:p-6">
      <motion.div
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
      />
      <motion.div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Primo avvio"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        className={`${CARD} max-h-[94vh] max-w-md rounded-b-none sm:rounded-b-lg`}
      >
        {/* I quattro passi, come quattro trattini. Dicono a che punto si è di
            una cosa che finisce — che è l'informazione che manca a ogni
            configurazione in cui ci si sente in trappola. */}
        <div aria-hidden="true" className="flex gap-1 px-6 pt-5">
          {(["welcome", "taste", "catalogue", "done"] as Step[]).map((s, i) => {
            const at = ["welcome", "taste", "catalogue", "done"].indexOf(step);
            return (
              <span
                key={s}
                className="h-0.5 flex-1 rounded-full transition-colors"
                style={{ background: i <= at ? "var(--accent)" : "var(--border)" }}
              />
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="flex min-h-0 flex-col"
          >
            {step === "welcome" && <Welcome onNext={() => setStep("taste")} onSkip={finish} />}
            {step === "taste" && <Taste onNext={keep} onSkip={() => setStep("catalogue")} />}
            {step === "catalogue" && (
              <Catalogue onDone={() => setStep("done")} onSkip={() => setStep("done")} />
            )}
            {step === "done" && <Done added={added} onClose={finish} />}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>,
    document.body,
  );
}
