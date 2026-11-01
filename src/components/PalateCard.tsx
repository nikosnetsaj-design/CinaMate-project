import { useMemo } from "react";
import { RowHeader } from "./RowHeader";
import { buildPalate, disliked, loved, PALATE_MIN_VOTES, type Facet } from "../lib/palate";
import type { Item } from "../types";
import { intlLocale } from "../lib/i18n";

function vote(value: number): string {
  return value.toLocaleString(intlLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function signed(value: number): string {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${vote(Math.abs(value))}`;
}

function Row({ label, facets, empty }: { label: string; facets: Facet[]; empty?: string }) {
  if (facets.length === 0 && !empty) return null;
  return (
    <div className="list-row items-start gap-3 py-3">
      <dt className="w-24 shrink-0 pt-px text-sm text-text-muted sm:w-28">{label}</dt>
      <dd className="min-w-0 flex-1">
        {facets.length === 0 ? (
          <span className="text-sm text-text-faint">{empty}</span>
        ) : (
          <ul className="flex flex-col gap-1">
            {facets.map((f) => (
              <li key={f.key} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 text-text first-letter:uppercase">{f.label}</span>
                <span className="shrink-0 text-xs tabular text-text-muted">
                  {vote(f.avg)} · {f.count} titoli
                </span>
              </li>
            ))}
          </ul>
        )}
      </dd>
    </div>
  );
}

/**
 * Il palato, come scheda della pagina Tu.
 *
 * Righe e non grafici: «premi la fantascienza, 8,6 su sette titoli» si legge
 * in un colpo, un radar a cinque punte va decifrato. Ogni riga dice la media e
 * su quanti titoli, così si vede quanto è solida. Le stesse cifre muovono i
 * consigli della Home, che citano la riga da cui vengono.
 */
export function PalateCard({ items }: { items: Item[] }) {
  const palate = useMemo(() => buildPalate(items), [items]);

  if (palate.rated < PALATE_MIN_VOTES) {
    return (
      <section className="flex flex-col gap-4">
        <RowHeader title="Il tuo palato" />
        <p className="text-sm text-text-muted">
          Dai un voto ad almeno {PALATE_MIN_VOTES} titoli ({palate.rated} finora) e qui compare cosa premi e cosa punisci:
          generi, decenni, registi, durata, paesi.
        </p>
      </section>
    );
  }

  const { facets, vsCrowd } = palate;
  return (
    <section className="flex flex-col gap-4">
      <RowHeader title="Il tuo palato" />
      <div className="rounded-lg bg-surface shadow-[var(--shadow-sm)]">
        <p className="px-4 pt-4 text-sm text-text-muted">
          Da {palate.rated} voti, media {vote(palate.average)}. Calcolato qui, dai tuoi voti: niente lascia il dispositivo.
        </p>
        <dl className="list-group mt-2 shadow-none" style={{ "--row-inset": "16px" } as React.CSSProperties}>
          <Row label="Premi" facets={loved(facets.genre)} empty="Nessun genere spicca, per ora." />
          <Row label="Punisci" facets={disliked(facets.genre)} />
          <Row label="Decennio" facets={loved(facets.decade, 1)} />
          <Row label="Regia" facets={loved(facets.director, 2)} />
          <Row label="Durata" facets={loved(facets.runtime, 1)} />
          <Row label="Paesi" facets={loved(facets.country, 2)} />
          {vsCrowd && (
            <div className="list-row items-start gap-3 py-3">
              <dt className="w-24 shrink-0 pt-px text-sm text-text-muted sm:w-28">Con TMDB</dt>
              <dd className="min-w-0 flex-1 text-sm text-text">
                {signed(vsCrowd.delta)} di media su {vsCrowd.count} titoli:{" "}
                {Math.abs(vsCrowd.delta) < 0.3
                  ? "voti come il pubblico."
                  : vsCrowd.delta > 0
                    ? "dai voti più alti del pubblico."
                    : "dai voti più bassi del pubblico."}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </section>
  );
}
