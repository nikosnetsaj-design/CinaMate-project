import { useMemo } from "react";
import type { ReactNode } from "react";
import { Sheet } from "./Sheet";
import { STATUSES } from "../lib/status";
import {
  activeFilterCount,
  audioLangOptions,
  countryLabel,
  countryOptions,
  genreOptions,
  languageLabel,
  qualityOptions,
  studioOptions,
  type Filters,
} from "../lib/filters";
import { QUALITIES, type Item, type Kind, type Status, type Quality } from "../types";

const KINDS: { value: Kind; label: string }[] = [
  { value: "film", label: "Film" },
  { value: "serie", label: "Serie TV" },
  { value: "anime", label: "Anime" },
  { value: "doc", label: "Documentario" },
];

/** Ranges people actually think in, rather than a pair of free-number boxes. */
const RUNTIME_BANDS: { label: string; min?: number; max?: number }[] = [
  { label: "Sotto 90′", max: 89 },
  { label: "90–120′", min: 90, max: 120 },
  { label: "Oltre 120′", min: 121 },
];

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-[0.08em] text-text-faint">{label}</span>
      {children}
      {hint && <span className="text-xs text-text-faint">{hint}</span>}
    </div>
  );
}

function Select({
  value,
  onChange,
  children,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  label: string;
}) {
  return (
    <select
      value={value}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-sm border border-border-strong bg-surface px-2.5 py-2 text-sm text-text"
    >
      {children}
    </select>
  );
}

