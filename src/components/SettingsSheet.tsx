import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Sheet } from "./Sheet";
import { useSettingsSheet } from "../store/useSettingsSheet";
import { useSettings, MODELS } from "../store/useSettings";
import { useLibrary } from "../store/useLibrary";
import { useSagas } from "../store/useSagas";
import { useMarathon } from "../store/useMarathon";
import { useReminders } from "../store/useReminders";
import { usePlayerSources } from "../store/usePlayerSources";
import { usePlayerPrefs } from "../store/usePlayerPrefs";
import { useGoals } from "../store/useGoals";
import { useLists } from "../store/useLists";
import { useTheme } from "../store/useTheme";
import { useTvMode, type TvPreference } from "../store/useTvMode";
import { useHomeLayout, HOME_SECTIONS, MAX_ROWS } from "../store/useHomeLayout";
import { useOnboarding } from "../store/useOnboarding";
import { ACCENTS } from "../lib/accents";
import { ParentalSettings } from "./ParentalSettings";
import { LinkHostSettings } from "./LinkHostSettings";
import { DnsGuideButton } from "./DnsGuide";
import { useLinkHosts } from "../store/useLinkHosts";
import { TEMPLATE_FIELDS, previewTemplate, previewCount } from "../lib/sourceTemplate";
import { makeReaderSecret, readerAddress, readerTemplateFor } from "../lib/pageReader";
import { getHosts, restoreHosts } from "../player/services/hostStore";
import { getDailySeconds, restoreDailySeconds } from "../player/services/statsAndHistory";
import { useWatchProgress } from "../store/useWatchProgress";
import { buildBackup, parseBackup, BackupParseError } from "../lib/backup";
import { localDay } from "../lib/day";
import { downloadFile } from "../lib/download";
import { resetAutoLinkAttempts } from "../lib/useAutoLinkTmdb";
import { BackIcon, BookIcon, CheckIcon, ChevronDownIcon, ChevronRightIcon, ChevronUpIcon, CompassIcon, DownloadIcon, HomeIcon, InfoIcon, PersonIcon, PlayIcon, PulseIcon, RefreshIcon, SparkleIcon, StackIcon, SunIcon, TrashIcon, UploadIcon } from "./icons";

/**
 * Where your own sources live, written once instead of pasted per title.
 *
 * Three slots because they double as a fallback chain: the player builds an
 * address for the title out of each one and tries them in order, so the second
 * and third are what it falls back to when the first host doesn't answer.
 *
 * The bare address is the important case. Asking for a pattern asks you to know
 * how your own server spells filenames; pasting the server on its own and
 * letting the app work the rest out is what most people actually want, so the
 * field takes either and the preview says what it will do with what you typed.
 */
/**
 * Theme and accent. The palette is a fixed set rather than a colour picker for
 * the reason spelled out in lib/accents: a free hex silently breaks the AA
 * contrast promise the whole design system rests on, and nobody notices until
 * a button becomes unreadable.
 */
