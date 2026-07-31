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
import { useTheme } from "./store/useTheme";
import { applyAccent } from "./lib/accents";
import { useLibrary } from "./store/useLibrary";
import { useAutoLinkTmdb } from "./lib/useAutoLinkTmdb";
import { useAutoLinkSagas } from "./lib/useAutoLinkSagas";
import { useReleaseAlerts } from "./lib/useReleaseAlerts";
import { Home } from "./pages/Home";
import { Library } from "./pages/Library";
import { Sagas } from "./pages/Sagas";
import { Discover } from "./pages/Discover";
import { Stats } from "./pages/Stats";
import { Critic } from "./pages/Critic";
import { Diagnostics } from "./pages/Diagnostics";

/**
 * The player is the only route that needs hls.js, and hls.js alone is bigger
 * than the rest of the app put together. Splitting it out keeps the launch of
 * a diary app — which is what almost every visit is — as light as it was
 * before the player existed.
 */
const Player = lazy(() => import("./pages/Player").then((m) => ({ default: m.Player })));

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
        <ErrorBanner />
        <main id="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/libreria" element={<Library />} />
            <Route path="/saghe" element={<Sagas />} />
            <Route path="/scopri" element={<Discover />} />
            <Route path="/dati" element={<Stats />} />
            <Route path="/critico" element={<Critic />} />
            <Route path="/diagnostica" element={<Diagnostics />} />
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
    </>
  );
}
