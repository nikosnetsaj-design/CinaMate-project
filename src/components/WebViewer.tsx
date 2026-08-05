import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useWebViewer } from "../store/useWebViewer";
import { usePlayerSources } from "../store/usePlayerSources";
import { useLibrary } from "../store/useLibrary";
import { withProtocol } from "../lib/linkHost";
import { bestStreamIn, readPage } from "../lib/streamExtract";

/**
 * Il **Web Viewer**: una finestra su una pagina, con tutto quello che una
 * pagina può fare da sola disattivato.
 *
 * Il blocco non è una lista di domini pubblicitari da aggiornare ogni mese: è
 * l'attributo `sandbox` di un `<iframe>`, che parte da zero permessi e ne
 * restituisce solo quelli che gli si nominano. A permessi zero gli script non
 * girano, e senza script non c'è quasi niente di quello che rende quelle pagine
 * insopportabili — gli overlay, i pop-under, il redirect al terzo clic, il
 * contatore che apre una scheda nuova. Sono cose fatte in JavaScript, tutte.
 *
 * Tre permessi non si concedono mai, a nessun livello:
 * `allow-popups` (la scheda che si apre da sola), `allow-top-navigation` (la
 * pagina che si porta via l'app) e `allow-modals` (l'`alert` che blocca tutto).
 * Sono esattamente i tre comportamenti che il viewer esiste per togliere, e
 * renderli opzionali avrebbe voluto dire scrivere un interruttore per
 * riaccendere il problema.
 *
 * Due cose che il viewer *non* può fare, dette qui perché l'interfaccia le dice
 * all'utente:
 *
 *   - **Molti siti rifiutano di essere incorniciati.** `X-Frame-Options: DENY` o
 *     `Content-Security-Policy: frame-ancestors` e il riquadro resta bianco. Non
 *     c'è modo di aggirarlo da una pagina web, e nemmeno di accorgersene con
 *     certezza: il riquadro rifiutato emette `load` come un altro. Quindi la
 *     nota è sempre visibile, invece di comparire quando è troppo tardi.
 *   - **La barra dell'indirizzo non insegue la navigazione.** Un riquadro di un
 *     altro dominio non lascia leggere dove è arrivato. La barra dice dove l'ho
 *     mandato io; se ci hai cliccato dentro, il riquadro è più avanti di lei.
 */

type BlockLevel = "rigido" | "normale" | "minimo";

const LEVELS: { id: BlockLevel; label: string; hint: string }[] = [
  {
    id: "rigido",
    label: "Rigido",
    hint: "Nessuno script, nessun modulo, nessun cookie di sessione. I collegamenti funzionano, il resto no. È il livello in cui quei siti diventano leggibili.",
  },
  {
    id: "normale",
    label: "Normale",
    hint: "Come sopra, ma i moduli si possono inviare e il sito si ricorda di te fra una pagina e l'altra. Serve quando la ricerca del sito è un modulo invece che un indirizzo.",
  },
  {
    id: "minimo",
    label: "Minimo",
    hint: "Gli script girano. È il livello in cui un player che si carica da JavaScript parte davvero — e anche quello in cui torna tutto il resto. Pop-up e cambi di pagina restano bloccati comunque.",
  },
];

/**
 * I permessi concessi per livello. `allow-popups`, `allow-top-navigation` e
 * `allow-modals` non compaiono in nessuna riga, di proposito.
 */
const SANDBOX: Record<BlockLevel, string[]> = {
  rigido: [],
  normale: ["allow-forms", "allow-same-origin"],
  minimo: ["allow-scripts", "allow-forms", "allow-same-origin"],
};

/**
 * `allow-scripts` e `allow-same-origin` insieme annullano la sandbox quando il
 * riquadro ha la *nostra* origine: da lì lo script può risalire al documento
 * che lo contiene e togliersi l'attributo da solo. Su un sito di terzi non
 * succede — origini diverse, nessun accesso — ma un indirizzo di questa stessa
 * app scritto nella barra sarebbe il caso in cui succede, quindi lì
 * `allow-same-origin` si toglie invece di fidarsi.
 */
