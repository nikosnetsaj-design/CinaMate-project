import { Link, NavLink, useLocation } from "react-router-dom";
import { useTheme } from "../store/useTheme";
import { useCommandPalette } from "../store/useCommandPalette";
import { useAddSheet } from "../store/useAddSheet";
import { useSettingsSheet } from "../store/useSettingsSheet";
import { prefetchHandlers, settingsPrefetchHandlers } from "../lib/prefetch";
import { AlertsBell, QuickMenu } from "./TopBar";
import { CompassIcon, GearIcon, HomeIcon, BookIcon as LibraryIcon, MoonIcon, PersonIcon, PlusIcon, ReelMark, SearchIcon, SparkleIcon, SunIcon } from "./icons";

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
  { to: "/", label: "Stasera", icon: HomeIcon },
  { to: "/libreria", label: "Libreria", icon: LibraryIcon },
  { to: "/cerca", label: "Cerca", icon: SearchIcon },
  { to: "/tu", label: "Tu", icon: PersonIcon },
] as const;

/**
 * Le destinazioni che restano raggiungibili ma non occupano la barra: vivono
 * nel menu dei tre puntini e nelle Impostazioni, e sono elencate qui perché la
 * barra laterale del desktop ha lo spazio per offrirle come scorciatoie senza
 * far pesare la scelta principale.
 */
const SECONDARY = [
  // Saghe non c'è più: è la seconda scheda della Libreria (LibraryTabs), e
  // qui sarebbe stata una seconda voce accesa accanto a «Libreria».
  { to: "/scopri", label: "Scopri", icon: CompassIcon },
  { to: "/critico", label: "Critico", icon: SparkleIcon },
] as const;

// Stessa barra sulle due sponde: si impara una interfaccia, non due.
const MOBILE_ITEMS = NAV_ITEMS;

/** Le pagine che la barra chiama «Libreria»: le tre schede di `LibraryTabs`. */
const LIBRARY_PATHS = ["/libreria", "/saghe", "/liste"];

/**
 * Se la voce è accesa. Per «Libreria» non basta l'indirizzo esatto: le saghe e
 * le liste sono schede della stessa pagina, e uscire dalla voce accesa solo
 * perché si è cambiata scheda direbbe che si è andati da un'altra parte.
 *
 * Calcolato qui e non lasciato a `NavLink`, che sa confrontare un indirizzo
 * solo: per le tre pagine della Libreria avrebbe acceso il colore ma non
 * `aria-current`, e un lettore di schermo avrebbe detto che non sei da
 * nessuna parte.
 */
function useActiveFor() {
  const { pathname } = useLocation();
  const matches = (p: string) => pathname === p || pathname.startsWith(`${p}/`);
  return (to: string) => (to === "/" ? pathname === "/" : to === "/libreria" ? LIBRARY_PATHS.some(matches) : matches(to));
}

/* La voce attiva ha un fondo, non un pallino d'accento: si vede dove sei
   senza che la colonna abbia un punto acceso in più. */
function linkClasses(isActive: boolean) {
  return `flex h-10 items-center gap-3 rounded-sm px-3 text-sm font-medium transition-colors ${
    isActive ? "bg-surface-2 text-text" : "text-text-muted hover:bg-surface-2 hover:text-text"
  }`;
}

function ThemeToggle() {
  const theme = useTheme((s) => s.theme);
  const toggle = useTheme((s) => s.toggle);
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Attiva tema chiaro" : "Attiva tema scuro"}
      className="icon-btn icon-btn-sm"
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

export function Nav() {
  const activeFor = useActiveFor();
  const openPalette = useCommandPalette((s) => s.open);
  const openAddSheet = useAddSheet((s) => s.open);
  const openSettings = useSettingsSheet((s) => s.open);

  return (
    <>
      {/* Desktop sidebar */}
      {/* Da 1024 px. Prima compariva a 768: su un iPad in verticale la colonna
          da 240 px si prendeva un terzo dello schermo, e sotto quella misura
          la barra in basso fa lo stesso lavoro occupando una riga. */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col bg-surface px-3 py-5 lg:flex">
        <div className="flex items-center gap-2.5 px-2 pb-6">
          <ReelMark />
          <span className="font-display text-xl text-text">CineMate</span>
        </div>

        <button
          type="button"
          onClick={() => openAddSheet()}
          className="btn btn-primary mb-2.5"
        >
          <PlusIcon size={16} />
          Aggiungi titolo
        </button>

        {/* Ha la forma di un campo perché si comporta come un campo: si tocca e
            si scrive. Il segnaposto dice tutto quello che la palette cerca. */}
        <button
          type="button"
          onClick={openPalette}
          className="mb-5 flex h-10 items-center gap-2 rounded-sm bg-surface-2 px-3 text-sm text-text-faint transition-colors hover:text-text-muted"
        >
          <SearchIcon size={16} />
          <span className="min-w-0 flex-1 truncate text-left">Titolo, persona, saga</span>
          <kbd className="rounded-xs bg-surface px-1.5 py-0.5 font-sans text-xs">⌘K</kbd>
        </button>

        <nav aria-label="Navigazione principale" className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              {...prefetchHandlers(to)}
              viewTransition
              aria-current={activeFor(to) ? "page" : undefined}
              className={linkClasses(activeFor(to))}
            >
              <Icon />
              {label}
            </Link>
          ))}

          {/* Le scorciatoie: stessa raggiungibilità, peso minore. Sul telefono
              queste stanno nel menu dei tre puntini — qui c'è la colonna, e
              una colonna vuota non è una virtù. */}
          <span className="mt-5 px-3 pb-1 t-label text-text-faint">Altro</span>
          {SECONDARY.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              {...prefetchHandlers(to)}
              viewTransition
              className={({ isActive }) =>
                `flex h-9 items-center gap-3 rounded-sm px-3 text-sm transition-colors ${
                  isActive ? "bg-surface-2 text-text" : "text-text-muted hover:bg-surface-2 hover:text-text"
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center justify-between px-1 pt-4 text-text-muted">
          <button
            type="button"
            onClick={() => openSettings()}
            {...settingsPrefetchHandlers()}
            aria-label="Impostazioni"
            className="icon-btn icon-btn-filled icon-btn-sm"
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
      {/* Vetro e un filo, non una barra piena con il bordo: il contenuto
          scorre sotto e si intravede, che è il modo in cui una barra dice di
          stare sopra e non accanto. */}
      <header
        className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between bg-material px-4 backdrop-blur-xl backdrop-saturate-150 lg:hidden"
        style={{ boxShadow: "inset 0 -1px 0 var(--separator)" }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <ReelMark size={22} />
          <span className="font-display text-xl text-text">CineMate</span>
        </div>
        <div className="-mr-2 flex items-center">
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
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around bg-material pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 lg:hidden"
        style={{ boxShadow: "inset 0 1px 0 var(--separator)" }}
      >
        {MOBILE_ITEMS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            {...prefetchHandlers(to)}
            viewTransition
            aria-current={activeFor(to) ? "page" : undefined}
            className={`flex h-[var(--tabbar-h)] flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
              activeFor(to) ? "text-accent-text" : "text-text-faint"
            }`}
          >
            <Icon size={24} />
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
