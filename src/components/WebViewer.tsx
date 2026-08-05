import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useWebViewer } from "../store/useWebViewer";
import { usePlayerSources } from "../store/usePlayerSources";
import { useLibrary } from "../store/useLibrary";
import { withProtocol } from "../lib/linkHost";
import { bestStreamIn, readPage } from "../lib/streamExtract";
import { buildHookedDocument, isFrameMessage } from "../lib/hookedFrame";

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

type BlockLevel = "rigido" | "normale" | "minimo" | "hookata";

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
  {
    id: "hookata",
    label: "Lettura hookata",
    hint: "La pagina viene letta e rimessa in un riquadro nostro, con uno script iniettato prima del suo: gli script del sito girano e ogni indirizzo che chiedono viene registrato, compreso il manifest che nel sorgente non c'era. Il sito gira in un'origine opaca, separata dalla nostra. Richiede che il sito mandi gli header CORS.",
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
  // Gli script sì, `allow-same-origin` no: il documento è `srcdoc`, quindi
  // erediterebbe la *nostra* origine, e il JavaScript del sito si troverebbe
  // davanti il localStorage con dentro le chiavi API. Senza quel permesso
  // l'origine è opaca e non coincide con niente. Vedi lib/hookedFrame.ts.
  hookata: ["allow-scripts"],
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

  // --- lettura hookata ------------------------------------------------------
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [hookedDoc, setHookedDoc] = useState<string | null>(null);
  const [hookedError, setHookedError] = useState<string | null>(null);
  const [seen, setSeen] = useState<string[]>([]);
  const [blocked, setBlocked] = useState(0);
  const [cleaned, setCleaned] = useState(0);

  const current = history[history.length - 1];
  const sandbox = useMemo(() => sandboxFor(level, current), [level, current]);

  useEffect(() => setDraft(current), [current]);

  // Legge la pagina e la rimette nel riquadro con lo script davanti. Solo in
  // lettura hookata: negli altri livelli il riquadro punta direttamente al
  // sito, e leggerlo non servirebbe a niente.
  useEffect(() => {
    if (level !== "hookata") {
      setHookedDoc(null);
      setHookedError(null);
      return;
    }
    const controller = new AbortController();
    setHookedDoc(null);
    setHookedError(null);
    setSeen([]);
    setBlocked(0);
    setCleaned(0);
    readPage(current, controller.signal).then((page) => {
      if (controller.signal.aborted) return;
      if (!page.ok) {
        setHookedError(
          page.reason === "bloccato-cors"
            ? "Questo sito non lascia che la pagina venga letta (CORS), quindi non si può rimettere in un riquadro nostro e lo script non si può iniettare. Usa «Minimo»: il sito gira, ma senza hook non si vede cosa chiede."
            : "Non sono riuscito a leggere questa pagina.",
        );
        return;
      }
      setHookedDoc(buildHookedDocument(page.html, page.finalUrl));
    });
    return () => controller.abort();
  }, [level, current, reloadKey]);

  // I messaggi dello script iniettato. L'origine è opaca — un documento
  // sandbox senza `allow-same-origin` si presenta come "null" — quindi non si
  // può filtrare su `event.origin`: si confronta la sorgente con la finestra
  // del nostro riquadro, che è il controllo giusto e non aggirabile.
  useEffect(() => {
    if (level !== "hookata") return;
    const onMessage = (event: MessageEvent) => {
      if (!frameRef.current || event.source !== frameRef.current.contentWindow) return;
      if (!isFrameMessage(event.data)) return;
      const msg = event.data;
      if (msg.kind === "media") setSeen((s) => (s.includes(msg.url) ? s : [...s, msg.url]));
      else if (msg.kind === "blocked" || msg.kind === "popup") setBlocked((n) => n + 1);
      else if (msg.kind === "cleaned") setCleaned(msg.count);
      else if (msg.kind === "navigation" && msg.allowed) go(msg.url);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // `go` è stabile per come è definita nel corpo del componente rimontato a
    // ogni indirizzo: vedi il `key` su ViewerFrame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  const hookedManifests = useMemo(() => seen.filter((u) => /\.m3u8?(\?|#|$)/i.test(u)), [seen]);

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

  function attachStream(url: string) {
    if (!context) return;
    patchSource(context.itemId, { manifestUrl: url });
    pushToast("success", `Flusso collegato a «${context.title}».`);
    onClose();
    navigate(`/player?titolo=${encodeURIComponent(context.itemId)}`);
  }

  function useForTitle() {
    if (!found) return;
    attachStream(found);
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

        {/*
          Cosa l'hook ha visto passare. È il risultato che questa modalità
          esiste per produrre: un manifest chiesto dal player del sito a
          runtime non sta nel sorgente, quindi l'estrazione statica non lo
          troverebbe mai — qui compare appena la pagina lo chiede.
        */}
        {level === "hookata" && (hookedManifests.length > 0 || blocked > 0 || cleaned > 0) && (
          <div className="rounded-sm border border-border-strong bg-surface p-2.5">
            <p className="mb-1.5 text-[11px] text-text-faint">
              {hookedManifests.length > 0
                ? `${hookedManifests.length} ${hookedManifests.length === 1 ? "flusso chiesto" : "flussi chiesti"} dalla pagina`
                : "Nessun flusso ancora"}
              {blocked > 0 && ` · ${blocked} richieste bloccate`}
              {cleaned > 0 && ` · ${cleaned} sovrapposizioni rimosse`}
            </p>
            <div className="flex flex-col gap-1">
              {hookedManifests.map((url) => (
                <div key={url} className="flex flex-wrap items-center gap-1.5">
                  <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-text-muted" title={url}>
                    {url}
                  </span>
                  {context && (
                    <button
                      type="button"
                      onClick={() => attachStream(url)}
                      className="rounded-sm px-2 py-0.5 text-[10px] font-semibold"
                      style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
                    >
                      Usa
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setFound(url)}
                    className="rounded-sm border border-border-strong px-2 py-0.5 text-[10px] text-text-muted hover:bg-surface-hover"
                  >
                    Mostra
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      <div className="relative flex-1 bg-black">
        {level === "hookata" ? (
          hookedDoc ? (
            <iframe
              ref={frameRef}
              key={`hook#${current}#${reloadKey}`}
              srcDoc={hookedDoc}
              sandbox={sandbox}
              referrerPolicy="no-referrer"
              allow=""
              title="Web Viewer — lettura hookata"
              className="h-full w-full border-0 bg-white"
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center">
              <p className="max-w-md text-xs leading-relaxed text-text-faint">
                {hookedError ?? "Leggo la pagina e ci metto lo script davanti…"}
              </p>
            </div>
          )
        ) : (
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
        )}
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
