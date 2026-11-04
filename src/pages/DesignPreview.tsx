import { useEffect, useId, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowUpRight,
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleUser,
  Clapperboard,
  Database,
  Download,
  Ellipsis,
  Eye,
  Film,
  Heart,
  House,
  Info,
  KeyRound,
  Layers,
  LibraryBig,
  LoaderCircle,
  MessageSquareQuote,
  Palette,
  Play,
  Plus,
  Popcorn,
  Search,
  ServerCog,
  Settings,
  Share,
  ShieldCheck,
  Star,
  Tv,
  WifiOff,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import "@fontsource-variable/newsreader/opsz.css";
import "../design-preview/preview.css";
import { useFocusTrap } from "../lib/useFocusTrap";
import { useTheme } from "../store/useTheme";

/**
 * La proposta di sistema di design, vista prima di toccare una sola pagina.
 *
 * Non è collegata alla navigazione e non legge la libreria: è una tavola di
 * campioni, e i campioni non devono dipendere dallo stato di chi la apre. Le
 * locandine sono vere (TMDB serve le immagini senza chiave), perché un sistema
 * pensato per un'app di film si giudica accanto a una locandina, non accanto a
 * un rettangolo grigio.
 */

type Theme = "dark" | "light";

const ICON = { size: 20, strokeWidth: 1.75 } as const;

const POSTERS = {
  dune: "/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg",
  interstellar: "/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
  oppenheimer: "/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
  parasite: "/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg",
  dark: "/apbrbWs8M9lyOpJYU5WXrpFbk1Z.jpg",
  bear: "/sHFlbKS3WLqMnp9t2ghADIJFnuQ.jpg",
  spirited: "/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg",
  chernobyl: "/hlLXt2tOPT6RRnjiUmoxyG1LTFi.jpg",
} as const;

const HERO_BACKDROP = "/xJHokMbljvjADYdit5fK5VQsXEG.jpg";

/*
 * L'indirizzo delle immagini scritto qui e non preso da `lib/tmdb`: importarlo
 * bastava a staccare quel modulo dal pacchetto principale in un pezzo a parte,
 * cioè una richiesta in più all'avvio dell'app per una pagina che quasi
 * nessuno apre.
 */
const tmdbImage = (path: string, size: "w185" | "w342" | "w1280") => `https://image.tmdb.org/t/p/${size}${path}`;

const NEUTRALS: { token: string; name: string; dark: string; light: string; role: string }[] = [
  { token: "--bg", name: "Fondo", dark: "#131211", light: "#f6f3ee", role: "La pagina" },
  { token: "--surface", name: "Superficie", dark: "#1c1b19", light: "#fdfcfa", role: "Fogli, elenchi, barra laterale" },
  { token: "--surface-2", name: "Riempimento", dark: "#262422", light: "#eeeae3", role: "Campi, pastiglie, bottoni secondari" },
  { token: "--surface-hover", name: "Sotto il dito", dark: "#302e2b", light: "#e5e0d7", role: "Hover e pressione" },
  { token: "--text", name: "Testo", dark: "#f3efe7", light: "#1c1a17", role: "16,3:1 · 15,7:1" },
  { token: "--text-muted", name: "Secondario", dark: "#b9b2a6", light: "#57524a", role: "8,9:1 · 7,0:1" },
  { token: "--text-faint", name: "Terziario", dark: "#a19a8f", light: "#645e54", role: "6,7:1 · 5,8:1" },
];

const COLORS: { token: string; name: string; dark: string; light: string; role: string }[] = [
  { token: "--accent", name: "Brace", dark: "#dc7a54", light: "#b0502c", role: "L'unico accento: azioni e stato attivo" },
  { token: "--success", name: "Riuscito", dark: "#93c08a", light: "#3d7536", role: "Visto, salvato, verificato" },
  { token: "--warning", name: "Attenzione", dark: "#e3b462", light: "#865900", role: "In pausa, da controllare" },
  { token: "--danger", name: "Errore", dark: "#f47c8b", light: "#b42a40", role: "Qualcosa va sistemato" },
];

const STATUSES: { label: string; dot: string; shape?: "ring" | "dash" }[] = [
  { label: "In visione", dot: "var(--status-watching)" },
  { label: "Visto", dot: "var(--status-done)" },
  { label: "Da vedere", dot: "var(--status-planned)", shape: "ring" },
  { label: "In pausa", dot: "var(--status-hold)" },
  { label: "Abbandonato", dot: "var(--status-dropped)", shape: "dash" },
];

const TYPE_ROLES: { cls: string; name: string; spec: string; sample: string }[] = [
  { cls: "ds-display", name: "Titolo grande", spec: "Newsreader 500 · 34→44 / 1,08", sample: "Stasera" },
  { cls: "ds-title", name: "Titolo", spec: "Newsreader 500 · 22 / 28", sample: "Continua a guardare" },
  { cls: "ds-headline", name: "Evidenza", spec: "Instrument Sans 600 · 16 / 24", sample: "Interstellar" },
  {
    cls: "ds-body",
    name: "Testo",
    spec: "Instrument Sans 400 · 16 / 24",
    sample:
      "Un gruppo di esploratori attraversa un wormhole nel tentativo di garantire la sopravvivenza dell'umanità.",
  },
  { cls: "ds-subhead", name: "Secondario", spec: "Instrument Sans 400–500 · 14 / 20", sample: "2014 · 2 h 49 min · Fantascienza" },
  { cls: "ds-footnote", name: "Nota", spec: "Instrument Sans 500 · 12 / 16", sample: "Restano 1 h 48 min" },
];

const ICONS: [LucideIcon, string][] = [
  [House, "Stasera"],
  [LibraryBig, "Libreria"],
  [Search, "Cerca"],
  [CircleUser, "Tu"],
  [Play, "Riproduci"],
  [Plus, "Aggiungi"],
  [Heart, "Preferito"],
  [Star, "Voto"],
  [Eye, "Visto"],
  [Share, "Condividi"],
  [Download, "Scarica"],
  [Layers, "Saghe"],
  [MessageSquareQuote, "Critico"],
  [Bell, "Novità"],
  [Settings, "Impostazioni"],
  [Ellipsis, "Altro"],
];

function Section({ id, title, intro, children }: { id: string; title: string; intro: string; children: ReactNode }) {
  return (
    <section className="ds-section" aria-labelledby={id}>
      <header>
        <h2 id={id} className="ds-title">
          {title}
        </h2>
        <p className="ds-subhead ds-muted ds-measure">{intro}</p>
      </header>
      {children}
    </section>
  );
}

function Swatch({ name, value, token, role, style }: { name: string; value: string; token: string; role: string; style?: CSSProperties }) {
  return (
    <div className="ds-swatch">
      <div style={{ background: `var(${token})`, ...style }} />
      <div>
        <p className="ds-subhead" style={{ fontWeight: 500 }}>
          {name} <span className="ds-faint ds-num">{value}</span>
        </p>
        <p className="ds-footnote ds-faint">{role}</p>
      </div>
    </div>
  );
}

function Poster({ title, path, status, vote, progress }: { title: string; path: string; status: (typeof STATUSES)[number]; vote?: number; progress?: number }) {
  return (
    <button type="button" className="ds-poster" aria-label={`${title}, ${status.label}${vote ? `, voto ${vote}` : ""}`}>
      <span className="ds-poster-art">
        <img src={tmdbImage(path, "w342")} alt="" loading="lazy" decoding="async" />
        {progress !== undefined && (
          <span className="ds-poster-progress" aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </span>
        )}
      </span>
      <span className="ds-poster-title">{title}</span>
      <span className="ds-poster-meta">
        <span className="ds-status" data-shape={status.shape} style={{ "--dot": status.dot } as CSSProperties}>
          {status.label}
        </span>
        {vote ? <span className="ds-vote">{vote}</span> : null}
      </span>
    </button>
  );
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const reduce = useReducedMotion();
  const group = useId();
  return (
    <div className="ds-segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}>
          {value === o.value && (
            <motion.span
              layoutId={`${group}-thumb`}
              className="ds-seg-thumb"
              transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
            />
          )}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className="ds-switch" onClick={() => onChange(!checked)}>
      <span />
    </button>
  );
}

function SampleSheet({ onClose }: { onClose: () => void }) {
  const ref = useFocusTrap(onClose);
  const reduce = useReducedMotion();
  const wide = typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches;
  const enter = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : wide
      ? { initial: { opacity: 0, scale: 0.97, y: 8 }, animate: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 0.98 } }
      : { initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%" } };
  return (
    <div className="ds-sheet-layer">
      <motion.div
        className="ds-scrim"
        aria-hidden="true"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ds-sheet-title"
        className="ds-sheet"
        {...enter}
        transition={reduce ? { duration: 0.15 } : wide ? { duration: 0.28, ease: [0.22, 1, 0.36, 1] } : { type: "spring", stiffness: 420, damping: 40 }}
      >
        <div className="ds-grabber" aria-hidden="true" />
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <p className="ds-footnote ds-faint">Saga · 3 capitoli</p>
            <h2 id="ds-sheet-title" className="ds-title" style={{ marginTop: 4 }}>
              Dune
            </h2>
          </div>
          <button type="button" className="ds-icon-btn ds-icon-btn-filled ds-icon-btn-sm" aria-label="Chiudi" onClick={onClose}>
            <X size={16} strokeWidth={2} />
          </button>
        </div>
        <p className="ds-body ds-muted" style={{ marginTop: 12 }}>
          Un foglio sale dal basso sul telefono e compare al centro sul computer. Si chiude con Esc, toccando fuori o con la
          ×, e restituisce il fuoco al bottone che l'ha aperto.
        </p>
        <div className="ds-list" style={{ marginTop: 24 }}>
          {[
            ["Dune", "2021 · Visto · 8"],
            ["Dune: Parte Due", "2024 · Da vedere"],
            ["Dune: Messia", "Annunciato"],
          ].map(([t, m], i) => (
            <button key={t} type="button" className="ds-row">
              <span className="ds-num ds-subhead ds-faint" style={{ width: 20, textAlign: "center" }}>
                {i + 1}
              </span>
              <span className="ds-row-text">
                <span className="ds-body">{t}</span>
                <span className="ds-subhead ds-muted">{m}</span>
              </span>
              <ChevronRight className="ds-chev" size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
          <button type="button" className="ds-btn ds-btn-primary ds-btn-lg" style={{ flex: 1 }} onClick={onClose}>
            <Play size={18} strokeWidth={2} fill="currentColor" aria-hidden="true" />
            Comincia la maratona
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function DesignPreview() {
  const appTheme = useTheme((s) => s.theme);
  const [theme, setTheme] = useState<Theme>(appTheme);
  const [chips, setChips] = useState<string[]>(["Serie TV"]);
  const [switchOn, setSwitchOn] = useState(true);
  const [order, setOrder] = useState<"uscita" | "cronologico" | "consigliato">("consigliato");
  const [sheet, setSheet] = useState(false);
  const [toast, setToast] = useState(false);
  const [saving, setSaving] = useState(false);
  const [key, setKey] = useState("4f1c9e");
  const [query, setQuery] = useState("Nolan");
  const [tab, setTab] = useState("Stasera");
  const [motionRun, setMotionRun] = useState(false);
  const reduce = useReducedMotion();

  // La grana dell'app sta sopra a tutto, anche sopra questa pagina: qui non
  // c'è, perché è una delle cose che la proposta toglie.
  useEffect(() => {
    document.documentElement.classList.add("ds-open");
    return () => document.documentElement.classList.remove("ds-open");
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(false), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const keyInvalid = key.length > 0 && key.length < 32;

  return (
    <div className="ds" data-theme={theme}>
      <div className="ds-topbar">
        <div className="ds-topbar-inner">
          <Link to="/" className="ds-btn ds-btn-plain ds-btn-sm" style={{ marginLeft: -12 }}>
            <ChevronLeft size={18} strokeWidth={2} aria-hidden="true" />
            App
          </Link>
          <Segmented
            label="Tema dell'anteprima"
            value={theme}
            onChange={setTheme}
            options={[
              { value: "dark", label: "Sera" },
              { value: "light", label: "Giorno" },
            ]}
          />
        </div>
      </div>

      <main className="ds-page">
        <header style={{ paddingTop: 48, display: "flex", flexDirection: "column", gap: 12 }}>
          <p className="ds-subhead ds-faint">CineMate · proposta di sistema di design</p>
          <h1 className="ds-display">Sala e carta</h1>
          <p className="ds-body ds-muted ds-measure">
            Un nero caldo per la sera, una carta calda per il giorno, un solo accento color brace. Il contenuto — le
            locandine — porta il colore; l'interfaccia si fa da parte. Niente di questa pagina tocca ancora l'app.
          </p>
        </header>

        {/* ----------------------------- Vetrina ---------------------------- */}
        <Section id="ds-hero" title="La vetrina" intro="Il primo pixel dell'app. Un titolo, un fatto, due azioni. Il bianco pieno è il gesto principale; il resto è vetro.">
          <div className="ds-hero">
            <img src={tmdbImage(HERO_BACKDROP, "w1280")} alt="" />
            <div className="ds-hero-shade" aria-hidden="true" />
            <div className="ds-hero-body">
              <p className="ds-footnote" style={{ color: "rgba(255,255,255,0.72)" }}>
                Ripreso dove l'avevi lasciato
              </p>
              <h3 className="ds-display">Interstellar</h3>
              <p className="ds-hero-meta ds-num">2014 · restano 1 h 12 min</p>
              <div className="ds-hero-actions">
                <button type="button" className="ds-btn ds-btn-media">
                  <Play size={18} strokeWidth={2} fill="currentColor" aria-hidden="true" />
                  Riprendi
                </button>
                <button type="button" className="ds-btn ds-btn-media-soft">
                  <Plus size={18} strokeWidth={2} aria-hidden="true" />
                  La mia lista
                </button>
                <button type="button" className="ds-icon-btn ds-icon-btn-media" aria-label="Altre info su Interstellar">
                  <Info {...ICON} />
                </button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
                <div className="ds-dots" aria-hidden="true">
                  <span aria-current="true" />
                  <span />
                  <span />
                  <span />
                </div>
                <button type="button" className="ds-footnote" style={{ color: "rgba(255,255,255,0.8)", padding: "8px 0" }}>
                  Un'altra
                </button>
              </div>
            </div>
          </div>
        </Section>

        {/* ----------------------------- Scaffale ---------------------------- */}
        <Section
          id="ds-shelf"
          title="Le righe"
          intro="Il titolo della riga in serif, una sola azione a destra. Sotto la locandina: titolo, stato con un punto, voto in cifre tabulari. Niente pastiglie colorate, niente cornici."
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="ds-row-head">
              <h3 className="ds-title">Continua a guardare</h3>
              <button type="button" className="ds-btn ds-btn-plain ds-btn-sm" style={{ marginRight: -12 }}>
                Vedi tutti
              </button>
            </div>
            <div className="ds-shelf">
              <Poster title="Oppenheimer" path={POSTERS.oppenheimer} status={STATUSES[0]} progress={40} />
              <Poster title="Dark" path={POSTERS.dark} status={STATUSES[0]} progress={54} />
              <Poster title="The Bear" path={POSTERS.bear} status={STATUSES[0]} vote={8} progress={32} />
              <Poster title="Interstellar" path={POSTERS.interstellar} status={STATUSES[1]} vote={9} />
              <Poster title="Parasite" path={POSTERS.parasite} status={STATUSES[1]} vote={9} />
              <Poster title="Dune: Parte Due" path={POSTERS.dune} status={STATUSES[2]} />
              <Poster title="La città incantata" path={POSTERS.spirited} status={STATUSES[3]} />
              <Poster title="Chernobyl" path={POSTERS.chernobyl} status={STATUSES[4]} vote={6} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} role="group" aria-label="Filtri della libreria">
            {["Serie TV", "Film", "Da vedere"].map((c) => (
              <button
                key={c}
                type="button"
                className="ds-chip"
                aria-pressed={chips.includes(c)}
                onClick={() => setChips((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]))}
              >
                {chips.includes(c) && <Check size={14} strokeWidth={2.25} aria-hidden="true" />}
                {c}
              </button>
            ))}
            <button type="button" className="ds-chip" aria-haspopup="menu">
              Generi <ChevronDown size={14} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        </Section>

        {/* ----------------------------- Colore ----------------------------- */}
        <Section
          id="ds-color"
          title="Colore"
          intro="Sette neutri caldi, un accento, tre colori di esito. Ogni coppia testo/fondo supera WCAG AA in entrambi i temi; i rapporti indicati sono sul fondo, sera · giorno."
        >
          <div className="ds-grid" style={{ "--min": "128px" } as CSSProperties}>
            {NEUTRALS.map((n) => (
              <Swatch key={n.token} name={n.name} token={n.token} value={theme === "dark" ? n.dark : n.light} role={n.role} />
            ))}
          </div>
          <div className="ds-grid" style={{ "--min": "200px" } as CSSProperties}>
            {COLORS.map((n) => (
              <Swatch key={n.token} name={n.name} token={n.token} value={theme === "dark" ? n.dark : n.light} role={n.role} />
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p className="ds-subhead" style={{ fontWeight: 500 }}>
              Gli stati della libreria
            </p>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              {STATUSES.map((s) => (
                <span key={s.label} className="ds-status" data-shape={s.shape} style={{ "--dot": s.dot, fontSize: 14 } as CSSProperties}>
                  {s.label}
                </span>
              ))}
            </div>
            <p className="ds-footnote ds-faint ds-measure">
              Erano cinque colori in cinque pastiglie. Ora tre colori che esistono già, più due forme: chi non distingue i
              colori distingue comunque un cerchio pieno da uno vuoto.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p className="ds-subhead" style={{ fontWeight: 500 }}>
              La scala dei voti
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 4 }}>
              {Array.from({ length: 10 }, (_, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
                  <div style={{ height: 32, width: "100%", borderRadius: 6, background: `var(--vote-${i + 1})` }} />
                  <span className="ds-footnote ds-faint ds-num">{i + 1}</span>
                </div>
              ))}
            </div>
            <p className="ds-footnote ds-faint ds-measure">
              Ancora da freddo a caldo, ma nei toni della carta invece che dell'arcobaleno. Vive nel Nastro e nel selettore
              del voto; sulle locandine il voto è una cifra, e la cifra basta.
            </p>
          </div>
        </Section>

        {/* ---------------------------- Tipografia --------------------------- */}
        <Section
          id="ds-type"
          title="Tipografia"
          intro="Sei ruoli, cinque corpi. Newsreader per i titoli, con il taglio ottico che si adatta alla misura; Instrument Sans per leggere e per i comandi. Le cifre stanno nel sans, in colonne: il mono resta a indirizzi e codici."
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            {TYPE_ROLES.map((r, i) => (
              <div
                key={r.cls}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr)",
                  gap: 4,
                  padding: "20px 0",
                  borderTop: i === 0 ? undefined : "1px solid var(--separator)",
                }}
              >
                <p className="ds-footnote ds-faint">
                  {r.name} · <span className="ds-num">{r.spec}</span>
                </p>
                <p className={r.cls}>{r.sample}</p>
              </div>
            ))}
          </div>
          <div className="ds-grid" style={{ "--min": "220px" } as CSSProperties}>
            <div>
              <p className="ds-footnote ds-faint">Cifre tabulari, nel sans</p>
              <p className="ds-num" style={{ fontSize: 28, fontWeight: 600, lineHeight: 1.2, marginTop: 4 }}>
                203 h · 1.118
              </p>
            </div>
            <div>
              <p className="ds-footnote ds-faint">Mono, solo per ciò che si copia</p>
              <p className="ds-mono" style={{ marginTop: 8 }}>
                https://mio-server.local/hls
              </p>
            </div>
          </div>
        </Section>

        {/* ------------------------- Spazio e forma -------------------------- */}
        <Section
          id="ds-space"
          title="Spazio, forma, profondità"
          intro="Passi da 4 e 8. Quattro raggi più la pillola. Tre livelli di profondità: di sera la dà la luce, di giorno l'ombra."
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[4, 8, 12, 16, 24, 32, 48, 64].map((s, i) => (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <span className="ds-footnote ds-faint ds-num" style={{ width: 64 }}>
                  space-{i + 1}
                </span>
                <span style={{ height: 12, width: s, borderRadius: 3, background: "var(--accent)" }} />
                <span className="ds-footnote ds-muted ds-num">{s}</span>
              </div>
            ))}
          </div>
          <div className="ds-grid" style={{ "--min": "140px" } as CSSProperties}>
            {[
              ["xs · 6", "6px", "Barre, segni"],
              ["sm · 10", "10px", "Locandine"],
              ["md · 14", "14px", "Bottoni, campi, elenchi"],
              ["lg · 24", "24px", "Fogli, vetrina"],
              ["pillola", "999px", "Pastiglie, icone"],
            ].map(([n, r, use]) => (
              <div key={n} className="ds-swatch">
                <div style={{ background: "var(--surface-2)", borderRadius: r, height: 72 }} />
                <div>
                  <p className="ds-subhead" style={{ fontWeight: 500 }}>
                    {n}
                  </p>
                  <p className="ds-footnote ds-faint">{use}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="ds-grid" style={{ "--min": "200px" } as CSSProperties}>
            {[
              ["shadow-1", "A riposo: elenchi, locandine"],
              ["shadow-2", "Sollevato: hover, avvisi, menu"],
              ["shadow-3", "Sopra tutto: fogli"],
            ].map(([s, use]) => (
              <div key={s} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ height: 96, borderRadius: 14, background: "var(--surface)", boxShadow: `var(--${s})` }} />
                <div>
                  <p className="ds-subhead" style={{ fontWeight: 500 }}>
                    {s}
                  </p>
                  <p className="ds-footnote ds-faint">{use}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ----------------------------- Movimento --------------------------- */}
        <Section
          id="ds-motion"
          title="Movimento"
          intro="Il tocco risponde in 100 ms; uno stato cambia in 200; qualcosa si sposta in 280; un foglio entra in 350, con una molla senza rimbalzo. Con «riduci movimento» attivo resta solo una dissolvenza."
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              ["Pressione", 100, "--ease-out"],
              ["Stato", 200, "--ease-out"],
              ["Spostamento", 280, "--ease-out"],
              ["Foglio", 350, "--ease-in-out"],
            ].map(([name, ms, ease]) => (
              <div key={name as string} style={{ display: "grid", gridTemplateColumns: "136px 1fr", alignItems: "center", gap: 16 }}>
                <span className="ds-subhead">
                  {name} <span className="ds-faint ds-num">{ms}</span>
                </span>
                <div className="ds-motion-track">
                  <span
                    className="ds-motion-dot"
                    style={{
                      transform: motionRun ? "translateX(calc(100cqw - 32px))" : "none",
                      transition: reduce ? "none" : `transform ${ms}ms var(${ease})`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div>
            <button type="button" className="ds-btn ds-btn-secondary ds-btn-sm" onClick={() => setMotionRun((v) => !v)}>
              <Play size={16} strokeWidth={2} aria-hidden="true" />
              {motionRun ? "Riporta indietro" : "Fai partire"}
            </button>
          </div>
        </Section>

        {/* ------------------------------ Icone ------------------------------ */}
        <Section
          id="ds-icons"
          title="Icone"
          intro="Un solo disegno: Lucide, griglia 24, tratto 1,75, estremità tonde. Oggi convivono due set con otto spessori diversi e una ventina di caratteri Unicode usati come icone (✕ ★ ✓ ←)."
        >
          <div className="ds-grid" style={{ "--min": "96px" } as CSSProperties}>
            {ICONS.map(([Icon, label]) => (
              <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "12px 0" }}>
                <Icon size={24} strokeWidth={1.75} aria-hidden="true" />
                <span className="ds-footnote ds-muted">{label}</span>
              </div>
            ))}
          </div>
          <p className="ds-footnote ds-faint ds-measure">
            Il Critico perde la scintilla: è il segno di ogni prodotto «con l'IA», e qui l'assistente è un critico che scrive,
            quindi una citazione.
          </p>
        </Section>

        {/* ----------------------------- Bottoni ----------------------------- */}
        <Section
          id="ds-buttons"
          title="Bottoni"
          intro="Un primario per schermata, al massimo. Il secondario è un riempimento, non un contorno. Le azioni minori sono testo. Ogni bottone ha almeno 44 punti toccabili, anche quando ne mostra 36."
        >
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" className="ds-btn ds-btn-primary">
              <Play size={18} strokeWidth={2} fill="currentColor" aria-hidden="true" />
              Riproduci
            </button>
            <button type="button" className="ds-btn ds-btn-secondary">
              <Plus size={18} strokeWidth={2} aria-hidden="true" />
              Aggiungi alla lista
            </button>
            <button type="button" className="ds-btn ds-btn-plain">
              Vedi tutti
            </button>
            <button type="button" className="ds-btn ds-btn-destructive">
              Rimuovi dalla libreria
            </button>
            <button type="button" className="ds-icon-btn ds-icon-btn-filled" aria-label="Preferito">
              <Heart {...ICON} />
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 16 }}>
            {[
              ["A riposo", ""],
              ["Sotto il puntatore", "is-hover"],
              ["Premuto", "is-pressed"],
              ["Fuoco da tastiera", "is-focus"],
            ].map(([label, cls]) => (
              <div key={label} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button type="button" tabIndex={-1} aria-hidden="true" className={`ds-btn ds-btn-primary ${cls}`}>
                  Salva
                </button>
                <span className="ds-footnote ds-faint">{label}</span>
              </div>
            ))}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button type="button" className="ds-btn ds-btn-primary" disabled>
                Salva
              </button>
              <span className="ds-footnote ds-faint">Disattivato</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                type="button"
                className="ds-btn ds-btn-primary"
                aria-busy={saving}
                onClick={() => {
                  if (saving) return;
                  setSaving(true);
                  window.setTimeout(() => {
                    setSaving(false);
                    setToast(true);
                  }, 1600);
                }}
              >
                {saving ? <LoaderCircle className="ds-spin" size={18} strokeWidth={2} aria-hidden="true" /> : null}
                {saving ? "Salvo…" : "Salva"}
              </button>
              <span className="ds-footnote ds-faint">In corso (toccalo)</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" className="ds-btn ds-btn-primary ds-btn-lg">
              Comincia
            </button>
            <button type="button" className="ds-btn ds-btn-secondary">
              Media
            </button>
            <button type="button" className="ds-btn ds-btn-secondary ds-btn-sm">
              Piccolo
            </button>
          </div>
        </Section>

        {/* ------------------------------ Campi ------------------------------ */}
        <Section
          id="ds-fields"
          title="Campi e controlli"
          intro="Campi pieni con un filo appena visibile, che si accendono al fuoco. L'errore dice cosa è successo e come si risolve, nella stessa riga."
        >
          <div className="ds-grid" style={{ "--min": "280px", alignItems: "start" } as CSSProperties}>
            <div className="ds-field">
              <label className="ds-label" htmlFor="ds-key">
                Chiave del catalogo
              </label>
              <input
                id="ds-key"
                className="ds-input ds-mono"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                aria-invalid={keyInvalid}
                aria-describedby="ds-key-msg"
                autoComplete="off"
                spellCheck={false}
              />
              {keyInvalid ? (
                <p id="ds-key-msg" className="ds-error">
                  <CircleAlert size={16} strokeWidth={2} aria-hidden="true" />
                  Mancano dei caratteri: le chiavi TMDB ne hanno 32. Copiala di nuovo da themoviedb.org, Impostazioni → API.
                </p>
              ) : (
                <p id="ds-key-msg" className="ds-help">
                  Resta su questo dispositivo.
                </p>
              )}
            </div>
            <div className="ds-field">
              <label className="ds-label" htmlFor="ds-note">
                Nota personale
              </label>
              <input id="ds-note" className="ds-input" placeholder="Rivisto al cinema, versione 70 mm" />
              <p className="ds-help">Facoltativa. La vedi solo tu.</p>
            </div>
            <div className="ds-field">
              <span className="ds-label" id="ds-search-label">
                Ricerca
              </span>
              <div className="ds-search">
                <Search size={18} strokeWidth={1.75} aria-hidden="true" />
                <input
                  className="ds-input"
                  aria-labelledby="ds-search-label"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Titoli, persone, saghe"
                />
                {query && (
                  <button type="button" className="ds-icon-btn ds-icon-btn-sm" aria-label="Svuota la ricerca" onClick={() => setQuery("")}>
                    <X size={16} strokeWidth={2} />
                  </button>
                )}
              </div>
              <p className="ds-help" aria-live="polite">
                {query ? "7 risultati" : "Scrivi per cercare"}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Switch label="Riproduci in automatico il prossimo episodio" checked={switchOn} onChange={setSwitchOn} />
              <span className="ds-body">Prossimo episodio in automatico</span>
            </div>
            <Segmented
              label="Ordine di visione"
              value={order}
              onChange={setOrder}
              options={[
                { value: "uscita", label: "Uscita" },
                { value: "cronologico", label: "Cronologico" },
                { value: "consigliato", label: "Consigliato" },
              ]}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 360 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="ds-subhead">Dark · stagione 2</span>
              <span className="ds-subhead ds-muted ds-num">14 di 26</span>
            </div>
            <div className="ds-progress" role="progressbar" aria-valuemin={0} aria-valuemax={26} aria-valuenow={14} aria-label="Episodi visti di Dark">
              <span style={{ width: "54%" }} />
            </div>
          </div>
        </Section>

        {/* ---------------------------- Elenchi ------------------------------ */}
        <Section
          id="ds-lists"
          title="Elenchi"
          intro="Le impostazioni come una lista di destinazioni: icona monocroma, una riga di spiegazione, la freccia. Separatori rientrati, nessun bordo intorno a ogni voce."
        >
          <div style={{ maxWidth: 560, display: "flex", flexDirection: "column", gap: 24 }}>
            {[
              {
                head: "Catalogo",
                rows: [
                  [KeyRound, "Chiavi e modello", "Copertine e trame da TMDB, il critico da Anthropic"],
                  [ServerCog, "Le tue sorgenti", "Dove stanno i tuoi video"],
                ],
              },
              {
                head: "App",
                rows: [
                  [Palette, "Aspetto", "Sera, giorno o come il sistema"],
                  [Tv, "Televisore", "Comandi grandi e frecce del telecomando"],
                  [ShieldCheck, "Controllo genitori", "Protetto da un PIN"],
                  [Database, "Dati e backup", "Esporta, importa, ricomincia"],
                ],
              },
            ].map((g) => (
              <div key={g.head}>
                <p className="ds-list-head">{g.head}</p>
                <div className="ds-list">
                  {g.rows.map(([Icon, t, d]) => {
                    const I = Icon as LucideIcon;
                    return (
                      <button key={t as string} type="button" className="ds-row">
                        <I {...ICON} aria-hidden="true" />
                        <span className="ds-row-text">
                          <span className="ds-body">{t as string}</span>
                          <span className="ds-subhead ds-muted">{d as string}</span>
                        </span>
                        <ChevronRight className="ds-chev" size={18} strokeWidth={1.75} aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* --------------------------- Navigazione --------------------------- */}
        <Section
          id="ds-nav"
          title="Navigazione"
          intro="Quattro destinazioni, uguali ovunque. Sul telefono una barra di vetro; da 1024 px una colonna laterale. Fra i due, la barra resta in basso: una colonna da 240 px su un tablet si mangia un terzo dello schermo."
        >
          <div className="ds-grid" style={{ "--min": "300px", alignItems: "end" } as CSSProperties}>
            <div className="ds-device" style={{ maxWidth: 390 }}>
              <div style={{ height: 300, position: "relative", overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, padding: 12 }}>
                  {[POSTERS.dune, POSTERS.dark, POSTERS.parasite, POSTERS.bear, POSTERS.spirited, POSTERS.interstellar].map((p) => (
                    <img key={p} src={tmdbImage(p, "w185")} alt="" style={{ borderRadius: 8, aspectRatio: "2/3", objectFit: "cover", width: "100%" }} />
                  ))}
                </div>
                <div style={{ position: "absolute", inset: "auto 0 0 0" }}>
                  <nav className="ds-tabbar" aria-label="Esempio di barra di navigazione">
                    {(
                      [
                        [House, "Stasera"],
                        [LibraryBig, "Libreria"],
                        [Search, "Cerca"],
                        [CircleUser, "Tu"],
                      ] as [LucideIcon, string][]
                    ).map(([Icon, label]) => (
                      <button key={label} type="button" className="ds-tab" aria-current={tab === label ? "page" : undefined} onClick={() => setTab(label)}>
                        <Icon size={24} strokeWidth={tab === label ? 2 : 1.75} aria-hidden="true" />
                        {label}
                      </button>
                    ))}
                  </nav>
                </div>
              </div>
            </div>
            <div className="ds-device" style={{ maxWidth: 260 }}>
              <div className="ds-sidebar">
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 12px 16px" }}>
                  <Clapperboard size={20} strokeWidth={1.75} aria-hidden="true" />
                  <span className="ds-title" style={{ fontSize: 20 }}>
                    CineMate
                  </span>
                </div>
                {(
                  [
                    [House, "Stasera"],
                    [LibraryBig, "Libreria"],
                    [Search, "Cerca"],
                    [CircleUser, "Tu"],
                  ] as [LucideIcon, string][]
                ).map(([Icon, label]) => (
                  <button key={label} type="button" className="ds-side-link" aria-current={tab === label ? "page" : undefined} onClick={() => setTab(label)}>
                    <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* ------------------------- Fogli e avvisi -------------------------- */}
        <Section
          id="ds-overlays"
          title="Fogli e avvisi"
          intro="Il foglio è la stanza accanto, non una finestra che salta fuori. L'avviso arriva in basso, dice cosa è successo e offre di tornare indietro."
        >
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button type="button" className="ds-btn ds-btn-secondary" onClick={() => setSheet(true)}>
              <Layers size={18} strokeWidth={1.75} aria-hidden="true" />
              Apri un foglio
            </button>
            <button type="button" className="ds-btn ds-btn-secondary" onClick={() => setToast(true)}>
              <Bell size={18} strokeWidth={1.75} aria-hidden="true" />
              Mostra un avviso
            </button>
          </div>
        </Section>

        {/* ------------------------------ Stati ------------------------------ */}
        <Section
          id="ds-states"
          title="Caricamento, vuoto, errore"
          intro="Lo scheletro ha la forma esatta di quello che arriva, così niente salta quando arriva. Il vuoto è un invito, l'errore una via d'uscita."
        >
          <div className="ds-grid" style={{ "--min": "280px", alignItems: "start" } as CSSProperties}>
            <div aria-hidden="true" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="ds-skel" style={{ height: 28, width: "55%", borderRadius: 8 }} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div className="ds-skel" style={{ aspectRatio: "2/3", borderRadius: 10 }} />
                    <div className="ds-skel" style={{ height: 12, width: "80%" }} />
                    <div className="ds-skel" style={{ height: 10, width: "50%" }} />
                  </div>
                ))}
              </div>
            </div>
            <div className="ds-state">
              <div className="ds-state-icon">
                <Popcorn size={24} strokeWidth={1.75} aria-hidden="true" />
              </div>
              <h3 className="ds-title">Non hai niente a metà</h3>
              <p className="ds-subhead ds-muted">È un buon momento per cominciare qualcosa. Da qui ripartirai sempre dal minuto esatto.</p>
              <button type="button" className="ds-btn ds-btn-primary" style={{ marginTop: 8 }}>
                Scegli per stasera
              </button>
            </div>
            <div className="ds-state" role="alert">
              <div className="ds-state-icon">
                <WifiOff size={24} strokeWidth={1.75} aria-hidden="true" />
              </div>
              <h3 className="ds-title">Il catalogo non risponde</h3>
              <p className="ds-subhead ds-muted">
                Sei offline o TMDB è lento. La tua libreria funziona lo stesso; copertine e ricerca tornano con la rete.
              </p>
              <button type="button" className="ds-btn ds-btn-secondary" style={{ marginTop: 8 }}>
                Riprova
              </button>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, maxWidth: 560 }} role="status">
            <CircleCheck size={20} strokeWidth={1.75} style={{ color: "var(--success)", flex: "none" }} aria-hidden="true" />
            <p className="ds-subhead">
              <span style={{ fontWeight: 600 }}>Chiave verificata.</span> <span className="ds-muted">Le copertine arrivano nei prossimi secondi.</span>
            </p>
          </div>
        </Section>

        <footer style={{ paddingTop: 64 }}>
          <hr className="ds-hairline" />
          <p className="ds-footnote ds-faint" style={{ paddingTop: 16 }}>
            Le pagine vere non sono cambiate. Questa tavola è l'unica cosa nuova.{" "}
            <Link to="/" style={{ color: "var(--accent-text)" }}>
              Torna all'app <ArrowUpRight size={12} strokeWidth={2} style={{ display: "inline", verticalAlign: "-1px" }} aria-hidden="true" />
            </Link>
          </p>
        </footer>
      </main>

      <AnimatePresence>{sheet && <SampleSheet onClose={() => setSheet(false)} />}</AnimatePresence>

      <div className="ds-toast-layer" aria-live="polite">
        <AnimatePresence>
          {toast && (
            <motion.div
              className="ds-toast"
              role="status"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <Film size={18} strokeWidth={1.75} style={{ color: "var(--text-muted)", flex: "none" }} aria-hidden="true" />
              <p className="ds-subhead" style={{ flex: 1 }}>
                «Dune: Parte Due» è nella tua lista
              </p>
              <button type="button" className="ds-btn ds-btn-plain ds-btn-sm" onClick={() => setToast(false)}>
                Annulla
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
