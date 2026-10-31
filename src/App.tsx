import { lazy, Suspense, useEffect, useState } from "react";
import { MotionConfig } from "framer-motion";
import { Navigate, Route, Routes } from "react-router-dom";
import { Nav } from "./components/Nav";
// Il paese per «dove guardarlo» va impostato prima della prima scheda aperta,
// non quando si visita la pagina degli abbonamenti.
import "./store/useServices";
import { ToastStack } from "./components/ToastStack";
import { PageSkeleton } from "./components/Skeletons";
import { CommandPalette } from "./components/CommandPalette";
import { CatalogSheetPortal } from "./components/CatalogSheet";
import { ItemDetailSheetPortal } from "./components/ItemDetailSheet";
import { AddItemSheetPortal } from "./components/AddItemSheet";
import { EditItemSheetPortal } from "./components/EditItemSheet";
import { SettingsSheetPortal } from "./components/SettingsSheet";
import { SagaSheetPortal } from "./components/SagaSheet";
import { PersonSheetPortal } from "./components/PersonSheet";
import { NextChapterPrompt } from "./components/NextChapterPrompt";
import { ResumePrompt } from "./components/ResumePrompt";
import { IncomingShare } from "./components/IncomingShare";
import { UpdatePrompt } from "./components/UpdatePrompt";
import { WebViewer } from "./components/WebViewer";
import { Onboarding } from "./components/Onboarding";
import { MiniPlayerBar } from "./components/MiniPlayerBar";
import { ErrorIcon } from "./components/icons";
import { useOnline } from "./lib/useOnline";
import { useTheme } from "./store/useTheme";
import { applyAccent } from "./lib/accents";
import { useLibrary } from "./store/useLibrary";
import { useAutoLinkTmdb } from "./lib/useAutoLinkTmdb";
import { useAutoLinkSagas } from "./lib/useAutoLinkSagas";
import { useReleaseAlerts } from "./lib/useReleaseAlerts";
import { useLaunchAction } from "./lib/useLaunchAction";
import { useSpatialNav } from "./lib/useSpatialNav";
import { Home } from "./pages/Home";
import { Library } from "./pages/Library";
import { Sagas } from "./pages/Sagas";
import { Discover } from "./pages/Discover";
import { Search } from "./pages/Search";
import { Tu } from "./pages/Tu";
import { Critic } from "./pages/Critic";
import { useWatchProgressSync } from "./store/useWatchProgress";


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
// Le liste arrivano con la loro pagina: chi non ne ha non le scarica.
const Lists = lazy(() => import("./pages/Lists").then((m) => ({ default: m.Lists })));
const ListDetail = lazy(() => import("./pages/Lists").then((m) => ({ default: m.ListDetail })));
const Duo = lazy(() => import("./pages/Duo").then((m) => ({ default: m.Duo })));
const ThisOrThat = lazy(() => import("./pages/ThisOrThat").then((m) => ({ default: m.ThisOrThat })));
const Services = lazy(() => import("./pages/Services").then((m) => ({ default: m.Services })));
const ShareTarget = lazy(() => import("./pages/ShareTarget").then((m) => ({ default: m.ShareTarget })));

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
 * I dati del dispositivo non si leggono.
 *
 * Il bottone svuota libreria e diario, e lo faceva al primo tocco, senza dire
 * che cosa si sarebbe perso: un comando distruttivo travestito da «ripristina».
 * Adesso chiede una conferma che dice la conseguenza con parole sue, e solo al
 * secondo tocco fa quello che faceva prima.
 */
function ErrorBanner() {
  const storageError = useLibrary((s) => s.storageError);
  const storageUnavailable = useLibrary((s) => s.storageUnavailable);
  const resetCorruptedData = useLibrary((s) => s.resetCorruptedData);
  const [confirming, setConfirming] = useState(false);
  // Il database c'è ma oggi non si apre: niente è rovinato, quindi nessun
  // pulsante distruttivo. L'app non scrive niente finché non si riapre.
  if (storageUnavailable) {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6"
        style={{ background: "color-mix(in srgb, var(--warning) 14%, var(--bg))" }}
      >
        <span className="flex min-w-0 flex-1 basis-64 items-start gap-2.5 text-sm text-text">
          <span className="mt-0.5 shrink-0" style={{ color: "var(--warning)" }}>
            <ErrorIcon />
          </span>
          I tuoi dati sono al sicuro, ma questo avvio non riesce ad aprirli. Finché non si riaprono non salvo
          niente. Ricarica la pagina; se succede ancora, chiudi le altre schede di CineMate.
        </span>
        <button type="button" onClick={() => location.reload()} className="btn btn-secondary btn-sm">
          Ricarica
        </button>
      </div>
    );
  }
  if (!storageError) return null;
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
        {confirming
          ? "Libreria e diario di questo dispositivo verranno svuotati. Non si torna indietro."
          : "Non riesco a leggere i dati salvati su questo dispositivo."}
      </span>
      {confirming ? (
        <span className="flex gap-2">
          <button type="button" onClick={() => setConfirming(false)} className="btn btn-secondary btn-sm">
            Annulla
          </button>
          <button type="button" onClick={resetCorruptedData} className="btn btn-danger-fill btn-sm">
            Svuota e ricomincia
          </button>
        </span>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="btn btn-secondary btn-sm">
          Ricomincia da capo
        </button>
      )}
    </div>
  );
}

export default function App() {
  const theme = useTheme((s) => s.theme);
  const accent = useTheme((s) => s.accent);
  useAutoLinkTmdb();
  useAutoLinkSagas();
  useReleaseAlerts();
  useLaunchAction();
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
        <ErrorBanner />
        <main id="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/libreria" element={<Library />} />
            <Route path="/saghe" element={<Sagas />} />
            <Route
              path="/liste"
              element={
                <Suspense fallback={<PageSkeleton />}>
                  <Lists />
                </Suspense>
              }
            />
            <Route
              path="/liste/:id"
              element={
                <Suspense fallback={<PageSkeleton />}>
                  <ListDetail />
                </Suspense>
              }
            />
            <Route
              path="/stasera-in-due"
              element={
                <Suspense fallback={<PageSkeleton />}>
                  <Duo />
                </Suspense>
              }
            />
            <Route
              path="/questo-o-quello"
              element={
                <Suspense fallback={<PageSkeleton />}>
                  <ThisOrThat />
                </Suspense>
              }
            />
            <Route
              path="/abbonamenti"
              element={
                <Suspense fallback={<PageSkeleton />}>
                  <Services />
                </Suspense>
              }
            />
            <Route
              path="/condividi"
              element={
                <Suspense fallback={<PageSkeleton />}>
                  <ShareTarget />
                </Suspense>
              }
            />
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
      <CatalogSheetPortal />
      <SagaSheetPortal />
      <PersonSheetPortal />
      <AddItemSheetPortal />
      <EditItemSheetPortal />
      <SettingsSheetPortal />
      <ResumePrompt />
      <NextChapterPrompt />
      <IncomingShare />
      <UpdatePrompt />
      {/* Il primo minuto. Sta in fondo perché copre tutto il resto, e si
          mostra da sé solo a libreria vuota: chi ha già uno scaffale ha
          superato questo passaggio molto tempo fa. */}
      <Onboarding />
      {/* In fondo a tutto e fuori da ogni rotta: il Web Viewer si apre dalle
          Impostazioni, dal player e dalla scheda di un titolo, e da qualunque
          punto parta deve coprire lo schermo intero senza portarsi via la
          pagina che c'era. */}
      <WebViewer />
    </MotionConfig>
  );
}
