import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useLibrary } from "../store/useLibrary";
import { useAddSheet } from "../store/useAddSheet";
import { useLinkHosts } from "../store/useLinkHosts";
import { useSettingsSheet } from "../store/useSettingsSheet";
import { useSelectedItem } from "../store/useSelectedItem";
import { useTheme } from "../store/useTheme";
import { useWebViewer } from "../store/useWebViewer";
import { useVisibleItems } from "../lib/useVisibleItems";
import { useUpcoming } from "../lib/useUpcoming";
import { effectiveUrl, hostLabel, withProtocol } from "../lib/linkHost";
import { clearTmdbCaches } from "../lib/tmdb";
import { countdown, dayLabel } from "../lib/format";
import { BellIcon, DotsIcon, GearIcon, GlobeIcon, LinkIcon, MoonIcon, PersonIcon, PlusIcon, PulseIcon, RefreshIcon, SunIcon } from "./icons";

/**
 * I tre controlli in cima: i generi, le novità, il menu.
 *
 * Sono le tre cose che un'app di questo tipo tiene sempre a portata di pollice
 * e che qui stavano ognuna in fondo a una pagina diversa: filtrare per genere
 * voleva dire aprire Libreria e poi i filtri, sapere cosa esce voleva dire
 * andare in Scopri, e il Link Host stava tre tocchi dentro le Impostazioni.
 * Nessuna funzione nuova: le stesse, dove si cercano.
 */

const PANEL =
  "absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-md border border-border-strong bg-surface shadow-[var(--shadow-md)]";
const ROUND =
  "relative flex h-9 w-9 items-center justify-center rounded-full border border-border-strong text-text-muted transition-colors hover:text-text";

/**
 * Lo sfondo invisibile che chiude il menu al primo tocco fuori — e Esc, che è
 * il modo in cui un menu si chiude da tastiera in qualunque programma.
 */