function AppearanceSettings() {
  const theme = useTheme((s) => s.theme);
  const toggleTheme = useTheme((s) => s.toggle);
  const accent = useTheme((s) => s.accent);
  const setAccent = useTheme((s) => s.setAccent);

  const current = ACCENTS.find((option) => option.id === accent);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <span className="mb-3 block text-base font-semibold text-text">Tema</span>
        <div className="segmented segmented-full" role="radiogroup" aria-label="Tema">
          {(["dark", "light"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={theme === value}
              onClick={() => {
                if (theme !== value) toggleTheme();
              }}
            >
              {value === "dark" ? "Scuro" : "Chiaro"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <span className="text-base font-semibold text-text">Colore d'accento</span>
          {current && <span className="text-sm text-text-muted">{current.name}</span>}
        </div>
        {/* La tinta scelta ha un anello staccato dal bordo, come su iOS: si
            vede su ogni colore, chiaro o scuro, senza toccarne il riempimento. */}
        <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Colore d'accento">
          {ACCENTS.map((option) => {
            const swatch = option[theme].accent;
            const active = accent === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={option.name}
                title={option.name}
                onClick={() => setAccent(option.id)}
                className="h-10 w-10 rounded-full transition-transform duration-200 active:scale-95"
                style={{
                  background: swatch,
                  boxShadow: active ? "0 0 0 2px var(--surface), 0 0 0 4px var(--text)" : undefined,
                }}
              />
            );
          })}
        </div>
        <p className="mt-3 text-sm text-text-muted">
          Sette tinte, ognuna con la sua variante chiara e scura: sono scelte perché restino leggibili
          su entrambi i temi, cosa che un colore qualsiasi preso da una ruota non garantisce.
        </p>
      </div>
    </div>
  );
}

/**
 * L'interruttore della modalità televisore.
 *
 * Sta accanto all'aspetto e non fra le funzioni avanzate perché è esattamente
 * quello: un modo di mostrare l'app. Il riconoscimento automatico si dichiara
 * invece di restare nascosto — sapere che l'app *crede* di essere su un
 * televisore è la prima cosa utile quando si comporta in modo inatteso.
 */
function TvSettings() {
  const preference = useTvMode((s) => s.preference);
  const detected = useTvMode((s) => s.detected);
  const setPreference = useTvMode((s) => s.setPreference);
  const active = useTvMode((s) => s.active);

  const options: { id: TvPreference; label: string }[] = [
    { id: "auto", label: "Automatica" },
    { id: "on", label: "Sempre" },
    { id: "off", label: "Mai" },
  ];

  return (
    <div>
      <span className="mb-3 block text-base font-semibold text-text">Modalità televisore</span>
      <div className="segmented segmented-full mb-3" role="radiogroup" aria-label="Modalità televisore">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={preference === option.id}
            onClick={() => setPreference(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="text-sm text-text-muted">
        Con la modalità attiva le frecce spostano il fuoco fra le copertine invece di scorrere la
        pagina, il bordo di selezione diventa spesso e tutto si ingrandisce per essere letto da
        lontano — quello che serve per usare l'app col telecomando su una TV, un Fire TV o un
        Chromecast. Nel player le frecce restano quelle di sempre: avanti, indietro e volume.{" "}
        {detected
          ? "Su questo apparecchio il riconoscimento dice: televisore."
          : "Su questo apparecchio il riconoscimento non vede un televisore."}{" "}
        {active ? "Ora è attiva." : "Ora è spenta."}
      </p>
    </div>
  );
}

/** Which rows the Home page shows, and in what order. */
function HomeLayoutSettings() {
  const order = useHomeLayout((s) => s.order);
  const hidden = useHomeLayout((s) => s.hidden);
  const toggle = useHomeLayout((s) => s.toggle);
  const move = useHomeLayout((s) => s.move);
  const reset = useHomeLayout((s) => s.reset);

  const shown = order.filter((id) => !hidden.includes(id)).length;
  const full = shown >= MAX_ROWS;

  const byId = new Map(HOME_SECTIONS.map((s) => [s.id, s]));

  return (
    <div>
      <span className="mb-1 block text-base font-semibold text-text">Righe della Home</span>
      <p className="mb-3 text-sm text-text-muted">
        Cosa vedi appena apri l'app, e in che ordine. Una riga spenta non sparisce dai dati: resta
        dove è sempre stata, semplicemente non occupa la prima schermata.
      </p>
      {/*
       * Il tetto, detto invece che subìto.
       *
       * «Massimo 6 righe» era la regola dichiarata due volte nella
       * documentazione e applicata in nessun punto del codice. Adesso è una
       * costante vera — e questa riga è la parte che la rende una funzione
       * invece di un limite: dice quante ne hai accese, e quando sono sei
       * dice che per accenderne un'altra bisogna spegnerne una. È la
       * decisione che la regola voleva far prendere.
       */}
      <p className="mb-3 text-sm" style={{ color: full ? "var(--accent-text)" : "var(--text-muted)" }}>
        <span className="t-numeral">
          {shown} di {MAX_ROWS}
        </span>{" "}
        righe accese.{" "}
        {full ? "È il massimo: per accenderne una, spegnine un'altra." : "Una Home corta è una Home che si legge."}
      </p>

      {/* Un elenco raggruppato: le frecce a sinistra spostano, l'interruttore
          a destra accende. Prima erano due triangoli di testo e un bottone che
          diceva «Mostra» quando la riga era già visibile. */}
      <ul className="list-group bg-surface-2 shadow-none" style={{ "--row-inset": "60px" } as React.CSSProperties}>
        {order.map((id, index) => {
          const section = byId.get(id);
          if (!section) return null;
          const visible = !hidden.includes(id);
          return (
            <li key={id}>
              <div className="list-row min-h-16 gap-2 py-2.5 pl-1.5">
                <div className="flex shrink-0 flex-col">
                  <button
                    type="button"
                    onClick={() => move(id, -1)}
                    disabled={index === 0}
                    aria-label={`Sposta ${section.label} in alto`}
                    className="flex h-6 w-10 items-center justify-center rounded-xs text-text-muted transition-colors hover:text-text disabled:opacity-25"
                  >
                    <ChevronUpIcon size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(id, 1)}
                    disabled={index === order.length - 1}
                    aria-label={`Sposta ${section.label} in basso`}
                    className="flex h-6 w-10 items-center justify-center rounded-xs text-text-muted transition-colors hover:text-text disabled:opacity-25"
                  >
                    <ChevronDownIcon size={16} />
                  </button>
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-medium ${visible ? "text-text" : "text-text-muted"}`}>{section.label}</p>
                  <p className="truncate text-xs text-text-muted">{section.description}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  onClick={() => toggle(id)}
                  aria-checked={visible}
                  // Spegnere è sempre possibile; accendere solo se c'è posto.
                  disabled={!visible && full}
                  aria-label={`${section.label} in Home`}
                  className="switch"
                />
              </div>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={reset}
        className="btn btn-plain btn-sm mt-3 -ml-3"
      >
        Torna all'ordine predefinito
      </button>
    </div>
  );
}

function SourceTemplates() {
  const templates = usePlayerPrefs((s) => s.sourceTemplates);
  const setTemplate = usePlayerPrefs((s) => s.setTemplate);
  const [showHelp, setShowHelp] = useState(false);

  return (
    <div>
      <span className="mb-1 block text-base font-semibold text-text">
        Indirizzi delle tue sorgenti
      </span>
      <p className="mb-3 text-sm text-text-muted">
        Se i tuoi video stanno tutti sullo stesso server, scrivilo qui una volta sola: da quel
        momento ogni titolo della libreria ha il suo pulsante{" "}
        <strong className="font-medium text-text-muted">Guarda</strong>, senza incollare più niente.
        Basta l'indirizzo nudo — <span className="font-mono">https://mio-server.com</span> — e il
        file lo cerca lui: prova i nomi soliti per quel titolo e, se non li trova, legge la cartella
        e cerca il nome che gli somiglia. Se invece sai già com'è fatto l'indirizzo, scrivilo con un
        segnaposto al posto del titolo ed è quello esatto. Le tre caselle si provano in ordine, e
        con loro gli host del pannello Host nel player.
      </p>

      <div className="flex flex-col gap-2">
        {templates.map((value, i) => {
          const preview = previewTemplate(value);
          const others = Math.max(previewCount(value) - 1, 0);
          return (
            <div key={i}>
              <input
                value={value}
                // Written through on every keystroke rather than on blur: a
                // field that only commits when it loses focus loses whatever
                // you typed last if you close the sheet straight after — which
                // is exactly what you do after filling in the last address.
                onChange={(e) => setTemplate(i, e.target.value)}
                inputMode="url"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                aria-label={`Indirizzo ${i + 1}`}
                placeholder={i === 0 ? "https://mio-server.com" : `Indirizzo ${i + 1} (facoltativo)`}
                className="field w-full font-mono"
              />
              {preview && (
                <p className="mt-1.5 break-all px-1 font-mono text-xs leading-relaxed text-text-muted">
                  Per «Il Padrino» prova {preview}
                  {others > 0 && (
                    <span className="font-sans"> e altri {others} indirizzi, finché uno risponde</span>
                  )}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setShowHelp((v) => !v)}
        aria-expanded={showHelp}
        className="btn btn-secondary btn-sm mt-2"
      >
        {showHelp ? "Nascondi i segnaposto" : "Quali segnaposto posso usare?"}
      </button>

      {showHelp && (
        <dl className="mt-3 flex flex-col gap-2 rounded-md bg-surface-2 p-4">
          {TEMPLATE_FIELDS.map((f) => (
            <div key={f.token} className="flex flex-wrap items-baseline gap-x-2">
              <dt className="font-mono text-xs text-accent-text">{f.token}</dt>
              <dd className="flex-1 text-sm text-text-muted">
                {f.label} <span className="font-mono">({f.example})</span>
              </dd>
            </div>
          ))}
          <p className="mt-1 text-sm text-text-muted">
            I segnaposto vengono riempiti con i dati del titolo, e il player chiede quell'indirizzo
            sul server che hai indicato.
          </p>
        </dl>
      )}
    </div>
  );
}

/**
 * Il lettore di pagine.
 *
 * Sta qui accanto agli indirizzi delle sorgenti perché risponde alla stessa
 * domanda — dove vanno a prendere i dati questi pulsanti — ma da un lato
 * diverso: gli indirizzi dicono *dove* leggere, questo dice *chi* legge quando
 * il browser non può. Il perché per esteso sta in `lib/pageReader.ts`.
 */
/**
 * Il Worker da incollare, per chi un lettore non ce l'ha.
 *
 * Sta qui dentro e non solo in `docs/` perché il momento in cui serve è
 * *questo*: la casella vuota davanti. Mandare a leggere un file su GitHub da un
 * telefono, mentre stai cercando di far partire un film, è il modo migliore per
 * non farlo fare a nessuno.
 *
 * La riga sullo `User-Agent` è la risposta alla domanda che si fanno tutti —
 * «non ci si può fingere un browser normale?». Da una pagina web no,
 * `User-Agent` è un forbidden header; da qui sì, ed è il posto in cui quella
 * idea funziona davvero.
 */
const workerSnippet = (secret: string) => `export default {
  async fetch(request) {
    const url = new URL(request.url);

    // La parola segreta è già dentro: non toccarla. Impedisce a chi
    // trova il tuo indirizzo di usarlo come proxy a spese tue.
    const SEGRETO = "${secret}";
    if (url.searchParams.get("k") !== SEGRETO) {
      return new Response("no", { status: 403 });
    }

    const target = url.searchParams.get("u");
    if (!target) return new Response("manca u", { status: 400 });

    let dest;
    try {
      dest = new URL(target);
      if (!/^https?:$/.test(dest.protocol)) throw new Error();
    } catch {
      return new Response("indirizzo non valido", { status: 400 });
    }

    const risposta = await fetch(dest.toString(), {
      redirect: "follow",
      headers: {
        // Qui lo User-Agent si può scrivere: da una pagina web no.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Accept-Language": "it-IT,it;q=0.9,en;q=0.8",
      },
    });

    return new Response(risposta.body, {
      status: risposta.status,
      headers: {
        "content-type":
          risposta.headers.get("content-type") ?? "text/html; charset=utf-8",
        "access-control-allow-origin": "*",
        "cache-control": "no-store",
      },
    });
  },
};`;

function PageReaderSetting() {
  const pageReader = useSettings((s) => s.pageReader);
  const setPageReader = useSettings((s) => s.setPageReader);
  const readerSecret = useSettings((s) => s.readerSecret);
  const setReaderSecret = useSettings((s) => s.setReaderSecret);
  const pushToast = useLibrary((s) => s.pushToast);
  const [showHelp, setShowHelp] = useState(false);
  const [showRecipe, setShowRecipe] = useState(false);
  const [workerAddress, setWorkerAddress] = useState("");
  const preview = readerAddress(pageReader, "https://sito.tld/film/esempio");

  // La parola segreta si genera alla prima apertura della ricetta e poi resta:
  // deve essere la stessa nel codice incollato su Cloudflare e nell'indirizzo
  // scritto qui, o il lettore risponde «no» a tutto senza spiegare perché.
  const secret = readerSecret || "";
  function openRecipe() {
    if (!readerSecret) setReaderSecret(makeReaderSecret());
    setShowRecipe((v) => !v);
  }

  const snippet = workerSnippet(secret || "genera-aprendo-la-ricetta");

  async function copyWorker() {
    try {
      await navigator.clipboard.writeText(snippet);
      pushToast("success", "Codice copiato: incollalo nell'editor del Worker.");
    } catch {
      pushToast("error", "Il browser non ha concesso gli appunti.");
    }
  }

  /** Dall'indirizzo che dà Cloudflare al modello completo, senza scriverlo. */
  function applyWorkerAddress(raw: string) {
    setWorkerAddress(raw);
    const template = readerTemplateFor(raw, secret);
    if (template) setPageReader(template);
  }

  return (
    <div>
      <span className="mb-1 block text-base font-semibold text-text">
        Lettore di pagine
      </span>
      <p className="mb-3 text-sm text-text-muted">
        «Estrai il flusso» e la ricerca sui Siti devono leggere il sorgente di una pagina, e un
        browser può leggere solo i siti che glielo permettono con un header (
        <span className="font-mono">CORS</span>): i siti di streaming non lo mandano mai, e da lì non
        si passa — non è un'opzione da accendere, è come è fatto il web. Ciò che può leggerli è
        qualcosa che browser non è: un servizio tuo che scarica la pagina e te la ripassa. Venti
        righe di Cloudflare Worker, o un <span className="font-mono">cors-anywhere</span> in casa.
        Scrivi qui il suo indirizzo e i due pulsanti smettono di sbattere contro il muro.
      </p>
      <input
        value={pageReader}
        onChange={(e) => setPageReader(e.target.value)}
        inputMode="url"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-label="Indirizzo del lettore di pagine"
        placeholder="https://mio-lettore.dev/?u={url}"
        className="field w-full font-mono"
      />
      {pageReader.trim() && (
        <p className="mt-1.5 break-all px-1 font-mono text-xs leading-relaxed text-text-muted">
          {preview ? `Per una pagina chiederà ${preview}` : "Quell'indirizzo non è utilizzabile."}
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setShowHelp((v) => !v)}
          aria-expanded={showHelp}
          className="btn btn-secondary btn-sm"
        >
          {showHelp ? "Nascondi le forme accettate" : "Come si scrive l'indirizzo?"}
        </button>
        <button
          type="button"
          onClick={openRecipe}
          aria-expanded={showRecipe}
          className="btn btn-secondary btn-sm"
        >
          {showRecipe ? "Nascondi la ricetta" : "Non ne ho uno: come me lo faccio?"}
        </button>
      </div>

      {showRecipe && (
        <div className="mt-2 flex flex-col gap-2 rounded-md bg-surface-2 p-4 text-sm text-text-muted">
          <p className="text-text-muted">
            Due cose da incollare, niente da scrivere. Un Cloudflare Worker: piano gratuito,
            nessuna carta, niente da tenere acceso.
          </p>

          <p className="font-medium text-text">
            1. Su <span className="font-mono">dash.cloudflare.com</span> → Workers &amp; Pages →
            Create → Start with Hello World → Deploy. Poi «Edit code», cancella tutto e incolla
            questo:
          </p>
          <pre className="max-h-52 overflow-auto rounded-sm bg-surface p-3 font-mono text-xs leading-relaxed text-text-muted">
            {snippet}
          </pre>
          <button
            type="button"
            onClick={copyWorker}
            className="btn btn-primary btn-sm self-start"
          >
            Copia il codice
          </button>
          <p>
            La parola segreta è già dentro, diversa per ogni dispositivo: non c'è niente da
            cambiare. Premi <span className="text-text-muted">Deploy</span>.
          </p>

          <p className="mt-1 font-medium text-text">
            2. Cloudflare ti dà un indirizzo. Incollalo qui e la casella qui sopra si compila da
            sola:
          </p>
          <input
            value={workerAddress}
            onChange={(e) => applyWorkerAddress(e.target.value)}
            inputMode="url"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-label="L'indirizzo che ti ha dato Cloudflare"
            placeholder="qualcosa.tuonome.workers.dev"
            className="field w-full font-mono"
          />
          {workerAddress.trim() && (
            <p className={readerTemplateFor(workerAddress, secret) ? "text-text-muted" : "text-text-faint"}>
              {readerTemplateFor(workerAddress, secret)
                ? "Fatto: il lettore è configurato. Provalo con «Estrai il flusso» nel Web Viewer."
                : "Quell'indirizzo non si capisce: dovrebbe somigliare a qualcosa.tuonome.workers.dev"}
            </p>
          )}

          <p className="pt-3 shadow-[inset_0_1px_0_var(--separator)]">
            La riga sullo <span className="font-mono">User-Agent</span> è il punto in cui «fingersi
            un browser normale» funziona davvero: da una pagina web quell'header non si può
            toccare, da un Worker sì — ed è ciò che molti siti guardano per decidere cosa servire.
            La parola segreta non è decorativa: senza, chiunque trovi l'indirizzo ha un proxy
            aperto a spese tue.
          </p>
        </div>
      )}

      {showHelp && (
        <div className="mt-2 flex flex-col gap-1.5 rounded-md bg-surface-2 p-4 text-sm text-text-muted">
          <p>
            <span className="font-mono text-text">{"{url}"}</span> è l'indirizzo da leggere,
            codificato: la forma giusta per chi lo mette in un parametro —{" "}
            <span className="font-mono">https://mio-lettore.dev/?u={"{url}"}</span>.
          </p>
          <p>
            <span className="font-mono text-text">{"{url-nudo}"}</span> è lo stesso indirizzo
            lasciato intero, per chi lo vuole come coda del percorso.
          </p>
          <p>
            Senza segnaposto l'indirizzo si attacca in fondo così com'è —{" "}
            <span className="font-mono">https://mio-lettore.casa/</span> — che è come funziona{" "}
            <span className="font-mono">cors-anywhere</span> e quasi tutto ciò che gli somiglia.
          </p>
          <p className="pt-3 text-text-muted shadow-[inset_0_1px_0_var(--separator)]">
            Da sapere prima di scriverlo: il lettore vede ogni indirizzo che gli passi. Uno tuo
            resta una cosa fra te e il tuo server; uno pubblico di terzi è una persona in mezzo che
            legge la tua navigazione. CineMate non ne propone nessuno apposta.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Impostazioni a due livelli: un indice di righe raggruppate, e una schermata
 * per volta.
 *
 * Era una colonna sola, lunga tredici sezioni: per cambiare accento si passava
 * davanti a due chiavi API, ai modelli di indirizzo e al controllo genitori. Un
 * indice non toglie niente — le sezioni sono le stesse — ma rende vero il fatto
 * che sono cose diverse, e fa entrare ognuna in una schermata che si legge
 * tutta senza scorrere.
 */
type PanelId = "chiavi" | "sorgenti" | "linkhost" | "aspetto" | "home" | "tv" | "genitori" | "dati" | "info";

const PANEL_TITLES: Record<PanelId, string> = {
  chiavi: "Chiavi e modello",
  sorgenti: "Indirizzi delle tue sorgenti",
  linkhost: "Gestisci Link Host",
  aspetto: "Aspetto",
  home: "Home su misura",
  tv: "Televisore",
  genitori: "Controllo genitori",
  dati: "Dati e backup",
  info: "Informazioni",
};

function SettingsRow({
  icon,
  title,
  subtitle,
  onClick,
  to,
  onNavigate,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  onClick?: () => void;
  to?: string;
  onNavigate?: () => void;
}) {
  // Le icone in grigio: sono un indice, non sette inviti. L'accento resta
  // per l'azione che conta nella schermata, quando c'è.
  const body = (
    <>
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-text-muted">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-text">{title}</span>
        <span className="mt-0.5 block text-xs text-text-muted">{subtitle}</span>
      </span>
      <span aria-hidden="true" className="mt-0.5 shrink-0 text-text-faint">
        <ChevronRightIcon size={16} />
      </span>
    </>
  );
  const className = "list-row items-start hover:bg-surface-hover active:bg-surface-hover";
  return to ? (
    <Link to={to} onClick={onNavigate} className={className}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={className}>
      {body}
    </button>
  );
}

function SettingsGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 px-4 text-sm font-medium text-text-muted">{label}</h3>
      {/* Sul foglio, che è già una superficie, il gruppo è un gradino sotto:
          niente ombra, un tono in più. */}
      <div className="list-group bg-surface-2 shadow-none" style={{ "--row-inset": "48px" } as React.CSSProperties}>
        {children}
      </div>
    </section>
  );
}

/**
 * Cosa c'è dentro l'app, e le promesse che vale la pena scrivere una volta.
 *
 * Le attribuzioni non sono un adempimento nascosto in fondo a un file di
 * licenza: TMDB chiede di dichiarare che il prodotto usa la sua API senza
 * esserne approvato, e chi guarda ha diritto di sapere con chi parla il suo
 * browser. Stanno qui perché qui le si cerca.
 */
function AboutPanel() {
  const rows: { label: string; value: string }[] = [
    { label: "Catalogo", value: "TMDB — copertine, trama, cast, episodi, date di uscita" },
    { label: "Dove guardarlo", value: "Dati di disponibilità streaming forniti da JustWatch tramite TMDB" },
    { label: "Critico", value: "API di Anthropic, chiamata dal tuo browser con la tua chiave" },
    { label: "Player", value: "hls.js per lo streaming adattivo, riproduzione nel browser" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg bg-surface-2 p-4">
        <h4 className="mb-2 text-base font-semibold text-text">I tuoi dati</h4>
        <p className="text-sm text-text-muted">
          Libreria, diario, voti, sorgenti e chiavi vivono solo in questo browser: non c'è nessun
          account e nessun server di CineMate a cui mandarli. Le uniche cose che escono dal
          dispositivo sono le richieste a TMDB e ad Anthropic, fatte con le chiavi che hai scritto
          tu, e le richieste ai server dei video che hai indicato tu. Il backup è un file leggibile
          che resta in mano tua.
        </p>
      </div>

      <dl className="list-group bg-surface-2 shadow-none" style={{ "--row-inset": "16px" } as React.CSSProperties}>
        {rows.map((row) => (
          <div key={row.label} className="list-row flex-col items-start gap-0.5">
            <dt className="text-xs text-text-muted">{row.label}</dt>
            <dd className="text-sm text-text">{row.value}</dd>
          </div>
        ))}
      </dl>

      <p className="text-xs text-text-muted">
        Questo prodotto usa l'API TMDB ma non è approvato né certificato da TMDB. CineMate non
        ospita né fornisce contenuti: riproduce le sorgenti che indichi tu.
      </p>
    </div>
  );
}

function SettingsForm() {
  const close = useSettingsSheet((s) => s.close);
  const replayOnboarding = useOnboarding((s) => s.replay);
  const apiKey = useSettings((s) => s.apiKey);
  const model = useSettings((s) => s.model);
  const setApiKey = useSettings((s) => s.setApiKey);
  const setModel = useSettings((s) => s.setModel);
  const clearApiKey = useSettings((s) => s.clearApiKey);
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const setTmdbApiKey = useSettings((s) => s.setTmdbApiKey);
  const clearTmdbApiKey = useSettings((s) => s.clearTmdbApiKey);
  const items = useLibrary((s) => s.items);
  const history = useLibrary((s) => s.history);
  const pushToast = useLibrary((s) => s.pushToast);
  const importData = useLibrary((s) => s.importData);
  const clearAll = useLibrary((s) => s.clearAll);

  const [draftKey, setDraftKey] = useState(apiKey);
  const [reveal, setReveal] = useState(false);
  const [draftTmdbKey, setDraftTmdbKey] = useState(tmdbApiKey);
  const [revealTmdb, setRevealTmdb] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleId = "settings-sheet-title";
  // Il foglio si monta solo da aperto, quindi il pannello richiesto da chi ha
  // aperto vale come valore iniziale e non serve tenerli sincronizzati dopo.
  const requested = useSettingsSheet.getState().panel;
  const [panel, setPanel] = useState<PanelId | null>(
    requested && requested in PANEL_TITLES ? (requested as PanelId) : null,
  );

  function exportData() {
    const sagas = useSagas.getState();
    const reminders = useReminders.getState();
    const playerPrefs = usePlayerPrefs.getState();
    const backup = buildBackup(
      items,
      history,
      {
        orders: sagas.orders,
        preferredOrder: sagas.prefs.order,
        hidden: sagas.prefs.hidden,
        marathon: useMarathon.getState().marathon,
        reminders: { enabled: reminders.enabled, notified: reminders.notified },
      },
      {
        sources: usePlayerSources.getState().sources,
        // Only the stored fields — the actions on the store are not data.
        prefs: {
          dataSaver: playerPrefs.dataSaver,
          watchPartyRelayUrl: playerPrefs.watchPartyRelayUrl,
          displayName: playerPrefs.displayName,
          sourceTemplates: playerPrefs.sourceTemplates,
        },
        hosts: getHosts(),
        linkHosts: useLinkHosts.getState().hosts,
        // Not derivable on the next device — see PlayerBackup.
        daily: getDailySeconds(),
      },
      useGoals.getState().goals,
      useLists.getState().lists,
    );
    downloadFile(`cinemate-libreria-${localDay()}.json`, backup, "application/json");
    pushToast("success", "Libreria esportata.");
  }

  /*
   * Le due conferme stanno nel foglio, non in una finestra del browser: il
   * `window.confirm` di prima era un riquadro grigio di sistema, con «OK» al
   * posto del verbo e il nome del sito in cima, nel mezzo di un'app che per il
   * resto parla con la sua voce. Il file letto aspetta qui finché non si
   * sceglie; la sostituzione è la stessa di prima, riga per riga.
   */
  const [pendingImport, setPendingImport] = useState<ReturnType<typeof parseBackup> | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);

  async function handleImportFile(file: File) {
    let backup;
    try {
      backup = parseBackup(await file.text());
    } catch (e) {
      pushToast("error", e instanceof BackupParseError ? e.message : "Impossibile leggere il file.");
      return;
    }
    setConfirmingClear(false);
    setPendingImport(backup);
  }

  function applyImport(backup: ReturnType<typeof parseBackup>) {
    setPendingImport(null);
    importData(backup.items, backup.history);
    // Older files carry no saga section; leaving what is on the device alone is
    // safer than wiping orders the user may still want.
    if (backup.sagas) {
      useSagas.getState().restore({
        orders: backup.sagas.orders,
        preferredOrder: backup.sagas.preferredOrder,
        hidden: backup.sagas.hidden,
      });
      useMarathon.getState().restore(backup.sagas.marathon);
      useReminders.getState().restore(backup.sagas.reminders);
    }
    // Same rule as the saga section, applied one level deeper: a section the
    // file doesn't carry is one this device keeps. A file written before the
    // player existed, or a hand-edited one, can't wipe settings it says
    // nothing about.
    if (backup.player) {
      const { sources, prefs, hosts, linkHosts, daily } = backup.player;
      if (sources !== undefined) usePlayerSources.getState().restore(sources);
      if (prefs !== undefined) usePlayerPrefs.getState().restore(prefs);
      if (hosts !== undefined) restoreHosts(hosts);
      if (linkHosts !== undefined) useLinkHosts.getState().restore(linkHosts);
      // Merged rather than replaced, then re-read so the profile redraws with
      // the days the file brought.
      if (daily !== undefined) {
        restoreDailySeconds(daily);
        useWatchProgress.getState().refresh();
      }
    }
    if (backup.goals !== undefined) useGoals.getState().restore(backup.goals);
    if (backup.lists !== undefined) useLists.getState().restore(backup.lists);
  }

  return (
    <Sheet onClose={close} titleId={titleId} maxWidthClass="max-w-md">
      <div className="flex flex-col gap-6 p-5 pt-8 sm:p-6">
        <div className="flex items-center gap-2.5">
          {panel && (
            <button
              type="button"
              onClick={() => setPanel(null)}
              aria-label="Torna alle impostazioni"
              className="icon-btn icon-btn-filled icon-btn-sm shrink-0"
            >
              <BackIcon size={16} />
            </button>
          )}
          <h2 id={titleId} className="t-title text-text">
            {panel ? PANEL_TITLES[panel] : "Impostazioni"}
          </h2>
        </div>

        {panel === null && (
          <div className="flex flex-col gap-6">
            <SettingsGroup label="Catalogo e intelligenza">
              <SettingsRow
                icon={<SparkleIcon size={18} />}
                title="Chiavi e modello"
                subtitle="TMDB per copertine e cast, Anthropic per il critico. Restano su questo dispositivo."
                onClick={() => setPanel("chiavi")}
              />
            </SettingsGroup>

            <SettingsGroup label="Riproduzione">
              <SettingsRow
                icon={<PlayIcon size={18} />}
                title="Indirizzi delle tue sorgenti"
                subtitle="Dove stanno i tuoi video: scrivilo una volta e ogni titolo ha il suo pulsante Guarda."
                onClick={() => setPanel("sorgenti")}
              />
              <SettingsRow
                icon={<CompassIcon size={18} />}
                title="Gestisci Link Host"
                subtitle="I siti su cui cercare quando le tue sorgenti non hanno il titolo."
                onClick={() => setPanel("linkhost")}
              />
            </SettingsGroup>

            <SettingsGroup label="App">
              <SettingsRow
                icon={<SunIcon size={18} />}
                title="Aspetto"
                subtitle="Tema chiaro o scuro e colore d'accento."
                onClick={() => setPanel("aspetto")}
              />
              {/* Il primo avvio si può rivedere: è l'unico posto dell'app che
                  si attraversa una volta sola, e l'unico modo di ritrovarlo
                  sarebbe cancellare la libreria. */}
              <SettingsRow
                icon={<RefreshIcon size={18} />}
                title="Rivedi il primo avvio"
                subtitle="Le quattro schermate di benvenuto, compresa la chiave del catalogo."
                onClick={() => {
                  close();
                  replayOnboarding();
                }}
              />
              <SettingsRow
                icon={<HomeIcon size={18} />}
                title="Home su misura"
                subtitle="Quali righe vedere in Home, e in che ordine."
                onClick={() => setPanel("home")}
              />
              <SettingsRow
                icon={<StackIcon size={18} />}
                title="Televisore"
                subtitle="Comandi grandi e navigazione con le frecce del telecomando."
                onClick={() => setPanel("tv")}
              />
              <SettingsRow
                icon={<PersonIcon size={18} />}
                title="Controllo genitori"
                subtitle="Nasconde i titoli sopra una certa età, protetto da un PIN."
                onClick={() => setPanel("genitori")}
              />
            </SettingsGroup>

            <SettingsGroup label="Dati">
              <SettingsRow
                icon={<BookIcon size={18} />}
                title="Dati e backup"
                subtitle="Esporta, importa, svuota. Tutto vive solo in questo browser."
                onClick={() => setPanel("dati")}
              />
              <SettingsRow
                icon={<PulseIcon size={18} />}
                title="Diagnostica"
                subtitle="Test automatici, stato degli host e registro degli errori."
                to="/diagnostica"
                onNavigate={close}
              />
            </SettingsGroup>

            <SettingsGroup label="Info">
              <SettingsRow
                icon={<InfoIcon size={18} />}
                title="Informazioni sull'app"
                subtitle="Di cosa è fatta CineMate, con cosa parla e cosa promette sui tuoi dati."
                onClick={() => setPanel("info")}
              />
            </SettingsGroup>
          </div>
        )}

        {panel === "chiavi" && (
          <>
        <div>
          <span className="mb-1 block text-base font-semibold text-text">
            Chiave API Anthropic
          </span>
          <p className="mb-3 text-sm text-text-muted">
            Usata solo dal tuo browser per parlare direttamente con l'API di Anthropic — non viene mai inviata altrove
            e resta salvata solo su questo dispositivo. Ricordati che è una chiave personale: non condividere questo
            dispositivo con dati sensibili collegati.
          </p>
          <div className="flex gap-2">
            <input
              type={reveal ? "text" : "password"}
              value={draftKey}
              onChange={(e) => setDraftKey(e.target.value)}
              placeholder="sk-ant-…"
              autoComplete="off"
              className="field flex-1 font-mono"
            />
            <button
              type="button"
              onClick={() => setReveal((r) => !r)}
              aria-label={reveal ? "Nascondi chiave" : "Mostra chiave"}
              className="btn btn-secondary btn-sm"
            >
              {reveal ? "Nascondi" : "Mostra"}
            </button>
          </div>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setApiKey(draftKey);
                pushToast("success", "Chiave salvata.");
              }}
              className="btn btn-primary btn-sm"
            >
              Salva chiave
            </button>
            {apiKey && (
              <button
                type="button"
                onClick={() => {
                  clearApiKey();
                  setDraftKey("");
                  pushToast("info", "Chiave rimossa.");
                }}
                className="btn btn-secondary btn-sm"
              >
                Rimuovi
              </button>
            )}
          </div>
        </div>

        <div>
          <span className="mb-1 block text-base font-semibold text-text">Chiave API TMDB</span>
          <p className="mb-3 text-sm text-text-muted">
            Per copertine reali, trama, cast, trailer e disponibilità streaming legale. Gratuita — la ottieni in
            pochi minuti creando un account su themoviedb.org (Impostazioni → API). Resta anch'essa solo su questo
            dispositivo.
          </p>
          <div className="flex gap-2">
            <input
              type={revealTmdb ? "text" : "password"}
              value={draftTmdbKey}
              onChange={(e) => setDraftTmdbKey(e.target.value)}
              placeholder="Chiave API TMDB (v3)"
              autoComplete="off"
              className="field flex-1 font-mono"
            />
            <button
              type="button"
              onClick={() => setRevealTmdb((r) => !r)}
              aria-label={revealTmdb ? "Nascondi chiave" : "Mostra chiave"}
              className="btn btn-secondary btn-sm"
            >
              {revealTmdb ? "Nascondi" : "Mostra"}
            </button>
          </div>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setTmdbApiKey(draftTmdbKey);
                // A new key deserves a fresh go at titles that failed before.
                resetAutoLinkAttempts();
                pushToast("success", "Chiave TMDB salvata.");
              }}
              className="btn btn-primary btn-sm"
            >
              Salva chiave
            </button>
            {tmdbApiKey && (
              <button
                type="button"
                onClick={() => {
                  clearTmdbApiKey();
                  setDraftTmdbKey("");
                  pushToast("info", "Chiave TMDB rimossa.");
                }}
                className="btn btn-secondary btn-sm"
              >
                Rimuovi
              </button>
            )}
          </div>
          <p className="mt-3 text-xs text-text-muted">
            Questo prodotto usa l'API TMDB ma non è approvato né certificato da TMDB. Dati streaming forniti da
            JustWatch.
          </p>
        </div>

        <div>
          <span className="mb-3 block text-base font-semibold text-text">Modello</span>
          {/* Una scelta fra tre, come nelle impostazioni di sistema: la voce
              scelta ha il segno di spunta, le altre niente. */}
          <div
            className="list-group bg-surface-2 shadow-none"
            role="radiogroup"
            aria-label="Modello Claude"
            style={{ "--row-inset": "16px" } as React.CSSProperties}
          >
            {MODELS.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={model === m.id}
                onClick={() => setModel(m.id)}
                className="list-row min-h-12 justify-between py-2.5 hover:bg-surface-hover"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-text">{m.label}</span>
                  <span className="block text-xs text-text-muted">{m.hint}</span>
                </span>
                <span aria-hidden="true" className="shrink-0 text-accent-text">
                  {model === m.id && <CheckIcon size={18} />}
                </span>
              </button>
            ))}
          </div>
        </div>

          </>
        )}

        {panel === "sorgenti" && (
          <>
        <SourceTemplates />

        <PageReaderSetting />

        <div>
          <span className="mb-1 block text-base font-semibold text-text">
            Quando un indirizzo non si risolve
          </span>
          <p className="mb-3 text-sm text-text-muted">
            Un host che «non risponde» a volte non è spento: è il nome che non viene tradotto in un
            indirizzo. Il DNS è quel passaggio, viaggia in chiaro per impostazione predefinita, e il
            resolver dell'operatore è solo uno dei tanti possibili.
          </p>
          <DnsGuideButton />
        </div>
          </>
        )}

        {panel === "linkhost" && <LinkHostSettings />}
        {panel === "info" && <AboutPanel />}
        {panel === "aspetto" && <AppearanceSettings />}
        {panel === "tv" && <TvSettings />}
        {panel === "home" && <HomeLayoutSettings />}
        {panel === "genitori" && <ParentalSettings />}

        {panel === "dati" && (
        <div>
          <p className="mb-4 text-sm text-text-muted">
            Tutto vive solo in questo browser. Esporta ogni tanto un backup: è anche il modo per portare la libreria
            su un altro dispositivo.
          </p>
          <div className="list-group bg-surface-2 shadow-none">
            <button
              type="button"
              onClick={exportData}
              disabled={items.length === 0}
              className="list-row hover:bg-surface-hover disabled:opacity-40"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center text-text-muted"><DownloadIcon size={18} /></span>
              <span className="flex-1 text-sm font-medium text-text">Esporta la libreria</span>
              <span className="text-xs text-text-muted">JSON</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="list-row hover:bg-surface-hover"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center text-text-muted"><UploadIcon size={18} /></span>
              <span className="flex-1 text-sm font-medium text-text">Importa da un backup…</span>
            </button>
            <button
              type="button"
              disabled={items.length === 0}
              onClick={() => {
                setPendingImport(null);
                setConfirmingClear(true);
              }}
              className="list-row hover:bg-surface-hover disabled:opacity-40"
              style={{ color: "var(--danger)" }}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center"><TrashIcon size={18} /></span>
              <span className="flex-1 text-sm font-medium">Svuota la libreria</span>
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="Scegli un file di backup JSON"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void handleImportFile(file);
            }}
          />

          {pendingImport && (
            <div role="alertdialog" aria-labelledby="import-confirm" className="mt-4 rounded-md bg-surface-2 p-4">
              <p id="import-confirm" className="text-sm text-text">
                Importare {pendingImport.items.length} titoli? La libreria attuale ({items.length} titoli) verrà
                sostituita
                {pendingImport.lists !== undefined && pendingImport.player
                  ? ", insieme alle liste, alle sorgenti del player e agli host"
                  : pendingImport.lists !== undefined
                    ? ", insieme alle liste"
                    : pendingImport.player
                      ? ", insieme alle sorgenti del player e agli host"
                      : ""}
                .
              </p>
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setPendingImport(null)} className="btn btn-secondary btn-sm">
                  Annulla
                </button>
                <button type="button" onClick={() => applyImport(pendingImport)} className="btn btn-primary btn-sm">
                  Importa
                </button>
              </div>
            </div>
          )}

          {confirmingClear && (
            <div role="alertdialog" aria-labelledby="clear-confirm" className="mt-4 rounded-md bg-surface-2 p-4">
              <p id="clear-confirm" className="text-sm text-text">
                Svuotare la libreria? {items.length} titoli e tutto il diario verranno eliminati da questo dispositivo.
                Non si torna indietro.
              </p>
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setConfirmingClear(false)} className="btn btn-secondary btn-sm">
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingClear(false);
                    clearAll();
                    // Saghe, maratona e promemoria descrivono la stessa libreria:
                    // lasciarli indietro significherebbe mostrare progressi di
                    // titoli che non esistono più.
                    useSagas.getState().clearAll();
                    useMarathon.getState().stop();
                    useReminders.getState().clearAll();
                    useLists.getState().clearAll();
                  }}
                  className="btn btn-danger-fill btn-sm"
                >
                  Svuota
                </button>
              </div>
            </div>
          )}
        </div>
        )}
      </div>
    </Sheet>
  );
}

export function SettingsSheetPortal() {
  const isOpen = useSettingsSheet((s) => s.isOpen);
  return <AnimatePresence>{isOpen && <SettingsForm />}</AnimatePresence>;
}
