import { lazy, Suspense, useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import { Nav } from "./components/Nav";
import { ToastStack } from "./components/ToastStack";
import { CommandPalette } from "./components/CommandPalette";
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
import { useOnline } from "./lib/useOnline";
import { useTheme } from "./store/useTheme";
import { applyAccent } from "./lib/accents";
import { useLibrary } from "./store/useLibrary";
import { useAutoLinkTmdb } from "./lib/useAutoLinkTmdb";
import { useAutoLinkSagas } from "./lib/useAutoLinkSagas";
import { useReleaseAlerts } from "./lib/useReleaseAlerts";
import { useSpatialNav } from "./lib/useSpatialNav";
import { Home } from "./pages/Home";
import { Library } from "./pages/Library";
import { Sagas } from "./pages/Sagas";
import { Discover } from "./pages/Discover";
import { Search } from "./pages/Search";
import { Stats } from "./pages/Stats";
import { Profile } from "./pages/Profile";
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
      className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-2 px-4 py-2 text-xs text-text-muted sm:px-6"
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--danger)" }} />
      Sei offline: la tua libreria funziona tutta, ma la ricerca su TMDB, le copertine nuove e il
      critico restano in attesa della connessione.
    </div>
  );
}

function ErrorBanner() {
  const storageError = useLibrary((s) => s.storageError);
  const resetCorruptedData = useLibrary((s) => s.resetCorruptedData);
  if (!storageError) return null;
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5 text-sm sm:px-6"
      style={{ background: "var(--danger)", color: "var(--danger-contrast)", borderColor: "var(--danger)" }}
    >
      <span>I dati salvati sul dispositivo sembrano danneggiati e non possono essere letti.</span>
      <button
        type="button"
        onClick={resetCorruptedData}
        className="rounded-xs border border-current px-2.5 py-1 text-xs font-medium hover:opacity-80"
      >
        Ripristina dati locali
      </button>
    </div>
  );
}

export default function App() {
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
  }, [theme]);

  // Keyed on the theme too: each accent carries a dark and a light variant,
  // and reapplying on a theme change is what keeps a custom accent readable
  // after switching rather than leaving a night-tuned colour on a pale page.
  useEffect(() => {
    applyAccent(accent, theme);
  }, [accent, theme]);

  return (
    <>
      <a
        href="#main-content"
        className="skip-link rounded-sm bg-accent px-4 py-2 text-sm font-medium text-accent-contrast"
      >
        Vai al contenuto
      </a>
      <div className="grain-overlay" />
      <Nav />
      <div className="min-h-screen pb-16 pt-14 md:pb-0 md:pl-60 md:pt-0">
        <OfflineBanner />
        <ErrorBanner />
        <main id="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/libreria" element={<Library />} />
            <Route path="/saghe" element={<Sagas />} />
            <Route path="/scopri" element={<Discover />} />
            <Route path="/cerca" element={<Search />} />
            <Route path="/dati" element={<Stats />} />
            <Route path="/profilo" element={<Profile />} />
            <Route path="/critico" element={<Critic />} />
            <Route
              path="/diagnostica"
              element={
                <Suspense
                  fallback={
                    <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-text-faint sm:px-6">
                      Caricamento…
                    </div>
                  }
                >
                  <Diagnostics />
                </Suspense>
              }
            />
            <Route
              path="/player"
              element={
                <Suspense
                  fallback={
                    <div className="mx-auto max-w-4xl px-4 py-10 text-sm text-text-faint sm:px-6">
                      Caricamento del player…
                    </div>
                  }
                >
                  <Player />
                </Suspense>
              }
            />
          </Routes>
        </main>
      </div>
      <ToastStack />
      <CommandPalette />
      <ItemDetailSheetPortal />
      <SagaSheetPortal />
      <PersonSheetPortal />
      <AddItemSheetPortal />
      <EditItemSheetPortal />
      <SettingsSheetPortal />
      <ResumePrompt />
      <NextChapterPrompt />
      <IncomingShare />
      <UpdatePrompt />
      {/* In fondo a tutto e fuori da ogni rotta: il Web Viewer si apre dalle
          Impostazioni, dal player e dalla scheda di un titolo, e da qualunque
          punto parta deve coprire lo schermo intero senza portarsi via la
          pagina che c'era. */}
      <WebViewer />
    </>
  );
}
