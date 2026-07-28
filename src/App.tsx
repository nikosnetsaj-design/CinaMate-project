import { useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import { Nav } from "./components/Nav";
import { ToastStack } from "./components/ToastStack";
import { CommandPalette } from "./components/CommandPalette";
import { ItemDetailSheetPortal } from "./components/ItemDetailSheet";
import { AddItemSheetPortal } from "./components/AddItemSheet";
import { EditItemSheetPortal } from "./components/EditItemSheet";
import { SettingsSheetPortal } from "./components/SettingsSheet";
import { useTheme } from "./store/useTheme";
import { useLibrary } from "./store/useLibrary";
import { useAutoLinkTmdb } from "./lib/useAutoLinkTmdb";
import { Home } from "./pages/Home";
import { Library } from "./pages/Library";
import { Stats } from "./pages/Stats";
import { Critic } from "./pages/Critic";

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
  useAutoLinkTmdb();

  useEffect(() => {
    // Dark is the base theme, so the light variant is the one that opts in.
    document.documentElement.classList.toggle("light", theme === "light");
  }, [theme]);

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
            <Route path="/dati" element={<Stats />} />
            <Route path="/critico" element={<Critic />} />
          </Routes>
        </main>
      </div>
      <ToastStack />
      <CommandPalette />
      <ItemDetailSheetPortal />
      <AddItemSheetPortal />
      <EditItemSheetPortal />
      <SettingsSheetPortal />
    </>
  );
}
