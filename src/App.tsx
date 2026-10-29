import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { Navigate, Route, Routes } from "react-router-dom";
import { Nav } from "./components/Nav";
import { ToastStack } from "./components/ToastStack";
import { PageSkeleton } from "./components/Skeletons";
import { CommandPalette } from "./components/CommandPalette";
import { ItemDetailSheetPortal } from "./components/ItemDetailSheet";
import { NextChapterPrompt } from "./components/NextChapterPrompt";
import { ResumePrompt } from "./components/ResumePrompt";
import { IncomingShare } from "./components/IncomingShare";
import { UpdatePrompt } from "./components/UpdatePrompt";
import { MiniPlayerBar } from "./components/MiniPlayerBar";
import { useAddSheet } from "./store/useAddSheet";
import { useEditSheet } from "./store/useEditSheet";
import { useSelectedPerson } from "./store/useSelectedPerson";
import { useSelectedSaga } from "./store/useSelectedSaga";
import { useCatalogPreview } from "./store/useCatalogPreview";
import { useWebViewer } from "./store/useWebViewer";
import { useOnboarding } from "./store/useOnboarding";
import { ErrorIcon } from "./components/icons";
import { useOnline } from "./lib/useOnline";
import { useTheme } from "./store/useTheme";
import { applyAccent } from "./lib/accents";
import { readOriginalLibrary, useLibrary } from "./store/useLibrary";
import { useSettingsSheet } from "./store/useSettingsSheet";
import { downloadFile } from "./lib/download";
import { localDay } from "./lib/day";
import { useAutoLinkTmdb } from "./lib/useAutoLinkTmdb";
import { useAutoLinkSagas } from "./lib/useAutoLinkSagas";
import { useReleaseAlerts } from "./lib/useReleaseAlerts";
import { useSpatialNav } from "./lib/useSpatialNav";
import { Home } from "./pages/Home";
import { useWatchProgressSync } from "./store/useWatchProgress";

/**
 * Le pagine, tranne la Home, arrivano quando servono.
 *
 * Il pacchetto d'avvio era di 807 kB perché conteneva tutta l'app: le sei
 * pagine, le Impostazioni con le loro nove schermate, il Web Viewer, il primo
 * avvio, sette fogli. Per aprire «Stasera» ne serve una frazione. Ognuna di
 * queste si scarica al primo uso — e di solito prima, quando il dito tocca la
 * voce in barra (`lib/prefetch`) — e il service worker le mette tutte in cache
 * alla prima visita, così l'app offline resta intera (`vite.config.ts`).
 */
const Library = lazy(() => import("./pages/Library").then((m) => ({ default: m.Library })));
const Sagas = lazy(() => import("./pages/Sagas").then((m) => ({ default: m.Sagas })));
const Discover = lazy(() => import("./pages/Discover").then((m) => ({ default: m.Discover })));
const Search = lazy(() => import("./pages/Search").then((m) => ({ default: m.Search })));
const Tu = lazy(() => import("./pages/Tu").then((m) => ({ default: m.Tu })));
const Critic = lazy(() => import("./pages/Critic").then((m) => ({ default: m.Critic })));

/*
 * I fogli che si aprono di rado. La scheda del titolo resta nel pacchetto
 * d'avvio: è il tocco più frequente dell'app, e deve aprirsi senza attese.
 */
const SettingsSheetPortal = lazy(() =>
  import("./components/SettingsSheet").then((m) => ({ default: m.SettingsSheetPortal })),
);
const AddItemSheetPortal = lazy(() => import("./components/AddItemSheet").then((m) => ({ default: m.AddItemSheetPortal })));
const EditItemSheetPortal = lazy(() =>
  import("./components/EditItemSheet").then((m) => ({ default: m.EditItemSheetPortal })),
);
const PersonSheetPortal = lazy(() => import("./components/PersonSheet").then((m) => ({ default: m.PersonSheetPortal })));
const SagaSheetPortal = lazy(() => import("./components/SagaSheet").then((m) => ({ default: m.SagaSheetPortal })));
const CatalogSheetPortal = lazy(() => import("./components/CatalogSheet").then((m) => ({ default: m.CatalogSheetPortal })));
const WebViewer = lazy(() => import("./components/WebViewer").then((m) => ({ default: m.WebViewer })));
const Onboarding = lazy(() => import("./components/Onboarding").then((m) => ({ default: m.Onboarding })));