function Chips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (v: T | undefined) => void;
  label: string;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? undefined : o.value)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              active ? "border-transparent" : "border-border-strong text-text-muted hover:bg-surface-hover"
            }`}
            style={active ? { background: "var(--accent)", color: "var(--accent-contrast)" } : undefined}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function FilterSheet({
  items,
  filters,
  onChange,
  onClose,
  resultCount,
}: {
  items: Item[];
  filters: Filters;
  onChange: (next: Filters) => void;
  onClose: () => void;
  resultCount: number;
}) {
  // Built from the shelf, so every option on offer matches at least one title.
  const options = useMemo(
    () => ({
      genres: genreOptions(items),
      studios: studioOptions(items),
      countries: countryOptions(items),
      audio: audioLangOptions(items),
      qualities: qualityOptions(items),
    }),
    [items],
  );

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    const next = { ...filters };
    if (value === undefined || value === "") delete next[key];
    else next[key] = value;
    onChange(next);
  };

  const activeBand = RUNTIME_BANDS.find(
    (b) => b.min === filters.runtimeMin && b.max === filters.runtimeMax,
  );

  const count = activeFilterCount(filters);
  const years = items.map((i) => i.year).filter((y) => y > 0);
  const earliest = years.length ? Math.min(...years) : 1900;
  const latest = years.length ? Math.max(...years) : new Date().getFullYear();

  return (
    <Sheet onClose={onClose} titleId="filtri-title">
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <div>
          <h2 id="filtri-title" className="font-display text-2xl font-semibold text-text">
            Filtri
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            {resultCount} {resultCount === 1 ? "titolo" : "titoli"}
            {count > 0 && ` · ${count} ${count === 1 ? "filtro attivo" : "filtri attivi"}`}
          </p>
        </div>

        <Field label="Tipo">
          <Chips options={KINDS} value={filters.kind} onChange={(v) => set("kind", v)} label="Tipo" />
        </Field>

        <Field label="Stato">
          <Chips
            options={STATUSES.map((s) => ({ value: s as Status, label: s }))}
            value={filters.status}
            onChange={(v) => set("status", v)}
            label="Stato"
          />
        </Field>

        <Field label="Durata">
          <Chips
            options={RUNTIME_BANDS.map((b) => ({ value: b.label, label: b.label }))}
            value={activeBand?.label}
            onChange={(label) => {
              const band = RUNTIME_BANDS.find((b) => b.label === label);
              onChange({ ...filters, runtimeMin: band?.min, runtimeMax: band?.max });
            }}
            label="Durata"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Dal">
            <input
              type="number"
              inputMode="numeric"
              min={earliest}
              max={latest}
              value={filters.yearFrom ?? ""}
              placeholder={String(earliest)}
              aria-label="Anno minimo"
              onChange={(e) => set("yearFrom", e.target.value ? Number(e.target.value) : undefined)}
              className="rounded-sm border border-border-strong bg-surface px-2.5 py-2 font-mono text-sm text-text"
            />
          </Field>
          <Field label="Al">
            <input
              type="number"
              inputMode="numeric"
              min={earliest}
              max={latest}
              value={filters.yearTo ?? ""}
              placeholder={String(latest)}
              aria-label="Anno massimo"
              onChange={(e) => set("yearTo", e.target.value ? Number(e.target.value) : undefined)}
              className="rounded-sm border border-border-strong bg-surface px-2.5 py-2 font-mono text-sm text-text"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Il tuo voto" hint={filters.voteMin ? `da ${filters.voteMin} in su` : "qualsiasi"}>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={filters.voteMin ?? 0}
              aria-label="Voto minimo tuo"
              onChange={(e) => set("voteMin", Number(e.target.value) || undefined)}
            />
          </Field>
          <Field
            label="Voto TMDB"
            hint={filters.tmdbRatingMin ? `da ${filters.tmdbRatingMin} in su` : "qualsiasi"}
          >
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={filters.tmdbRatingMin ?? 0}
              aria-label="Voto TMDB minimo"
              onChange={(e) => set("tmdbRatingMin", Number(e.target.value) || undefined)}
            />
          </Field>
        </div>

        <Field label="Genere">
          <Select value={filters.genre ?? ""} onChange={(v) => set("genre", v || undefined)} label="Genere">
            <option value="">Tutti</option>
            {options.genres.map((o) => (
              <option key={o.value} value={o.value}>
                {o.value} ({o.count})
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Studio"
          hint={options.studios.length === 0 ? "Arriva da TMDB: aggiungi la chiave in Impostazioni." : undefined}
        >
          <Select value={filters.studio ?? ""} onChange={(v) => set("studio", v || undefined)} label="Studio">
            <option value="">Tutti</option>
            {options.studios.map((o) => (
              <option key={o.value} value={o.value}>
                {o.value} ({o.count})
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Paese">
          <Select value={filters.country ?? ""} onChange={(v) => set("country", v || undefined)} label="Paese">
            <option value="">Tutti</option>
            {options.countries.map((o) => (
              <option key={o.value} value={o.value}>
                {countryLabel(o.value)} ({o.count})
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Audio">
          <Select value={filters.audioLang ?? ""} onChange={(v) => set("audioLang", v || undefined)} label="Audio">
            <option value="">Tutti</option>
            {options.audio.map((o) => (
              <option key={o.value} value={o.value}>
                {languageLabel(o.value)} ({o.count})
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Qualità"
          hint="La qualità della copia che hai tu: si imposta nella scheda del titolo."
        >
          <Chips
            options={QUALITIES.map((q) => ({
              value: q as Quality,
              label: `${q}${options.qualities.find((o) => o.value === q)?.count ? ` (${options.qualities.find((o) => o.value === q)?.count})` : ""}`,
            }))}
            value={filters.quality}
            onChange={(v) => set("quality", v)}
            label="Qualità"
          />
        </Field>

        <label className="flex items-center gap-2.5 text-sm text-text">
          <input
            type="checkbox"
            checked={!!filters.hasSubtitles}
            onChange={(e) => set("hasSubtitles", e.target.checked || undefined)}
            className="h-4 w-4"
          />
          Solo titoli con sottotitoli configurati
        </label>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onChange({})}
            disabled={count === 0}
            className="flex-1 rounded-sm border border-border-strong px-4 py-2.5 text-sm font-medium text-text disabled:opacity-40 hover:bg-surface-hover"
          >
            Azzera
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-sm px-4 py-2.5 text-sm font-medium"
            style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
          >
            Vedi {resultCount} {resultCount === 1 ? "titolo" : "titoli"}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
