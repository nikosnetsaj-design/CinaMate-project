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
import { useTheme } from "../store/useTheme";
import { useTvMode, type TvPreference } from "../store/useTvMode";
import { useHomeLayout, HOME_SECTIONS } from "../store/useHomeLayout";
import { ACCENTS } from "../lib/accents";
import { ParentalSettings } from "./ParentalSettings";
import { LinkHostSettings } from "./LinkHostSettings";
import { DnsGuideButton } from "./DnsGuide";
import { useLinkHosts } from "../store/useLinkHosts";
import { TEMPLATE_FIELDS, previewTemplate, previewCount } from "../lib/sourceTemplate";
import { getHosts, restoreHosts } from "../player/services/hostStore";
import { getDailySeconds, restoreDailySeconds } from "../player/services/statsAndHistory";
import { useWatchProgress } from "../store/useWatchProgress";
import { buildBackup, parseBackup, BackupParseError } from "../lib/backup";
import { resetAutoLinkAttempts } from "../lib/useAutoLinkTmdb";
import { BookIcon, CompassIcon, HomeIcon, PersonIcon, PlayIcon, PulseIcon, ReelMark, SparkleIcon, StackIcon, SunIcon } from "./icons";

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

  return (
    <div>
      <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-text-faint">Aspetto</span>

      <div className="mb-3 flex gap-2" role="radiogroup" aria-label="Tema">
        {(["dark", "light"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={theme === value}
            onClick={() => {
              if (theme !== value) toggleTheme();
            }}
            className="flex-1 rounded-sm border px-3 py-2.5 text-sm transition-colors"
            style={
              theme === value
                ? {
                    borderColor: "color-mix(in srgb, var(--accent) 50%, transparent)",
                    background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                    color: "var(--text)",
                  }
                : { borderColor: "var(--border-strong)", color: "var(--text-muted)" }
            }
          >
            {value === "dark" ? "Scuro" : "Chiaro"}
          </button>
        ))}
      </div>

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
              className="h-9 w-9 rounded-full border-2 transition-transform hover:scale-110"
              style={{
                background: swatch,
                borderColor: active ? "var(--text)" : "transparent",
              }}
            />
          );
        })}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-text-faint">
        Sei tinte, ognuna con la sua variante chiara e scura: sono scelte perché restino leggibili
        su entrambi i temi, cosa che un colore qualsiasi preso da una ruota non garantisce.
      </p>
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
      <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-text-faint">Televisore</span>
      <div className="mb-2 flex gap-2" role="radiogroup" aria-label="Modalità televisore">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={preference === option.id}
            onClick={() => setPreference(option.id)}
            className="flex-1 rounded-sm border px-3 py-2.5 text-sm transition-colors"
            style={
              preference === option.id
                ? {
                    borderColor: "color-mix(in srgb, var(--accent) 50%, transparent)",
                    background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                    color: "var(--text)",
                  }
                : { borderColor: "var(--border-strong)", color: "var(--text-muted)" }
            }
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="text-xs leading-relaxed text-text-faint">
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

  const byId = new Map(HOME_SECTIONS.map((s) => [s.id, s]));

  return (
    <div>
      <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-text-faint">Home</span>
      <p className="mb-2.5 text-xs leading-relaxed text-text-faint">
        Cosa vedi appena apri l'app, e in che ordine. Una riga spenta non sparisce dai dati: resta
        dove è sempre stata, semplicemente non occupa la prima schermata.
      </p>

      <ul className="flex flex-col gap-1.5">
        {order.map((id, index) => {
          const section = byId.get(id);
          if (!section) return null;
          const visible = !hidden.includes(id);
          return (
            <li
              key={id}
              className="flex items-center gap-2 rounded-sm border border-border-strong px-2.5 py-2"
              style={{ opacity: visible ? 1 : 0.5 }}
            >
              <div className="flex shrink-0 flex-col">
                <button
                  type="button"
                  onClick={() => move(id, -1)}
                  disabled={index === 0}
                  aria-label={`Sposta ${section.label} in alto`}
                  className="px-1 text-xs leading-tight text-text-muted disabled:opacity-25"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => move(id, 1)}
                  disabled={index === order.length - 1}
                  aria-label={`Sposta ${section.label} in basso`}
                  className="px-1 text-xs leading-tight text-text-muted disabled:opacity-25"
                >
                  ▼
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-text">{section.label}</p>
                <p className="truncate text-xs text-text-faint">{section.description}</p>
              </div>
              <button
                type="button"
                onClick={() => toggle(id)}
                aria-pressed={visible}
                aria-label={visible ? `Nascondi ${section.label}` : `Mostra ${section.label}`}
                className="shrink-0 rounded-sm border border-border-strong px-2 py-1 text-xs text-text-muted"
              >
                {visible ? "Mostra" : "Nascosta"}
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={reset}
        className="mt-2 w-full rounded-sm border border-border-strong px-3.5 py-2 text-xs text-text-muted hover:bg-surface-hover"
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
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-faint">
        Indirizzi delle tue sorgenti
      </span>
      <p className="mb-2.5 text-xs leading-relaxed text-text-faint">
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
                className="w-full rounded-sm border border-border-strong bg-surface px-3 py-2.5 font-mono text-xs text-text placeholder:text-text-faint focus:border-accent"
              />
              {preview && (
                <p className="mt-1 break-all px-1 font-mono text-[10px] leading-relaxed text-text-faint">
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
        className="mt-2 rounded-sm border border-border-strong px-2.5 py-1.5 text-xs text-text-muted"
      >
        {showHelp ? "Nascondi i segnaposto" : "Quali segnaposto posso usare?"}
      </button>

      {showHelp && (
        <dl className="mt-2 flex flex-col gap-1.5 rounded-sm border border-border bg-surface-2 p-3">
          {TEMPLATE_FIELDS.map((f) => (
            <div key={f.token} className="flex flex-wrap items-baseline gap-x-2">
              <dt className="font-mono text-xs text-accent-text">{f.token}</dt>
              <dd className="flex-1 text-xs text-text-faint">
                {f.label} <span className="font-mono">({f.example})</span>
              </dd>
            </div>
          ))}
          <p className="mt-1 text-xs leading-relaxed text-text-faint">
            I segnaposto vengono riempiti con i dati del titolo, e il player chiede quell'indirizzo
            sul server che hai indicato.
          </p>
        </dl>
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
  const body = (
    <>
      <span className="mt-0.5 shrink-0 text-accent-text">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-text">{title}</span>
        <span className="mt-0.5 block text-xs leading-snug text-text-faint">{subtitle}</span>
      </span>
      <span aria-hidden="true" className="mt-0.5 shrink-0 text-text-faint">
        ›
      </span>
    </>
  );
  const className =
    "flex w-full items-start gap-3 px-3.5 py-3 text-left transition-colors hover:bg-surface-hover";
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
      <h3 className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-faint">{label}</h3>
      <div className="divide-y divide-border overflow-hidden rounded-md border border-border bg-surface-2">
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
      <div className="rounded-md border border-border bg-surface-2 p-4">
        <h4 className="mb-2 text-sm font-semibold text-text">I tuoi dati</h4>
        <p className="text-xs leading-relaxed text-text-faint">
          Libreria, diario, voti, sorgenti e chiavi vivono solo in questo browser: non c'è nessun
          account e nessun server di CineMate a cui mandarli. Le uniche cose che escono dal
          dispositivo sono le richieste a TMDB e ad Anthropic, fatte con le chiavi che hai scritto
          tu, e le richieste ai server dei video che hai indicato tu. Il backup è un file leggibile
          che resta in mano tua.
        </p>
      </div>

      <div className="overflow-hidden rounded-md border border-border">
        {rows.map((row) => (
          <div key={row.label} className="border-b border-border px-3.5 py-3 last:border-b-0">
            <span className="block text-xs font-medium uppercase tracking-wide text-text-faint">{row.label}</span>
            <span className="mt-0.5 block text-sm text-text">{row.value}</span>
          </div>
        ))}
      </div>

      <p className="text-[11px] leading-relaxed text-text-faint">
        Questo prodotto usa l'API TMDB ma non è approvato né certificato da TMDB. CineMate non
        ospita né fornisce contenuti: riproduce le sorgenti che indichi tu.
      </p>
    </div>
  );
}

function SettingsForm() {
  const close = useSettingsSheet((s) => s.close);
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
  const [panel, setPanel] = useState<PanelId | null>(null);

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
    );
    const blob = new Blob([backup], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cinemate-libreria-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast("success", "Libreria esportata.");
  }

  async function handleImportFile(file: File) {
    let backup;
    try {
      backup = parseBackup(await file.text());
    } catch (e) {
      pushToast("error", e instanceof BackupParseError ? e.message : "Impossibile leggere il file.");
      return;
    }
    const confirmed = window.confirm(
      `Importare ${backup.items.length} titoli? La libreria attuale (${items.length} titoli) verrà sostituita` +
        `${backup.player ? ", insieme alle sorgenti del player e agli host" : ""}.`,
    );
    if (!confirmed) return;
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
  }

  return (
    <Sheet onClose={close} titleId={titleId} maxWidthClass="max-w-md">
      <div className="flex flex-col gap-5 p-5 pt-8 sm:p-6">
        <div className="flex items-center gap-2.5">
          {panel && (
            <button
              type="button"
              onClick={() => setPanel(null)}
              aria-label="Torna alle impostazioni"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-strong text-text-muted"
            >
              ←
            </button>
          )}
          <h2 id={titleId} className="font-display text-xl font-semibold text-text">
            {panel ? PANEL_TITLES[panel] : "Impostazioni"}
          </h2>
        </div>

        {panel === null && (
          <div className="flex flex-col gap-5">
            <SettingsGroup label="Catalogo e intelligenza">
              <SettingsRow
                icon={<SparkleIcon size={17} />}
                title="Chiavi e modello"
                subtitle="TMDB per copertine e cast, Anthropic per il critico. Restano su questo dispositivo."
                onClick={() => setPanel("chiavi")}
              />
            </SettingsGroup>

            <SettingsGroup label="Riproduzione">
              <SettingsRow
                icon={<PlayIcon size={17} />}
                title="Indirizzi delle tue sorgenti"
                subtitle="Dove stanno i tuoi video: scrivilo una volta e ogni titolo ha il suo pulsante Guarda."
                onClick={() => setPanel("sorgenti")}
              />
              <SettingsRow
                icon={<CompassIcon size={17} />}
                title="Gestisci Link Host"
                subtitle="I siti su cui cercare quando le tue sorgenti non hanno il titolo."
                onClick={() => setPanel("linkhost")}
              />
            </SettingsGroup>

            <SettingsGroup label="App">
              <SettingsRow
                icon={<SunIcon size={17} />}
                title="Aspetto"
                subtitle="Tema chiaro o scuro e colore d'accento."
                onClick={() => setPanel("aspetto")}
              />
              <SettingsRow
                icon={<HomeIcon size={17} />}
                title="Home su misura"
                subtitle="Quali righe vedere in Home, e in che ordine."
                onClick={() => setPanel("home")}
              />
              <SettingsRow
                icon={<StackIcon size={17} />}
                title="Televisore"
                subtitle="Comandi grandi e navigazione con le frecce del telecomando."
                onClick={() => setPanel("tv")}
              />
              <SettingsRow
                icon={<PersonIcon size={17} />}
                title="Controllo genitori"
                subtitle="Nasconde i titoli sopra una certa età, protetto da un PIN."
                onClick={() => setPanel("genitori")}
              />
            </SettingsGroup>

            <SettingsGroup label="Dati">
              <SettingsRow
                icon={<BookIcon size={17} />}
                title="Dati e backup"
                subtitle="Esporta, importa, svuota. Tutto vive solo in questo browser."
                onClick={() => setPanel("dati")}
              />
              <SettingsRow
                icon={<PulseIcon size={17} />}
                title="Diagnostica"
                subtitle="Test automatici, stato degli host e registro degli errori."
                to="/diagnostica"
                onNavigate={close}
              />
            </SettingsGroup>

            <SettingsGroup label="Info">
              <SettingsRow
                icon={<ReelMark size={17} />}
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
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-faint">
            Chiave API Anthropic
          </span>
          <p className="mb-2.5 text-xs leading-relaxed text-text-faint">
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
              className="flex-1 rounded-sm border border-border-strong bg-surface px-3 py-2.5 font-mono text-sm text-text placeholder:text-text-faint focus:border-accent"
            />
            <button
              type="button"
              onClick={() => setReveal((r) => !r)}
              aria-label={reveal ? "Nascondi chiave" : "Mostra chiave"}
              className="rounded-sm border border-border-strong px-3 text-xs text-text-muted"
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
              className="rounded-sm px-3.5 py-2 text-xs font-semibold"
              style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
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
                className="rounded-sm border border-border-strong px-3.5 py-2 text-xs text-text-muted"
              >
                Rimuovi
              </button>
            )}
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-faint">Chiave API TMDB</span>
          <p className="mb-2.5 text-xs leading-relaxed text-text-faint">
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
              className="flex-1 rounded-sm border border-border-strong bg-surface px-3 py-2.5 font-mono text-sm text-text placeholder:text-text-faint focus:border-accent"
            />
            <button
              type="button"
              onClick={() => setRevealTmdb((r) => !r)}
              aria-label={revealTmdb ? "Nascondi chiave" : "Mostra chiave"}
              className="rounded-sm border border-border-strong px-3 text-xs text-text-muted"
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
              className="rounded-sm px-3.5 py-2 text-xs font-semibold"
              style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
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
                className="rounded-sm border border-border-strong px-3.5 py-2 text-xs text-text-muted"
              >
                Rimuovi
              </button>
            )}
          </div>
          <p className="mt-2.5 text-[11px] text-text-faint">
            Questo prodotto usa l'API TMDB ma non è approvato né certificato da TMDB. Dati streaming forniti da
            JustWatch.
          </p>
        </div>

        <div>
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-text-faint">Modello</span>
          <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Modello Claude">
            {MODELS.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={model === m.id}
                onClick={() => setModel(m.id)}
                className="flex items-center justify-between rounded-sm border px-3 py-2.5 text-left text-sm transition-colors"
                style={
                  model === m.id
                    ? { borderColor: "color-mix(in srgb, var(--accent) 50%, transparent)", background: "color-mix(in srgb, var(--accent) 12%, transparent)" }
                    : { borderColor: "var(--border-strong)" }
                }
              >
                <span className="font-medium text-text">{m.label}</span>
                <span className="text-xs text-text-faint">{m.hint}</span>
              </button>
            ))}
          </div>
        </div>

          </>
        )}

        {panel === "sorgenti" && (
          <>
        <SourceTemplates />

        <div>
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-faint">
            Quando un indirizzo non si risolve
          </span>
          <p className="mb-2 text-xs leading-relaxed text-text-faint">
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
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-text-faint">Dati locali</span>
          <p className="mb-2.5 text-xs leading-relaxed text-text-faint">
            Tutto vive solo in questo browser. Esporta ogni tanto un backup: è anche il modo per portare la libreria
            su un altro dispositivo.
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={exportData}
              disabled={items.length === 0}
              className="w-full rounded-sm border border-border-strong px-3.5 py-2.5 text-left text-sm text-text disabled:opacity-40"
            >
              Esporta libreria (JSON)
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-sm border border-border-strong px-3.5 py-2.5 text-left text-sm text-text"
            >
              Importa da backup…
            </button>
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
            <button
              type="button"
              disabled={items.length === 0}
              onClick={() => {
                if (window.confirm(`Svuotare la libreria? ${items.length} titoli e tutto il diario verranno eliminati da questo dispositivo.`)) {
                  clearAll();
                  // Saghe, maratona e promemoria descrivono la stessa libreria:
                  // lasciarli indietro significherebbe mostrare progressi di
                  // titoli che non esistono più.
                  useSagas.getState().clearAll();
                  useMarathon.getState().stop();
                  useReminders.getState().clearAll();
                }
              }}
              className="w-full rounded-sm border px-3.5 py-2.5 text-left text-sm disabled:opacity-40"
              style={{ borderColor: "color-mix(in srgb, var(--danger) 40%, transparent)", color: "var(--danger)" }}
            >
              Svuota la libreria
            </button>
          </div>
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