function Backdrop({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return <button type="button" aria-label="Chiudi il menu" className="fixed inset-0 z-40 cursor-default" onClick={onClose} />;
}

function MenuItem({
  icon,
  label,
  hint,
  danger = false,
  onClick,
}: {
  icon?: ReactNode;
  label: string;
  hint?: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-surface-hover"
      style={danger ? { color: "var(--danger)" } : undefined}
    >
      {icon && <span className="shrink-0 text-text-faint">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-text" style={danger ? { color: "var(--danger)" } : undefined}>
          {label}
        </span>
        {hint && <span className="block truncate text-[11px] text-text-faint">{hint}</span>}
      </span>
    </button>
  );
}

/** La forma delle pastiglie della riga di scorciatoie: bordo sottile, testo pieno. */
const CHIP =
  "flex shrink-0 items-center gap-1.5 rounded-full border border-border-strong bg-surface-2 px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-surface-hover";

/**
 * I generi che hai davvero.
 *
 * L'elenco è preso dallo scaffale e non da una tabella di TMDB: una tendina che
 * offre «Western» a chi non possiede un western è un vicolo cieco con un nome
 * elegante. Porta in Libreria col filtro già messo, che è la pagina dove poi si
 * continua a restringere.
 */
function GenreMenu() {
  const items = useVisibleItems();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const genres = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      const genre = item.genre?.trim();
      if (genre) counts.set(genre, (counts.get(genre) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [items]);

  if (genres.length === 0) return null;

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu" className={CHIP}>
        Generi
        <span aria-hidden="true" className="text-text-faint">
          ⌄
        </span>
      </button>

      {open && (
        <>
          <Backdrop onClose={() => setOpen(false)} />
          <div className={`${PANEL} left-0 right-auto max-h-80 w-56 overflow-y-auto`} role="menu">
            {genres.map(([genre, count]) => (
              <button
                key={genre}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  navigate(`/libreria?genere=${encodeURIComponent(genre)}`);
                }}
                className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm text-text transition-colors hover:bg-surface-hover"
              >
                <span className="truncate">{genre}</span>
                <span className="font-mono tabular text-[11px] text-text-faint">{count}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Quanti giorni in avanti guarda la campanella: oltre, è un promemoria, non una novità. */
const ALERT_HORIZON_DAYS = 45;

/**
 * La campanella: cosa esce, di ciò che segui.
 *
 * Il pallino si accende solo quando c'è davvero una data entro un mese e mezzo.
 * Una campanella sempre accesa è una campanella che si smette di guardare dopo
 * due giorni.
 */
export function AlertsBell() {
  const upcoming = useUpcoming();
  const openItem = useSelectedItem((s) => s.open);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const soon = useMemo(
    () =>
      upcoming
        .filter((entry) => {
          const days = (new Date(`${entry.date}T00:00:00`).getTime() - Date.now()) / 86_400_000;
          return days >= -1 && days <= ALERT_HORIZON_DAYS;
        })
        .slice(0, 8),
    [upcoming],
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={soon.length ? `Novità: ${soon.length} in arrivo` : "Novità"}
        className={ROUND}
      >
        <BellIcon size={17} filled={soon.length > 0} />
        {soon.length > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2"
            style={{ background: "var(--accent)", borderColor: "var(--surface)" }}
          />
        )}
      </button>

      {open && (
        <>
          <Backdrop onClose={() => setOpen(false)} />
          <div className={`${PANEL} w-72`} role="menu">
            <p className="border-b border-border px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-faint">
              In arrivo
            </p>
            {soon.length === 0 ? (
              <p className="px-3.5 py-3 text-xs leading-relaxed text-text-faint">
                Niente in uscita nelle prossime settimane, fra le serie e i film che segui. Quando TMDB fissa una
                data, compare qui.
              </p>
            ) : (
              soon.map((entry) => (
                <button
                  key={`${entry.item.id}-${entry.date}`}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    openItem(entry.item);
                  }}
                  className="flex w-full items-baseline justify-between gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-surface-hover"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-text">{entry.item.title}</span>
                    <span className="block truncate text-[11px] text-text-faint">
                      {entry.season != null && entry.episode != null ? `S${entry.season}E${entry.episode} · ` : ""}
                      {dayLabel(entry.date)}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono tabular text-[11px]" style={{ color: "var(--accent-text)" }}>
                    {countdown(entry.date)}
                  </span>
                </button>
              ))
            )}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate("/scopri");
              }}
              className="block w-full border-t border-border px-3.5 py-2.5 text-left text-xs font-medium"
              style={{ color: "var(--accent-text)" }}
            >
              Apri il calendario →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Il menu dei tre puntini: le cose che si fanno *all'app*, non a un titolo.
 *
 * «Aggiorna contenuti» butta via quello che TMDB ha lasciato in cache — fino a
 * sei ore per una stagione, tutta la sessione per una locandina — ed è l'unica
 * risposta onesta a «è uscito ieri e qui non lo vedo». La libreria non la tocca:
 * quella è tua e non si ricarica da nessuna parte.
 */
export function QuickMenu() {
  const [open, setOpen] = useState(false);
  const openSettings = useSettingsSheet((s) => s.open);
  const openViewer = useWebViewer((s) => s.open);
  const openAddSheet = useAddSheet((s) => s.open);
  const pushToast = useLibrary((s) => s.pushToast);
  const hosts = useLinkHosts((s) => s.hosts);
  const theme = useTheme((s) => s.theme);
  const toggleTheme = useTheme((s) => s.toggle);
  const navigate = useNavigate();

  const firstHost = hosts.find((h) => h.enabled && h.url.trim());

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Altro"
        className={ROUND}
      >
        <DotsIcon size={17} />
      </button>

      {open && (
        <>
          <Backdrop onClose={() => setOpen(false)} />
          <div className={PANEL} role="menu">
            <MenuItem
              icon={<PlusIcon size={16} />}
              label="Aggiungi titolo"
              hint="A mano, senza passare da TMDB"
              onClick={() => {
                setOpen(false);
                openAddSheet();
              }}
            />
            <div className="border-t border-border" />
            <MenuItem
              icon={<LinkIcon size={16} />}
              label="Gestisci Link Host"
              hint={firstHost ? hostLabel(effectiveUrl(firstHost)) : "Nessun sito configurato"}
              onClick={() => {
                setOpen(false);
                openSettings("linkhost");
              }}
            />
            <MenuItem
              icon={<GlobeIcon size={16} />}
              label="Apri Web Viewer"
              hint={firstHost ? "Sul tuo primo sito attivo" : "Prima serve un sito nel Link Host"}
              onClick={() => {
                setOpen(false);
                if (firstHost) openViewer(withProtocol(effectiveUrl(firstHost)));
                else openSettings("linkhost");
              }}
            />
            <MenuItem
              icon={<RefreshIcon size={16} />}
              label="Aggiorna contenuti"
              hint="Riscarica da TMDB, senza toccare la libreria"
              onClick={() => {
                clearTmdbCaches();
                setOpen(false);
                pushToast("success", "Contenuti aggiornati: TMDB verrà richiesto di nuovo.");
              }}
            />

            <div className="border-t border-border">
              <MenuItem
                icon={<PersonIcon size={16} />}
                label="Profilo"
                onClick={() => {
                  setOpen(false);
                  navigate("/profilo");
                }}
              />
              <MenuItem
                icon={theme === "dark" ? <SunIcon size={16} /> : <MoonIcon size={16} />}
                label={theme === "dark" ? "Tema chiaro" : "Tema scuro"}
                onClick={() => {
                  toggleTheme();
                  setOpen(false);
                }}
              />
              <MenuItem
                icon={<PulseIcon size={16} />}
                label="Diagnostica"
                onClick={() => {
                  setOpen(false);
                  navigate("/diagnostica");
                }}
              />
              <MenuItem
                icon={<GearIcon size={16} />}
                label="Impostazioni"
                onClick={() => {
                  setOpen(false);
                  openSettings();
                }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * La riga delle scorciatoie, in cima alla Home: tipo, stato, generi.
 *
 * Stava in barra, accanto al logo, e lì era la cosa sbagliata nel posto
 * sbagliato: la barra è per ciò che riguarda *l'app* — le novità, le
 * impostazioni — mentre questo è un modo di guardare la libreria, cioè
 * contenuto. Sopra la vetrina, in una fila che scorre, è dove ogni app di
 * visione lo mette e dove il pollice arriva senza attraversare lo schermo.
 *
 * Ogni pastiglia porta in Libreria con un filtro già acceso: sono i tre tagli
 * che si fanno di continuo, e da lì il pannello dei filtri fa il resto.
 */
export function BrowseChips() {
  const items = useVisibleItems();
  const navigate = useNavigate();
  if (items.length === 0) return null;

  const has = (test: (i: (typeof items)[number]) => boolean) => items.some(test);
  const shortcuts = [
    { label: "Serie TV", to: "/libreria?tipo=serie", show: has((i) => i.kind === "serie" || i.kind === "anime") },
    { label: "Film", to: "/libreria?tipo=film", show: has((i) => i.kind === "film") },
    { label: "Da vedere", to: "/libreria?stato=Da+vedere", show: has((i) => i.status === "Da vedere") },
  ].filter((s) => s.show);

  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
      {shortcuts.map((s) => (
        <button key={s.to} type="button" onClick={() => navigate(s.to)} className={CHIP}>
          {s.label}
        </button>
      ))}
      <GenreMenu />
    </div>
  );
}
