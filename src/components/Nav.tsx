import { NavLink } from "react-router-dom";
import { useTheme } from "../store/useTheme";
import { useCommandPalette } from "../store/useCommandPalette";
import { BookIcon, BookmarkIcon, CompassIcon, HomeIcon, MoonIcon, ReelMark, SearchIcon, SunIcon } from "./icons";

const NAV_ITEMS = [
  { to: "/", label: "Home", icon: HomeIcon, end: true },
  { to: "/scopri", label: "Scopri", icon: CompassIcon, end: false },
  { to: "/watchlist", label: "Watchlist", icon: BookmarkIcon, end: false },
  { to: "/diario", label: "Diario", icon: BookIcon, end: false },
] as const;

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
          onClick={openPalette}
          className="mb-5 flex items-center gap-2 rounded-sm border border-border-strong px-3 py-2 text-sm text-text-faint transition-colors hover:text-text-muted"
        >
          <SearchIcon size={16} />
          <span className="flex-1 text-left">Cerca…</span>
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
          <span className="text-xs text-text-faint">Il tuo diario, senza rumore.</span>
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
          <ThemeToggle compact />
        </div>
      </header>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Navigazione principale"
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden"
      >
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                isActive ? "text-accent-text" : "text-text-faint"
              }`
            }
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
