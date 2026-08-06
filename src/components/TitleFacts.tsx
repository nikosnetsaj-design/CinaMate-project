import { useState } from "react";
import { useSelectedItem } from "../store/useSelectedItem";
import { useSelectedPerson } from "../store/useSelectedPerson";
import { useTitleExtras } from "../lib/useTitleExtras";
import { formatUsd, formatUsdShort } from "../lib/format";
import { profileUrl, providerLogoUrl, type TmdbCompany, type TmdbCrewCredit } from "../lib/tmdb";
import { MediaGallery } from "./MediaGallery";
import type { Item } from "../types";

/**
 * I dati del titolo che non stanno nella libreria: chi l'ha fatto, quanto è
 * costato, chi l'ha prodotto, cosa c'è da vedere.
 *
 * Vivono tutti in un componente solo perché arrivano tutti dalla stessa
 * richiesta a TMDB (`useTitleExtras`): tenerli separati avrebbe voluto dire
 * quattro riquadri che chiedono la stessa cosa, e quattro segnaposto che si
 * accendono in momenti diversi.
 */

/** Una persona della troupe: faccia, nome, mestiere. Si apre la sua scheda. */
function CrewCard({ person }: { person: TmdbCrewCredit }) {
  const openPerson = useSelectedPerson((s) => s.open);
  const closeItem = useSelectedItem((s) => s.close);
  const photo = profileUrl(person.profilePath);

  return (
    <button
      type="button"
      onClick={() => {
        closeItem();
        openPerson(person.name);
      }}
      aria-label={`Apri la scheda di ${person.name}`}
      className="flex items-center gap-3 rounded-md border border-border bg-surface-2 p-2.5 text-left transition-colors hover:bg-surface-hover"
    >
      <span className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-surface-hover">
        {photo ? (
          <img src={photo} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-display text-base text-text-faint">
            {person.name.slice(0, 1)}
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-text">{person.name}</span>
        <span className="block truncate text-xs text-text-faint">{person.job}</span>
      </span>
    </button>
  );
}

/**
 * Budget e incassi, e la sola cosa che uno vuole davvero sapere leggendoli:
 * se il film li ha rimessi. Il rapporto è dichiarato invece che lasciato da
 * calcolare a mente — «$370.569.774» accanto a «$140.000.000» è una divisione
 * che nessuno ha voglia di fare in fila alla cassa.
 *
 * Vale solo per i film: TMDB non tiene i bilanci delle serie, e mostrare due
 * zeri sarebbe peggio che non mostrare niente.
 */
function MoneyPanel({ budget, revenue }: { budget: number; revenue: number }) {
  if (budget <= 0 && revenue <= 0) return null;

  const ratio = budget > 0 && revenue > 0 ? revenue / budget : null;
  // Il pareggio nel cinema non è "incassi = budget": la sala si tiene circa
  // metà del biglietto, quindi si dice che un film rientra intorno al doppio.
  // Il testo lo spiega invece di dare un verdetto che sembrerebbe sbagliato.
  const verdict =
    ratio == null
      ? null
      : ratio >= 2.5
        ? { text: `Ha incassato ${ratio.toFixed(1).replace(".", ",")}× il budget: un successo pieno.`, color: "var(--status-done)" }
        : ratio >= 2
          ? { text: `Ha incassato ${ratio.toFixed(1).replace(".", ",")}× il budget: il pareggio in sala sta più o meno qui.`, color: "var(--yellow)" }
          : { text: `Ha incassato ${ratio.toFixed(1).replace(".", ",")}× il budget: in sala non è rientrato.`, color: "var(--danger)" };

  const scale = Math.max(budget, revenue, 1);

  return (
    <section className="mt-5">
      <h3 className="font-display text-lg font-semibold text-text">Dati finanziari</h3>
      <div className="mt-2.5 rounded-md border border-border bg-surface-2 p-4">
        <div className="flex flex-col gap-3">
          {[
            { label: "Budget", value: budget, color: "var(--text-muted)" },
            { label: "Incassi", value: revenue, color: "var(--accent)" },
          ]
            .filter((r) => r.value > 0)
            .map((r) => (
              <div key={r.label}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs font-medium uppercase tracking-wide text-text-faint">{r.label}</span>
                  <span className="font-mono tabular text-base font-semibold text-text" title={formatUsd(r.value)}>
                    {formatUsd(r.value)}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-hover">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${(r.value / scale) * 100}%`, background: r.color }}
                  />
                </div>
              </div>
            ))}
        </div>

        {verdict && (
          <p className="mt-3 text-xs leading-relaxed" style={{ color: verdict.color }}>
            {verdict.text}
          </p>
        )}
        <p className="mt-2 text-[11px] text-text-faint">
          Cifre in dollari come le pubblica TMDB, non aggiustate per l'inflazione.
          {revenue > 0 && budget > 0 && ` Differenza: ${formatUsdShort(revenue - budget)}.`}
        </p>
      </div>
    </section>
  );
}

/**
 * Gli studi, con il marchio.
 *
 * Il fondo chiaro non è una scelta di gusto: i loghi di TMDB sono PNG con
 * l'inchiostro nero e lo sfondo trasparente, pensati per la carta intestata.
 * Su velluto scuro sparirebbero — che è esattamente quello che fanno nelle app
 * che li ci mettono sopra e basta.
 */
function StudioRow({ companies }: { companies: TmdbCompany[] }) {
  const withLogo = companies.filter((c) => c.logoPath);
  const withoutLogo = companies.filter((c) => !c.logoPath);
  if (companies.length === 0) return null;

  return (
    <section className="mt-5">
      <h3 className="font-display text-lg font-semibold text-text">Studi di produzione</h3>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {withLogo.map((c) => (
          <span
            key={c.id || c.name}
            title={c.country ? `${c.name} · ${c.country}` : c.name}
            className="flex h-16 w-32 items-center justify-center rounded-md border border-border bg-white px-3 py-2"
          >
            <img
              src={providerLogoUrl(c.logoPath, "w154") ?? undefined}
              alt={c.name}
              loading="lazy"
              decoding="async"
              className="max-h-full max-w-full object-contain"
            />
          </span>
        ))}
        {withoutLogo.map((c) => (
          <span
            key={c.id || c.name}
            className="flex h-16 items-center rounded-md border border-border bg-surface-2 px-3.5 text-xs font-medium text-text-muted"
          >
            {c.name}
          </span>
        ))}
      </div>
    </section>
  );
}

const VISIBLE_CREW = 4;

export function TitleFacts({ item }: { item: Item }) {
  const { extras, loading } = useTitleExtras(item);
  const [allCrew, setAllCrew] = useState(false);

  if (loading) {
    return (
      <div className="mt-5 flex flex-col gap-2" aria-hidden="true">
        <div className="skeleton h-4 w-32 rounded-xs" />
        <div className="skeleton h-16 rounded-md" />
        <div className="skeleton h-20 rounded-md" />
      </div>
    );
  }
  if (!extras) return null;

  const crew = allCrew ? extras.crew : extras.crew.slice(0, VISIBLE_CREW);

  return (
    <>
      {extras.tagline && (
        <p className="mt-4 font-display text-base italic leading-snug" style={{ color: "var(--accent-text)" }}>
          «{extras.tagline}»
        </p>
      )}

      {extras.originalTitle && extras.originalTitle.toLowerCase() !== item.title.toLowerCase() && (
        <p className="mt-2 text-xs text-text-faint">
          Titolo originale · <span className="text-text-muted">{extras.originalTitle}</span>
        </p>
      )}

      {crew.length > 0 && (
        <section className="mt-5">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-display text-lg font-semibold text-text">Regia e troupe</h3>
            {extras.crew.length > VISIBLE_CREW && (
              <button
                type="button"
                onClick={() => setAllCrew((v) => !v)}
                className="text-xs font-medium"
                style={{ color: "var(--accent-text)" }}
              >
                {allCrew ? "mostra meno" : "mostra tutti →"}
              </button>
            )}
          </div>
          <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
            {crew.map((person) => (
              <CrewCard key={`${person.id}-${person.job}`} person={person} />
            ))}
          </div>
        </section>
      )}

      <MoneyPanel budget={extras.budget} revenue={extras.revenue} />
      <StudioRow companies={extras.companies} />
      <MediaGallery title={item.title} videos={extras.videos} posters={extras.posters} backdrops={extras.backdrops} />
    </>
  );
}
