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
import { statusLabel, t } from "../lib/i18n";

const KINDS: { value: Kind; label: string }[] = [
  { value: "film", label: t("FilterSheet.film") },
  { value: "serie", label: t("FilterSheet.serie_tv") },
  { value: "anime", label: "Anime" },
  { value: "doc", label: t("FilterSheet.documentario") },
];

/** Ranges people actually think in, rather than a pair of free-number boxes. */
const RUNTIME_BANDS: { label: string; min?: number; max?: number }[] = [
  { label: t("FilterSheet.sotto_90"), max: 89 },
  { label: "90–120′", min: 90, max: 120 },
  { label: t("FilterSheet.oltre_120"), min: 121 },
];

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-text">{label}</span>
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
      className="field field-sm w-auto"
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
            className="chip"
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
          <h2 id="filtri-title" className="t-title text-text">
            {t("FilterSheet.filtri")}
          </h2>
          <p className="mt-1 text-sm tabular text-text-muted">
            {resultCount} {resultCount === 1 ? t("FilterSheet.titolo") : t("FilterSheet.titoli")}
            {count > 0 && ` · ${count} ${count === 1 ? t("FilterSheet.filtro_attivo") : t("FilterSheet.filtri_attivi")}`}
          </p>
        </div>

        <Field label={t("FilterSheet.tipo")}>
          <Chips options={KINDS} value={filters.kind} onChange={(v) => set("kind", v)} label={t("FilterSheet.tipo")} />
        </Field>

        <Field label={t("FilterSheet.stato")}>
          <Chips
            options={STATUSES.map((s) => ({ value: s as Status, label: statusLabel(s) }))}
            value={filters.status}
            onChange={(v) => set("status", v)}
            label={t("FilterSheet.stato")}
          />
        </Field>

        <Field label={t("FilterSheet.durata")}>
          <Chips
            options={RUNTIME_BANDS.map((b) => ({ value: b.label, label: b.label }))}
            value={activeBand?.label}
            onChange={(label) => {
              const band = RUNTIME_BANDS.find((b) => b.label === label);
              onChange({ ...filters, runtimeMin: band?.min, runtimeMax: band?.max });
            }}
            label={t("FilterSheet.durata")}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label={t("FilterSheet.dal")}>
            <input
              type="number"
              inputMode="numeric"
              min={earliest}
              max={latest}
              value={filters.yearFrom ?? ""}
              placeholder={String(earliest)}
              aria-label={t("FilterSheet.anno_minimo")}
              onChange={(e) => set("yearFrom", e.target.value ? Number(e.target.value) : undefined)}
              className="field field-sm w-auto tabular"
            />
          </Field>
          <Field label={t("FilterSheet.al")}>
            <input
              type="number"
              inputMode="numeric"
              min={earliest}
              max={latest}
              value={filters.yearTo ?? ""}
              placeholder={String(latest)}
              aria-label={t("FilterSheet.anno_massimo")}
              onChange={(e) => set("yearTo", e.target.value ? Number(e.target.value) : undefined)}
              className="field field-sm w-auto tabular"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label={t("FilterSheet.il_tuo_voto")} hint={filters.voteMin ? t("FilterSheet.da_in_su", { v0: filters.voteMin }) : t("FilterSheet.qualsiasi")}>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={filters.voteMin ?? 0}
              aria-label={t("FilterSheet.voto_minimo_tuo")}
              onChange={(e) => set("voteMin", Number(e.target.value) || undefined)}
            />
          </Field>
          <Field
            label={t("FilterSheet.voto_tmdb")}
            hint={filters.tmdbRatingMin ? t("FilterSheet.da_in_su", { v0: filters.tmdbRatingMin }) : t("FilterSheet.qualsiasi")}
          >
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={filters.tmdbRatingMin ?? 0}
              aria-label={t("FilterSheet.voto_tmdb_minimo")}
              onChange={(e) => set("tmdbRatingMin", Number(e.target.value) || undefined)}
            />
          </Field>
        </div>

        <Field label={t("FilterSheet.genere")}>
          <Select value={filters.genre ?? ""} onChange={(v) => set("genre", v || undefined)} label={t("FilterSheet.genere")}>
            <option value="">{t("FilterSheet.tutti")}</option>
            {options.genres.map((o) => (
              <option key={o.value} value={o.value}>
                {o.value} ({o.count})
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label={t("FilterSheet.studio")}
          hint={options.studios.length === 0 ? t("FilterSheet.arriva_da_tmdb_aggiungi") : undefined}
        >
          <Select value={filters.studio ?? ""} onChange={(v) => set("studio", v || undefined)} label={t("FilterSheet.studio")}>
            <option value="">{t("FilterSheet.tutti")}</option>
            {options.studios.map((o) => (
              <option key={o.value} value={o.value}>
                {o.value} ({o.count})
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t("FilterSheet.paese")}>
          <Select value={filters.country ?? ""} onChange={(v) => set("country", v || undefined)} label={t("FilterSheet.paese")}>
            <option value="">{t("FilterSheet.tutti")}</option>
            {options.countries.map((o) => (
              <option key={o.value} value={o.value}>
                {countryLabel(o.value)} ({o.count})
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t("FilterSheet.audio")}>
          <Select value={filters.audioLang ?? ""} onChange={(v) => set("audioLang", v || undefined)} label={t("FilterSheet.audio")}>
            <option value="">{t("FilterSheet.tutti")}</option>
            {options.audio.map((o) => (
              <option key={o.value} value={o.value}>
                {languageLabel(o.value)} ({o.count})
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label={t("FilterSheet.qualita")}
          hint={t("FilterSheet.la_qualita_della_copia")}
        >
          <Chips
            options={QUALITIES.map((q) => ({
              value: q as Quality,
              label: `${q}${options.qualities.find((o) => o.value === q)?.count ? ` (${options.qualities.find((o) => o.value === q)?.count})` : ""}`,
            }))}
            value={filters.quality}
            onChange={(v) => set("quality", v)}
            label={t("FilterSheet.qualita")}
          />
        </Field>

        <label className="flex min-h-11 items-center gap-3 text-sm text-text">
          <input
            type="checkbox"
            checked={!!filters.hasSubtitles}
            onChange={(e) => set("hasSubtitles", e.target.checked || undefined)}
            className="h-5 w-5 shrink-0"
          />
          {t("FilterSheet.solo_titoli_con_sottotitoli")}
        </label>

        {/* Il piede resta in fondo al foglio mentre si scorre fra i filtri: il
            conteggio dal vivo serve proprio mentre si stringe, non alla fine. */}
        <div
          className="sticky bottom-0 -mx-5 -mb-5 flex gap-3 bg-surface px-5 pb-5 pt-3 sm:-mx-6 sm:-mb-6 sm:px-6 sm:pb-6"
          style={{ boxShadow: "inset 0 1px 0 var(--separator)" }}
        >
          <button
            type="button"
            onClick={() => onChange({})}
            disabled={count === 0}
            className="btn btn-secondary flex-1"
          >
            {t("FilterSheet.togli_tutti")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-primary flex-1"
          >
            {t("FilterSheet.vedi")} {resultCount} {resultCount === 1 ? t("FilterSheet.titolo") : t("FilterSheet.titoli")}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