/**
 * Monta un foglio a caricamento differito la prima volta che serve, e poi lo
 * lascia montato.
 *
 * «Poi lo lascia» è la parte che conta: ogni foglio gestisce da sé la propria
 * animazione d'uscita con `AnimatePresence`, che ha bisogno di restare nel
 * documento mentre il foglio scivola via. Smontarlo alla chiusura lo farebbe
 * sparire di colpo.
 */
function Deferred({ when, children }: { when: boolean; children: ReactNode }) {
  const [armed, setArmed] = useState(when);
  useEffect(() => {
    if (when) setArmed(true);
  }, [when]);
  if (!armed && !when) return null;
  return <Suspense fallback={null}>{children}</Suspense>;
}


/**
 * The player is the only route that needs hls.js, and hls.js alone is bigger
 * than the rest of the app put together. Splitting it out keeps the launch of
 * a diary app — which is what almost every visit is — as light as it was
 * before the player existed.
 */
const Player = lazy(() => import("./pages/Player").then((m) => ({ default: m.Player })));

/**
 * Split for the same reason as the player, on a different axis: this one is
 * small but almost never opened — it is where you go when something is wrong,
 * and its self-tests drag in the whole host-checking layer. Keeping it out of
 * the first load costs a page nobody visits nothing and keeps the launch about
 * the library.
 */
const Diagnostics = lazy(() => import("./pages/Diagnostics").then((m) => ({ default: m.Diagnostics })));

/**
 * La tavola della proposta di design: fuori dalla navigazione e in un pezzo a
 * parte, con il suo carattere e le sue icone, così chi non la apre non scarica
 * niente di quello che contiene.
 */
const DesignPreview = lazy(() => import("./pages/DesignPreview").then((m) => ({ default: m.DesignPreview })));

/**
 * Says why the parts that need a network have gone quiet.
 *
 * Everything that matters here — the library, the diary, the statistics, the
 * player's own sources — lives on the device and keeps working. What stops is
 * TMDB and the AI critic, and without a word about it a search returning
 * nothing looks like a broken app rather than a missing connection.
 */
function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      className="flex items-center gap-2.5 bg-surface-2 px-4 py-2.5 text-sm text-text-muted sm:px-6"
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--warning)" }} />
      {/* Erano 28 parole, e due delle tre cose che nominavano — «TMDB», «il
          critico» — non dicono niente a chi legge nel momento in cui legge.
          Quello che serve sapere è che la libreria non si è rotta. */}
      Sei offline. La libreria funziona tutta; copertine e ricerca tornano con la rete.
    </div>
  );
}

/**
 * Quando i dati del dispositivo non sono come dovrebbero.
 *
 * Erano due guasti con una frase sola: «non riesco a leggere i dati» compariva
 * anche quando la memoria era *piena* — cioè quando la libreria si leggeva
 * benissimo e solo l'ultima modifica non era stata salvata — e il rimedio
 * offerto era svuotare tutto. Adesso sono tre casi, e ognuno ha il suo gesto:
 *
 * - **illeggibile**: la libreria intera non è un elenco. Si può scaricare
 *   l'originale e poi ricominciare, con conferma;
 * - **in parte**: qualche record storto, gli altri sono qui. Si dice quanti e
 *   si offre la copia dei dati originali;
 * - **memoria piena**: niente è rotto, ma le modifiche non restano. Il gesto
 *   giusto è un backup, non una cancellazione.
 */
