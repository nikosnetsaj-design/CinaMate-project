import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useWebViewer } from "../store/useWebViewer";
import { usePlayerSources } from "../store/usePlayerSources";
import { useLibrary } from "../store/useLibrary";
import { withProtocol } from "../lib/linkHost";
import { hasPageReader, readableDocument } from "../lib/pageReader";
import { bestStreamConfirmed, readPage, titleLinksIn } from "../lib/streamExtract";
import type { FetchFailure, FoundLink } from "../lib/streamExtract";

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
 * ---
 *
 * **I due muri, e cosa si può fare contro ognuno.** Sono due, sono diversi, e
 * confonderli è il motivo per cui questa finestra sembrava rotta.
 *
 *   - `X-Frame-Options` / `frame-ancestors`: il sito vieta di essere messo in un
 *     riquadro. Il riquadro resta bianco e non c'è opzione che lo cambi.
 *     **Risposta:** smettere di incorniciarlo. In «Pagina letta» il viewer
 *     disegna il testo che ha letto dentro un documento suo — un divieto di
 *     incorniciare non è un divieto di leggere.
 *   - **CORS**: il sito non lascia che questa pagina ne legga il sorgente. Senza
 *     sorgente non c'è né «Pagina letta» né estrazione del flusso.
 *     **Risposta:** un lettore di pagine tuo (`lib/pageReader.ts`), che browser
 *     non è e quel muro non ce l'ha. Senza lettore configurato resta il
 *     riquadro, con i limiti di sempre — detti, non nascosti.
 *
 * La barra dell'indirizzo, infine, non insegue la navigazione: un riquadro di un
 * altro dominio non lascia leggere dove è arrivato. Dice dove l'ho mandato io.
 */

type BlockLevel = "rigido" | "normale" | "minimo";