function sandboxFor(level: BlockLevel, url: string): string {
  const tokens = SANDBOX[level];
  let sameOrigin = false;
  try {
    sameOrigin = new URL(url).origin === window.location.origin;
  } catch {
    sameOrigin = false;
  }
  return (sameOrigin ? tokens.filter((t) => t !== "allow-same-origin") : tokens).join(" ");
}

const CHIP = "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors";

export function WebViewer() {
  const url = useWebViewer((s) => s.url);
  const context = useWebViewer((s) => s.context);
  const close = useWebViewer((s) => s.close);

  if (!url) return null;
  // Rimontato a ogni indirizzo: la cronologia interna, il livello di blocco e
  // l'esito dell'estrazione appartengono alla sessione di navigazione, e
  // trascinarli su una pagina diversa vorrebbe dire mostrare il flusso di prima
  // accanto alla pagina di adesso.
  return <ViewerFrame key={url} initialUrl={url} context={context} onClose={close} />;
}

function ViewerFrame({
  initialUrl,
  context,
  onClose,
}: {
  initialUrl: string;
  context: { itemId: string; title: string } | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const pushToast = useLibrary((s) => s.pushToast);
  const patchSource = usePlayerSources((s) => s.patch);

  const [level, setLevel] = useState<BlockLevel>("rigido");
  const [history, setHistory] = useState<string[]>([initialUrl]);
  const [draft, setDraft] = useState(initialUrl);
  const [reloadKey, setReloadKey] = useState(0);
  const [extracting, setExtracting] = useState(false);
  const [found, setFound] = useState<string | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const current = history[history.length - 1];
  const sandbox = useMemo(() => sandboxFor(level, current), [level, current]);

  useEffect(() => setDraft(current), [current]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => () => abortRef.current?.abort(), []);

  function go(raw: string) {
    const next = withProtocol(raw);
    try {
      if (!/^https?:$/.test(new URL(next).protocol)) return;
    } catch {
      return;
    }
    setFound(null);
    setExtractError(null);
    if (next !== current) setHistory((h) => [...h, next]);
    else setReloadKey((k) => k + 1);
  }

  function back() {
    if (history.length < 2) return;
    setFound(null);
    setExtractError(null);
    setHistory((h) => h.slice(0, -1));
  }

  async function extract() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setExtracting(true);
    setFound(null);
    setExtractError(null);
    const page = await readPage(current, controller.signal);
    setExtracting(false);
    if (controller.signal.aborted) return;

    if (!page.ok) {
      setExtractError(
        page.reason === "bloccato-cors"
          ? "Il sito risponde ma non lascia che questa pagina ne legga il sorgente (CORS). Il riquadro qui sotto lo mostra lo stesso — è il browser a mostrarlo, non io a leggerlo — ma l'indirizzo del flusso da qui non si può isolare."
          : page.reason === "non-e-una-pagina"
            ? "Quell'indirizzo non serve una pagina: è già un file."
            : "Nessuna risposta da quell'indirizzo.",
      );
      return;
    }
    const stream = bestStreamIn(page.html, page.finalUrl);
    if (!stream) {
      setExtractError(
        "Nel sorgente della pagina non c'è nessun indirizzo di flusso. Quasi sempre vuol dire che il player lo chiede dopo, da JavaScript: quello che è stato caricato dopo non sta nel sorgente e da qui non si vede.",
      );
      return;
    }
    setFound(stream.url);
  }

  function useForTitle() {
    if (!found || !context) return;
    patchSource(context.itemId, { manifestUrl: found });
    pushToast("success", `Flusso collegato a «${context.title}».`);
    onClose();
    navigate(`/player?titolo=${encodeURIComponent(context.itemId)}`);
  }

  async function copyFound() {
    if (!found) return;
    try {
      await navigator.clipboard.writeText(found);
      pushToast("success", "Indirizzo copiato.");
    } catch {
      pushToast("error", "Il browser non ha concesso gli appunti.");
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-80 flex flex-col bg-surface">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-2.5 border-b border-border bg-surface-2 p-3"
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={back}
            disabled={history.length < 2}
            aria-label="Indietro"
            className="rounded-sm border border-border-strong px-2.5 py-1.5 text-xs text-text-muted disabled:opacity-40"
          >
            ←
          </button>
          <form
            className="flex flex-1 gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              go(draft);
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              inputMode="url"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-label="Indirizzo"
              className="min-w-0 flex-1 rounded-sm border border-border-strong bg-surface px-3 py-1.5 font-mono text-xs text-text focus:border-accent"
            />
            <button
              type="submit"
              className="rounded-sm px-3 py-1.5 text-xs font-semibold"
              style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
            >
              Vai
            </button>
          </form>
          <a
            href={current}
            target="_blank"
            rel="noopener noreferrer nofollow"
            title="Apri in una scheda del browser"
            className="rounded-sm border border-border-strong px-2.5 py-1.5 text-xs text-text-muted hover:bg-surface-hover"
          >
            ↗
          </a>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi il Web Viewer"
            className="rounded-sm border border-border-strong px-2.5 py-1.5 text-xs text-text-muted hover:bg-surface-hover"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-text-faint">Blocco</span>
          {LEVELS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setLevel(l.id)}
              aria-pressed={level === l.id}
              title={l.hint}
              className={`${CHIP} ${
                level === l.id
                  ? "border-accent text-text"
                  : "border-border-strong text-text-muted hover:bg-surface-hover"
              }`}
            >
              {l.label}
            </button>
          ))}
          <button
            type="button"
            onClick={extract}
            disabled={extracting}
            className={`${CHIP} border-border-strong text-text-muted hover:bg-surface-hover disabled:opacity-50`}
          >
            {extracting ? "Cerco il flusso…" : "Estrai il flusso"}
          </button>
        </div>

        <p className="text-xs leading-relaxed text-text-faint">
          {LEVELS.find((l) => l.id === level)?.hint}{" "}
          <span className="text-text-muted">
            Pop-up, finestre di sistema e cambi di pagina restano bloccati a ogni livello.
          </span>
        </p>

        {found && (
          <div className="flex flex-wrap items-center gap-2 rounded-sm border border-border-strong bg-surface p-2.5">
            <span className="min-w-0 flex-1 break-all font-mono text-[11px] text-text-muted">{found}</span>
            {context && (
              <button
                type="button"
                onClick={useForTitle}
                className="rounded-sm px-3 py-1.5 text-xs font-semibold"
                style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
              >
                Usa per «{context.title}»
              </button>
            )}
            <button
              type="button"
              onClick={copyFound}
              className="rounded-sm border border-border-strong px-3 py-1.5 text-xs text-text-muted hover:bg-surface-hover"
            >
              Copia
            </button>
          </div>
        )}
        {extractError && (
          <p role="alert" className="text-xs leading-relaxed text-text-faint">
            {extractError}
          </p>
        )}
      </motion.div>

      <div className="relative flex-1 bg-black">
        <iframe
          key={`${current}#${reloadKey}`}
          src={current}
          sandbox={sandbox}
          referrerPolicy="no-referrer"
          // Nessuna funzionalità del dispositivo: né fotocamera, né microfono,
          // né posizione, né riproduzione automatica.
          allow=""
          title="Web Viewer"
          className="h-full w-full border-0 bg-white"
        />
      </div>

      <p className="border-t border-border bg-surface-2 px-3 py-2 text-[11px] leading-relaxed text-text-faint">
        Se il riquadro resta bianco, quel sito rifiuta di essere incorniciato
        (<span className="font-mono">X-Frame-Options</span>) e non c'è modo di convincerlo da qui:
        usa ↗ per aprirlo in una scheda. La barra qui sopra dice dove l'ho mandato io, non dove sei
        arrivato cliccando dentro: un riquadro di un altro dominio non lascia leggere il proprio
        indirizzo.
      </p>
    </div>,
    document.body,
  );
}
