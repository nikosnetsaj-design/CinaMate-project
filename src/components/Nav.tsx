import { NavLink } from "react-router-dom";
import { useTheme } from "../store/useTheme";
import { useCommandPalette } from "../store/useCommandPalette";
import { useAddSheet } from "../store/useAddSheet";
import { useSettingsSheet } from "../store/useSettingsSheet";
import { prefetchHandlers } from "../lib/prefetch";
import { ChartIcon, CompassIcon, GearIcon, HomeIcon, BookIcon as LibraryIcon, MoonIcon, PersonIcon, PlayIcon, PlusIcon, PulseIcon, ReelMark, SearchIcon, SparkleIcon, StackIcon, SunIcon } from "./icons";

const NAV_ITEMS = [
  { to: "/", label: "Home", icon: HomeIcon, end: true },
  { to: "/libreria", label: "Libreria", icon: LibraryIcon, end: false },
  { to: "/saghe", label: "Saghe", icon: StackIcon, end: false },
  { to: "/cerca", label: "Cerca", icon: SearchIcon, end: false },
  { to: "/scopri", label: "Scopri", icon: CompassIcon, end: false },
  { to: "/dati", label: "Dati", icon: ChartIcon, end: false },
  { to: "/profilo", label: "Profilo", icon: PersonIcon, end: false },
  { to: "/critico", label: "Critico", icon: SparkleIcon, end: false },
  { to: "/player", label: "Player", icon: PlayIcon, end: false },
  { to: "/diagnostica", label: "Diagnostica", icon: PulseIcon, end: false },
] as const;

// Critico keeps only its sidebar entry: it is reachable from every title and
// person sheet, so it is never the tap that strands you.
//
// Diagnostica is dropped from the bottom bar for a different reason: it is
// somewhere you go when something is wrong, not several times a day, and a
// seven-tab bar on a phone makes every tab harder to hit. It stays reachable
// from Impostazioni, which is on every screen.
//
// Player cannot be dropped either way. The sidebar is desktop-only, and
// nothing else on a phone links to it — leaving it out made the whole page
// unreachable on the device the app is meant to be installed on.
//
// Profilo is out of the bar but not off the phone: it gets the avatar button in
// the top bar instead, which is where a profile is looked for anyway. A seventh
// tab would have shrunk every other one to win a destination that already has a
// better place to live.
//
// Scopri cede il posto a Cerca, che sul telefono è la destinazione che si cerca
// per prima e che dentro contiene già il catalogo TMDB: Scopri resta nella
// barra laterale e dalla pagina Cerca non manca niente di ciò che offriva.
const MOBILE_ITEMS = NAV_ITEMS.filter(
  (i) => i.to !== "/critico" && i.to !== "/diagnostica" && i.to !== "/profilo" && i.to !== "/scopri",
);

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
            <NavLink
              key={to}
              to={to}
              end={end}
              {...prefetchHandlers(to)}
              className={({ isActive }) => linkClasses(isActive)}
            >
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
          <NavLink
            to="/cerca"
            {...prefetchHandlers("/cerca")}
            aria-label="Cerca"
            className={({ isActive }) =>
              `flex h-9 w-9 items-center justify-center rounded-full border ${
                isActive ? "border-accent text-accent-text" : "border-border-strong text-text-muted"
              }`
            }
          >
            <SearchIcon size={17} />
          </NavLink>
          <NavLink
            to="/profilo"
            {...prefetchHandlers("/profilo")}
            aria-label="Profilo"
            className={({ isActive }) =>
              `flex h-9 w-9 items-center justify-center rounded-full border ${
                isActive ? "border-accent text-accent-text" : "border-border-strong text-text-muted"
              }`
            }
          >
            <PersonIcon size={17} />
          </NavLink>
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

      {/* Mobile bottom tab bar. The add button floats clear of it rather than
          splitting it: with five destinations there is no middle left to take. */}
      <button
        type="button"
        onClick={() => openAddSheet()}
        aria-label="Aggiungi titolo"
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+4.6rem)] right-4 z-40 flex h-[52px] w-[52px] items-center justify-center rounded-full shadow-[var(--shadow-md)] md:hidden"
        style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
      >
        <PlusIcon size={24} />
      </button>
      <nav
        aria-label="Navigazione principale"
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden"
      >
        {MOBILE_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            {...prefetchHandlers(to)}
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