/** Cosa c'è nel riquadro: il sito vero, o la pagina che abbiamo letto. */
type ViewMode = "sito" | "letta";

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
    // La riga sui pop-up la scrive la nota sotto i livelli, che vale per tutti
    // e tre: ripeterla qui la faceva comparire due volte di fila, con due
    // parole diverse per la stessa cosa.
    hint: "Gli script girano. È il livello in cui un player che si carica da JavaScript parte davvero — e anche quello in cui torna tutto il resto.",
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
const CHIP_ON = "border-accent text-text";
const CHIP_OFF = "border-border-strong text-text-muted hover:bg-surface-hover";

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
  // Il titolo per cui siamo qui, quando ce n'è uno: serve a riconoscere quali
  // collegamenti di una pagina di risultati sono *lui* e quali sono contorno.
  const item = useLibrary((s) => (context ? s.items.find((i) => i.id === context.itemId) : undefined));

  const [level, setLevel] = useState<BlockLevel>("rigido");
  const [mode, setMode] = useState<ViewMode>("sito");
  const [history, setHistory] = useState<string[]>([initialUrl]);
  const [draft, setDraft] = useState(initialUrl);
  const [reloadKey, setReloadKey] = useState(0);
  /** Cosa sta facendo adesso, perché due pulsanti fanno partire la stessa lettura. */
  const [busy, setBusy] = useState<null | "lettura" | "flusso">(null);
  /** Il sorgente della pagina corrente, letto una volta e riusato. */
  const [page, setPage] = useState<{ html: string; url: string } | null>(null);
  const [found, setFound] = useState<string | null>(null);
  const [links, setLinks] = useState<FoundLink[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const current = history[history.length - 1];
  const sandbox = useMemo(() => sandboxFor(level, current), [level, current]);
  const readable = useMemo(
    () => (mode === "letta" && page ? readableDocument(page.html, page.url) : null),
    [mode, page],
  );

  useEffect(() => setDraft(current), [current]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => () => abortRef.current?.abort(), []);

  /** Tutto ciò che appartiene alla pagina di prima se ne va con lei. */
  function forget() {
    abortRef.current?.abort();
    setPage(null);
    setFound(null);
    setLinks([]);
    setNotice(null);
    setBusy(null);
  }

  function go(raw: string) {
    const next = withProtocol(raw);
    try {
      if (!/^https?:$/.test(new URL(next).protocol)) return;
    } catch {
      return;
    }
    forget();
    if (next !== current) setHistory((h) => [...h, next]);
    else setReloadKey((k) => k + 1);
  }

  function back() {
    if (history.length < 2) return;
    forget();
    setHistory((h) => h.slice(0, -1));
  }

  /**
   * Perché non si è potuto leggere, e cosa si può farci. La distinzione che
   * conta è fra «non si può da un browser» — e allora la strada è il lettore —
   * e «non c'è niente da leggere», che il lettore non cambierebbe.
   */
  function explain(reason: FetchFailure): string {
    if (reason === "non-e-una-pagina") return "Quell'indirizzo non serve una pagina: è già un file.";
    if (reason === "non-raggiungibile") {
      return hasPageReader()
        ? "Nessuna risposta da quell'indirizzo, né da qui né attraverso il lettore di pagine."
        : "Nessuna risposta da quell'indirizzo.";
    }
    return hasPageReader()
      ? "Il sito non lascia che questa pagina ne legga il sorgente (CORS), e il lettore che hai configurato non ce l'ha fatta: controlla in Impostazioni che il suo indirizzo risponda e che rimandi indietro la pagina."
      : "Il sito risponde ma non lascia che questa pagina ne legga il sorgente (CORS) — è una decisione sua, e da un browser non si aggira. Serve qualcosa che browser non sia: in Impostazioni → Indirizzi delle tue sorgenti c'è «Lettore di pagine», l'indirizzo di un servizio tuo che scarica la pagina al posto del browser. Con quello, questo pulsante e «Pagina letta» funzionano.";
  }

  /** Il sorgente della pagina: quello già letto, o una lettura nuova. */
  async function sourceOfCurrent(): Promise<{ html: string; url: string } | null> {
    if (page) return page;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy("lettura");
    setNotice(null);
    const res = await readPage(current, controller.signal);
    if (controller.signal.aborted) return null;
    setBusy(null);
    if (!res.ok) {
      setNotice(explain(res.reason));
      return null;
    }
    const got = { html: res.html, url: res.finalUrl };
    setPage(got);
    // I collegamenti che somigliano al titolo cercato. Servono in «Pagina
    // letta», dove i clic dentro la pagina sono spenti: sono il modo di
    // passare dalla pagina dei risultati a quella del titolo.
    if (item) setLinks(titleLinksIn(res.html, res.finalUrl, item));
    return got;
  }

  async function showRead() {
    setMode("letta");
    if (!page) await sourceOfCurrent();
  }

  async function extract() {
    const source = await sourceOfCurrent();
    if (!source) return;
    // La conferma dei candidati senza estensione è una serie di richieste sue,
    // e va annullabile: se la pagina era già letta il controllore di quella
    // lettura non c'è più, o è già stato annullato, e ne serve uno nuovo.
    if (!abortRef.current || abortRef.current.signal.aborted) abortRef.current = new AbortController();
    const controller = abortRef.current;
    setBusy("flusso");
    setFound(null);
    const stream = await bestStreamConfirmed(source.html, source.url, controller.signal);
    if (controller.signal.aborted) return;
    setBusy(null);
    if (!stream) {
      setNotice(
        "Nel sorgente della pagina non c'è nessun indirizzo di flusso, e nemmeno un indirizzo senza estensione che si sia rivelato una playlist. Quasi sempre vuol dire che il player lo chiede dopo, da JavaScript: quello che è stato caricato dopo non sta nel sorgente e da qui non si vede.",
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

        {/* Cosa c'è nel riquadro. È la scelta che conta di più delle altre —
            un sito che rifiuta di essere incorniciato non ha nessun livello di
            blocco che lo salvi — quindi sta per prima. */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-text-faint">Mostra</span>
          <button
            type="button"
            onClick={() => setMode("sito")}
            aria-pressed={mode === "sito"}
            title="Il sito dentro un riquadro, con i permessi scelti qui sotto."
            className={`${CHIP} ${mode === "sito" ? CHIP_ON : CHIP_OFF}`}
          >
            Il sito
          </button>
          <button
            type="button"
            onClick={showRead}
            aria-pressed={mode === "letta"}
            disabled={busy === "lettura"}
            title="La pagina letta e ridisegnata qui: funziona anche con i siti che rifiutano di essere incorniciati."
            className={`${CHIP} ${mode === "letta" ? CHIP_ON : CHIP_OFF} disabled:opacity-50`}
          >
            {busy === "lettura" ? "Leggo…" : "Pagina letta"}
          </button>
          <button
            type="button"
            onClick={extract}
            disabled={busy !== null}
            className={`${CHIP} ${CHIP_OFF} disabled:opacity-50`}
          >
            {busy === "flusso" ? "Cerco il flusso…" : "Estrai il flusso"}
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
              // In «Pagina letta» il riquadro non contiene il sito ma un
              // documento nostro, e lì i permessi sono azzerati per forza:
              // vedi `readableDocument`. Restano visibili — sono la scelta
              // dell'altra modalità — ma non fingono di valere adesso.
              disabled={mode === "letta"}
              title={
                mode === "letta"
                  ? "Il livello di blocco vale per il sito dentro il riquadro. La pagina letta gira sempre a permessi zero."
                  : l.hint
              }
              className={`${CHIP} ${level === l.id ? CHIP_ON : CHIP_OFF} disabled:opacity-40`}
            >
              {l.label}
            </button>
          ))}
        </div>

        <p className="text-xs leading-relaxed text-text-faint">
          {mode === "letta" ? (
            <>
              La pagina è stata letta e ridisegnata qui: nessuno script, e i collegamenti dentro
              sono spenti — premerne uno riporterebbe il riquadro sul sito, cioè contro il divieto
              di prima.{" "}
              <span className="text-text-muted">
                Per spostarti usa la barra dell'indirizzo, o i collegamenti qui sotto quando ce ne
                sono.
              </span>
            </>
          ) : (
            <>
              {LEVELS.find((l) => l.id === level)?.hint}{" "}
              <span className="text-text-muted">
                Pop-up, finestre di sistema e cambi di pagina restano bloccati a ogni livello.
              </span>
            </>
          )}
        </p>

        {/* I collegamenti della pagina che somigliano al titolo cercato: da una
            pagina di risultati alla scheda, senza dover leggere l'elenco a
            occhio e senza clic dentro al riquadro. */}
        {links.length > 0 && (
          <div className="flex flex-col gap-1.5 rounded-sm border border-border-strong bg-surface p-2.5">
            <span className="text-xs font-medium text-text-muted">
              Collegamenti che sembrano «{context?.title}»
            </span>
            <div className="flex flex-wrap gap-1.5">
              {links.map((l) => (
                <button
                  key={l.url}
                  type="button"
                  onClick={() => go(l.url)}
                  title={l.url}
                  className={`${CHIP} ${CHIP_OFF} max-w-full truncate`}
                >
                  {l.label || l.url}
                </button>
              ))}
            </div>
          </div>
        )}

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
        {notice && (
          <p role="alert" className="text-xs leading-relaxed text-text-faint">
            {notice}
          </p>
        )}
      </motion.div>

      <div className="relative flex-1 bg-black">
        {mode === "letta" ? (
          readable ? (
            <iframe
              key={`letta:${current}#${reloadKey}`}
              srcDoc={readable}
              // Zero permessi, non negoziabile: in un `srcdoc`
              // `allow-same-origin` vorrebbe dire la *nostra* origine.
              sandbox=""
              referrerPolicy="no-referrer"
              allow=""
              title="Pagina letta"
              className="h-full w-full border-0 bg-white"
            />
          ) : (
            <p className="p-6 text-center text-xs leading-relaxed text-text-faint">
              {busy === "lettura" ? "Leggo la pagina…" : "La pagina non è stata letta."}
            </p>
          )
        ) : (
          <iframe
            key={`sito:${current}#${reloadKey}`}
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
        {mode === "letta" ? (
          <>
            Quello che vedi è il sorgente della pagina ridisegnato qui, non il sito dentro un
            riquadro: immagini e stili arrivano dal sito, ma quello che il sito avrebbe caricato con
            JavaScript non c'è — e spesso il player è proprio lì. Se manca qualcosa, prova{" "}
            <span className="text-text-muted">Il sito</span>, o ↗ per aprirlo in una scheda.
          </>
        ) : (
          <>
            Se il riquadro resta bianco, quel sito rifiuta di essere incorniciato
            (<span className="font-mono">X-Frame-Options</span>) e non c'è modo di convincerlo:
            prova <span className="text-text-muted">Pagina letta</span>, che non lo incornicia, o ↗
            per aprirlo in una scheda. La barra qui sopra dice dove l'ho mandato io, non dove sei
            arrivato cliccando dentro: un riquadro di un altro dominio non lascia leggere il proprio
            indirizzo.
          </>
        )}
      </p>
    </div>,
    document.body,
  );
}
