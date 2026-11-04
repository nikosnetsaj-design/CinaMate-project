import { useMemo } from "react";
import { RowHeader } from "./RowHeader";
import { buildPalate, disliked, loved, PALATE_MIN_VOTES, type Facet } from "../lib/palate";
import type { Item } from "../types";
import { intlLocale, t } from "../lib/i18n";

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
                  {vote(f.avg)} · {f.count} {t("PalateCard.titoli")}
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
        <RowHeader title={t("PalateCard.il_tuo_palato")} />
        <p className="text-sm text-text-muted">
          {t("PalateCard.dai_un_voto_ad")} {PALATE_MIN_VOTES} {t("PalateCard.titoli_2")}{palate.rated} {t("PalateCard.finora_e_qui_compare")}
        </p>
      </section>
    );
  }

  const { facets, vsCrowd } = palate;
  return (
    <section className="flex flex-col gap-4">
      <RowHeader title={t("PalateCard.il_tuo_palato")} />
      <div className="rounded-lg bg-surface shadow-[var(--shadow-sm)]">
        <p className="px-4 pt-4 text-sm text-text-muted">
          {t("PalateCard.da")} {palate.rated} {t("PalateCard.voti_media")} {vote(palate.average)}{t("PalateCard.calcolato_qui_dai_tuoi")}
        </p>
        <dl className="list-group mt-2 shadow-none" style={{ "--row-inset": "16px" } as React.CSSProperties}>
          <Row label={t("PalateCard.premi")} facets={loved(facets.genre)} empty={t("PalateCard.nessun_genere_spicca_per")} />
          <Row label={t("PalateCard.punisci")} facets={disliked(facets.genre)} />
          <Row label={t("PalateCard.decennio")} facets={loved(facets.decade, 1)} />
          <Row label={t("PalateCard.regia")} facets={loved(facets.director, 2)} />
          <Row label={t("PalateCard.durata")} facets={loved(facets.runtime, 1)} />
          <Row label={t("PalateCard.paesi")} facets={loved(facets.country, 2)} />
          {vsCrowd && (
            <div className="list-row items-start gap-3 py-3">
              <dt className="w-24 shrink-0 pt-px text-sm text-text-muted sm:w-28">{t("PalateCard.con_tmdb")}</dt>
              <dd className="min-w-0 flex-1 text-sm text-text">
                {signed(vsCrowd.delta)} {t("PalateCard.di_media_su")} {vsCrowd.count} titoli:{" "}
                {Math.abs(vsCrowd.delta) < 0.3
                  ? t("PalateCard.voti_come_il_pubblico")
                  : vsCrowd.delta > 0
                    ? t("PalateCard.dai_voti_piu_alti")
                    : t("PalateCard.dai_voti_piu_bassi")}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </section>
  );
}
