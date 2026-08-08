import { NavLink } from "react-router-dom";
import { useTheme } from "../store/useTheme";
import { useCommandPalette } from "../store/useCommandPalette";
import { useAddSheet } from "../store/useAddSheet";
import { useSettingsSheet } from "../store/useSettingsSheet";
import { prefetchHandlers } from "../lib/prefetch";
import { AlertsBell, QuickMenu } from "./TopBar";
import { CompassIcon, GearIcon, HomeIcon, BookIcon as LibraryIcon, MoonIcon, PersonIcon, PlusIcon, ReelMark, SearchIcon, SparkleIcon, StackIcon, SunIcon } from "./icons";

/**
 * Quattro destinazioni, le stesse sul telefono e sul desktop.
 *
 * Erano dieci, e i motivi per cui ognuna stava lì erano tutti ragionevoli
 * uno per uno — è così che si arriva a dieci. Il problema non era la scelta
 * della decima: era che la lista si allungava per aggiunte locali senza che
 * nessuno la guardasse intera. Netflix ne ha quattro con diciottomila titoli,
 * Spotify tre. Una barra è un indice, e un indice di dieci voci si legge come
 * un menu.
 *
 * Le sei che sono uscite non hanno perso niente:
 *
 * - **Saghe** è una scheda dentro Libreria. Una saga è un modo di guardare lo
 *   scaffale, non un posto diverso in cui andare.
 * - **Scopri** è dentro Cerca, che è dove si cerca. Era già così sul telefono,
 *   e il commento diceva «non manca niente»: se era vero lì, era vero anche
 *   qui.
 * - **Dati** e **Profilo** erano due risposte alla stessa domanda, e adesso
 *   sono **Tu**. Che fossero la stessa cosa lo diceva il prodotto da solo:
 *   avevano due stati vuoti diversi per lo stesso «non hai ancora visto
 *   niente».
 * - **Critico** si invoca da ogni scheda. Un assistente è qualcosa che chiami,
 *   non un posto in cui vai.
 * - **Player** è diventato la mini-barra: compare quando c'è qualcosa a metà e
 *   ci riporta dentro con il titolo già scelto. Era in barra perché altrimenti
 *   sul telefono diventava irraggiungibile — un vincolo vero, risolto meglio.
 * - **Diagnostica** resta nelle Impostazioni, che stanno su ogni schermata. È
 *   dove si va quando qualcosa non va, non tre volte al giorno.
 */
const NAV_ITEMS = [
  { to: "/", label: "Stasera", icon: HomeIcon, end: true },
  { to: "/libreria", label: "Libreria", icon: LibraryIcon, end: false },
  { to: "/cerca", label: "Cerca", icon: SearchIcon, end: false },
  { to: "/tu", label: "Tu", icon: PersonIcon, end: false },
] as const;

/**
 * Le destinazioni che restano raggiungibili ma non occupano la barra: vivono
 * nel menu dei tre puntini e nelle Impostazioni, e sono elencate qui perché la
 * barra laterale del desktop ha lo spazio per offrirle come scorciatoie senza
 * far pesare la scelta principale.
 */
const SECONDARY = [
  { to: "/saghe", label: "Saghe", icon: StackIcon },
  { to: "/scopri", label: "Scopri", icon: CompassIcon },
  { to: "/critico", label: "Critico", icon: SparkleIcon },
] as const;

// Stessa barra sulle due sponde: si impara una interfaccia, non due.
const MOBILE_ITEMS = NAV_ITEMS;

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
              viewTransition
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

          {/* Le scorciatoie: stessa raggiungibilità, peso minore. Sul telefono
              queste stanno nel menu dei tre puntini — qui c'è la colonna, e
              una colonna vuota non è una virtù. */}
          <span className="mt-4 px-3 pb-1 t-label text-text-faint">Altro</span>
          {SECONDARY.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              {...prefetchHandlers(to)}
              viewTransition
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-sm px-3 py-2 text-[13px] transition-colors ${
                  isActive ? "text-text" : "text-text-faint hover:bg-surface-hover hover:text-text-muted"
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center justify-between px-1 pt-4">
          <button
            type="button"
            onClick={() => openSettings()}
            aria-label="Impostazioni"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border-strong text-text-muted transition-colors hover:text-text"
          >
            <GearIcon size={16} />
          </button>
          {/* Anche sul desktop: le novità e le scorciatoie all'app stanno dove
              stanno sul telefono, così non si impara due interfacce. */}
          <AlertsBell />
          <QuickMenu />
          <ThemeToggle />
        </div>
      </aside>

      {/* Mobile top bar.
          Due controlli a destra invece di quattro: Profilo, Impostazioni e il
          tema sono finiti dentro i tre puntini, dove stanno le cose che si
          fanno all'app. Qui resta solo quello: il modo di *guardare la
          libreria* — tipi, stati, generi — è sceso in cima alla Home, sopra la
          vetrina, dove il pollice arriva senza attraversare lo schermo. */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-surface/95 px-4 backdrop-blur-sm md:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <ReelMark size={22} />
          <span className="font-display text-base font-semibold text-text">CineMate</span>
        </div>
        <div className="flex items-center gap-2">
          <AlertsBell />
          <QuickMenu />
        </div>
      </header>

      {/* Il pulsante tondo «+» stava qui sopra, appeso sulla destra: galleggiava
          su ogni pagina e copriva stabilmente l'angolo di una copertina, di una
          riga di episodi, di un grafico. Aggiungere un titolo a mano è una cosa
          che si fa di rado — dalla ricerca si aggiunge dalla scheda — quindi è
          sceso dove stanno le altre azioni sull'app: il menu in cima. */}
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
            viewTransition
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