function DataBanner() {
  const loadIssue = useLibrary((s) => s.loadIssue);
  const storageError = useLibrary((s) => s.storageError);
  const resetCorruptedData = useLibrary((s) => s.resetCorruptedData);
  const dismissLoadIssue = useLibrary((s) => s.dismissLoadIssue);
  const openSettings = useSettingsSheet((s) => s.open);
  const [confirming, setConfirming] = useState(false);

  if (!loadIssue && !storageError) return null;

  function downloadOriginal() {
    const raw = readOriginalLibrary();
    if (raw) downloadFile(`cinemate-dati-originali-${localDay()}.json`, raw, "application/json");
  }

  let text: string;
  let actions: React.ReactNode;
  if (loadIssue?.kind === "unreadable") {
    text = confirming
      ? "Libreria e diario di questo dispositivo verranno svuotati. Non si torna indietro."
      : "Non riesco a leggere la libreria salvata su questo dispositivo. Scarica i dati originali prima di ricominciare: sono ancora qui.";
    actions = confirming ? (
      <>
        <button type="button" onClick={() => setConfirming(false)} className="btn btn-secondary btn-sm">
          Annulla
        </button>
        <button type="button" onClick={resetCorruptedData} className="btn btn-danger-fill btn-sm">
          Svuota e ricomincia
        </button>
      </>
    ) : (
      <>
        <button type="button" onClick={downloadOriginal} className="btn btn-secondary btn-sm">
          Scarica i dati originali
        </button>
        <button type="button" onClick={() => setConfirming(true)} className="btn btn-secondary btn-sm">
          Ricomincia da capo
        </button>
      </>
    );
  } else if (loadIssue?.kind === "partial") {
    const n = loadIssue.skipped;
    text = `${n === 1 ? "Un titolo salvato non si leggeva" : `${n} titoli salvati non si leggevano`}: ${
      loadIssue.rescued ? "li ho messi da parte con una copia dei dati originali." : "li ho tolti."
    } Il resto della libreria è qui.`;
    actions = (
      <>
        {loadIssue.rescued && (
          <button type="button" onClick={downloadOriginal} className="btn btn-secondary btn-sm">
            Scarica la copia
          </button>
        )}
        <button type="button" onClick={dismissLoadIssue} className="btn btn-secondary btn-sm">
          {loadIssue.rescued ? "Elimina la copia" : "Ho capito"}
        </button>
      </>
    );
  } else {
    text = "La memoria del browser è piena: le ultime modifiche non sono state salvate. Esporta un backup prima di continuare.";
    actions = (
      <button type="button" onClick={() => openSettings("dati")} className="btn btn-secondary btn-sm">
        Esporta un backup
      </button>
    );
  }

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6"
      style={{ background: "color-mix(in srgb, var(--danger) 12%, var(--bg))" }}
    >
      <span className="flex min-w-0 flex-1 basis-64 items-start gap-2.5 text-sm text-text">
        <span className="mt-0.5 shrink-0" style={{ color: "var(--danger)" }}>
          <ErrorIcon />
        </span>
        {text}
      </span>
      <span className="flex flex-wrap gap-2">{actions}</span>
    </div>
  );
}

