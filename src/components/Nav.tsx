import { NavLink } from "react-router-dom";
import { useTheme } from "../store/useTheme";
import { useCommandPalette } from "../store/useCommandPalette";
import { useAddSheet } from "../store/useAddSheet";
import { useSettingsSheet } from "../store/useSettingsSheet";
import { ChartIcon, CompassIcon, GearIcon, HomeIcon, BookIcon as LibraryIcon, MoonIcon, PlusIcon, ReelMark, SearchIcon, SparkleIcon, SunIcon } from "./icons";

const NAV_ITEMS = [
  { to: "/", label: "Home", icon: HomeIcon, end: true },
  { to: "/libreria", label: "Libreria", icon: LibraryIcon, end: false },
  { to: "/scopri", label: "Scopri", icon: CompassIcon, end: false },
  { to: "/dati", label: "Dati", icon: ChartIcon, end: false },
  { to: "/critico", label: "Critico", icon: SparkleIcon, end: false },
] as const;

// The floating add button owns the middle of the mobile bar, which only stays
// uncrowded with four tabs. Critico keeps its sidebar entry and is reachable
// from every title sheet, so it is the one to drop on small screens.
const MOBILE_ITEMS = NAV_ITEMS.filter((i) => i.to !== "/critico");

function linkClasses(isActive: boolean) {
  return `flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium transition-colors ${
    isActive ? "text-text" : "text-text-muted hover:text-text hover:bg-surface-hover"
  }`;
}

function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const theme = useTheme((s) => s.theme);
  const toggle = useTheme((s) => s.toggle);
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Attiva tema chiaro" : "Attiva tema scuro"}
      className={`flex items-center justify-center rounded-full border border-border-strong text-text-muted transition-colors hover:text-text ${compact ? "h-9 w-9" : "h-9 w-9"}`}
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

export function Nav() {
  const openPalette = useCommandPalette((s) => s.open);
  const openAddSheet = useAddSheet((s) => s.open);
  const openSettings = useSettingsSheet((s) => s.open);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border bg-surface px-4 py-5 md:flex">
        <div className="flex items-center gap-2.5 px-1 pb-6">
          <ReelMark />
          <span className="font-display text-lg font-semibold text-text">CineMate</span>
        </div>

        <button
          type="button"
          onClick={() => openAddSheet()}
          className="mb-2.5 flex items-center justify-center gap-2 rounded-sm px-3 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
        >
          <PlusIcon size={16} />
          Aggiungi titolo
        </button>

        <button
          type="button"
          onClick={openPalette}
          className="mb-5 flex items-center gap-2 rounded-sm border border-border-strong px-3 py-2 text-sm text-text-faint transition-colors hover:text-text-muted"
        >
          <SearchIcon size={16} />
          <span className="flex-1 text-left">Cerca nella libreria…</span>
          <kbd className="rounded-xs border border-border-strong px-1.5 py-0.5 font-sans text-[10px]">⌘K</kbd>
        </button>

        <nav aria-label="Navigazione principale" className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => linkClasses(isActive)}>
              {({ isActive }) => (
                <>
                  <Icon />
                  {label}
                  {isActive && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent)" }} />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center justify-between px-1 pt-4">
          <button
            type="button"
            onClick={openSettings}
            aria-label="Impostazioni"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border-strong text-text-muted transition-colors hover:text-text"
          >
            <GearIcon size={16} />
          </button>
          <ThemeToggle />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-surface/95 px-4 backdrop-blur-sm md:hidden">
        <div className="flex items-center gap-2">
          <ReelMark size={22} />
          <span className="font-display text-base font-semibold text-text">CineMate</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openPalette}
            aria-label="Cerca"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border-strong text-text-muted"
          >
            <SearchIcon size={17} />
          </button>
          <button
            type="button"
            onClick={openSettings}
            aria-label="Impostazioni"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border-strong text-text-muted"
          >
            <GearIcon size={16} />
          </button>
          <ThemeToggle compact />
        </div>
      </header>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Navigazione principale"
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden"
      >
        {MOBILE_ITEMS.map(({ to, label, icon: Icon, end }, idx) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                isActive ? "text-accent-text" : "text-text-faint"
              } ${idx === 1 ? "mr-6" : ""} ${idx === 2 ? "ml-6" : ""}`
            }
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => openAddSheet()}
          aria-label="Aggiungi titolo"
          className="absolute -top-5 left-1/2 flex h-[52px] w-[52px] -translate-x-1/2 items-center justify-center rounded-full border-[3px] shadow-[var(--shadow-md)]"
          style={{ background: "var(--accent)", color: "var(--accent-contrast)", borderColor: "var(--bg)" }}
        >
          <PlusIcon size={24} />
        </button>
      </nav>
    </>
  );
}