export default function App() {
  const settingsOpen = useSettingsSheet((s) => s.isOpen);
  const addOpen = useAddSheet((s) => s.isOpen);
  const editOpen = useEditSheet((s) => s.isOpen);
  const personOpen = useSelectedPerson((s) => !!s.name);
  const sagaOpen = useSelectedSaga((s) => !!s.key);
  const catalogOpen = useCatalogPreview((s) => !!s.target);
  const webViewerOpen = useWebViewer((s) => !!s.url);
  // La stessa regola del primo avvio (vedi `Onboarding`): si mostra a chi
  // apre con lo scaffale vuoto, o a chi l'ha chiesto. Ripetuta qui per non
  // scaricarlo a chi non lo vedrà — chi viene da una versione di prima ha la
  // libreria piena e nessuna riga «già fatto».
  const [emptyAtStart] = useState(() => useLibrary.getState().items.length === 0);
  const onboardingPending = useOnboarding((s) => s.replaying || (!s.done && emptyAtStart));
  const theme = useTheme((s) => s.theme);
  const accent = useTheme((s) => s.accent);
  useAutoLinkTmdb();
  useAutoLinkSagas();
  useReleaseAlerts();
  // Le frecce muovono il fuoco quando si è su un televisore: un ascoltatore
  // solo, spento del tutto altrove.
  useSpatialNav();
  // Mounted once here rather than per row: the playhead is written every few
  // seconds while something plays, and each listener costs a re-read.
  useWatchProgressSync();

  useEffect(() => {
    // Dark is the base theme, so the light variant is the one that opts in.
    document.documentElement.classList.toggle("light", theme === "light");
    // La barra di sistema prende il colore del fondo: con il tema chiaro una
    // striscia nera sopra la carta sembra un pezzo di un'altra app.
    const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
    if (bg) document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bg);
  }, [theme]);

  // Keyed on the theme too: each accent carries a dark and a light variant,
  // and reapplying on a theme change is what keeps a custom accent readable
  // after switching rather than leaving a night-tuned colour on a pale page.
  useEffect(() => {
    applyAccent(accent, theme);
  }, [accent, theme]);

  return (
    // Le animazioni scritte in JavaScript non sentono la regola CSS di
    // «riduci movimento»: senza questa riga fogli e avvisi continuavano a
    // scivolare per chi aveva chiesto di non vederli. Così si spengono
    // spostamenti e scale, e resta la dissolvenza.
    <MotionConfig reducedMotion="user">
      <a
        href="#main-content"
        className="skip-link rounded-sm bg-accent px-4 py-2 text-sm font-medium text-accent-contrast"
      >
        Vai al contenuto
      </a>
      <Nav />
      <div className="min-h-screen pb-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] pt-14 lg:pb-0 lg:pl-60 lg:pt-0">
        <OfflineBanner />
        <DataBanner />
        <main id="main-content">
          {/* Un confine solo per tutte le pagine: la navigazione di React Router
              passa da una transizione, quindi la pagina di prima resta a schermo
              finché quella nuova non è arrivata, e lo scheletro si vede solo
              quando l'attesa è davvero lunga. */}
          <Suspense fallback={<PageSkeleton />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/libreria" element={<Library />} />
            <Route path="/saghe" element={<Sagas />} />
            <Route path="/scopri" element={<Discover />} />
            <Route path="/cerca" element={<Search />} />
            <Route path="/tu" element={<Tu />} />
            {/* I due vecchi indirizzi restano vivi e portano dove è finito il
                loro contenuto: erano nella barra per mesi, quindi stanno nella
                cronologia dei browser e nelle scorciatoie sulla schermata
                Home. Un indirizzo che qualcuno ha salvato non si spegne, si
                inoltra. */}
            <Route path="/dati" element={<Navigate to="/tu" replace />} />
            <Route path="/profilo" element={<Navigate to="/tu" replace />} />
            <Route path="/critico" element={<Critic />} />
            <Route
              path="/diagnostica"
              element={
                <Suspense fallback={<PageSkeleton />}>
                  <Diagnostics />
                </Suspense>
              }
            />
            <Route
              path="/design-preview"
              element={
                <Suspense fallback={null}>
                  <DesignPreview />
                </Suspense>
              }
            />
            <Route
              path="/player"
              element={
                <Suspense fallback={<PageSkeleton variant="player" />}>
                  <Player />
                </Suspense>
              }
            />
          </Routes>
          </Suspense>
        </main>
      </div>
      <ToastStack />
      {/* Sopra la barra di navigazione e sotto i fogli: è la riga che dice
          cosa sta suonando, e da cui si rientra nel lettore. Ha preso il
          posto della voce «Player» in barra — un lettore che ha una scheda
          fra le destinazioni è una pagina, uno che ha una riga viva è
          un'applicazione. */}
      <MiniPlayerBar />
      <CommandPalette />
      <ItemDetailSheetPortal />
      <Deferred when={catalogOpen}>
        <CatalogSheetPortal />
      </Deferred>
      <Deferred when={sagaOpen}>
        <SagaSheetPortal />
      </Deferred>
      <Deferred when={personOpen}>
        <PersonSheetPortal />
      </Deferred>
      <Deferred when={addOpen}>
        <AddItemSheetPortal />
      </Deferred>
      <Deferred when={editOpen}>
        <EditItemSheetPortal />
      </Deferred>
      <Deferred when={settingsOpen}>
        <SettingsSheetPortal />
      </Deferred>
      <ResumePrompt />
      <NextChapterPrompt />
      <IncomingShare />
      <UpdatePrompt />
      {/* Il primo minuto. Sta in fondo perché copre tutto il resto, e si
          mostra da sé solo a libreria vuota: chi ha già uno scaffale ha
          superato questo passaggio molto tempo fa. */}
      <Deferred when={onboardingPending}>
        <Onboarding />
      </Deferred>
      {/* In fondo a tutto e fuori da ogni rotta: il Web Viewer si apre dalle
          Impostazioni, dal player e dalla scheda di un titolo, e da qualunque
          punto parta deve coprire lo schermo intero senza portarsi via la
          pagina che c'era. */}
      <Deferred when={webViewerOpen}>
        <WebViewer />
      </Deferred>
    </MotionConfig>
  );
}
