import { useMemo } from "react";
import { useLibrary } from "../store/useLibrary";
import { useSubscriptions } from "../store/useSubscriptions";
import { useSettingsSheet } from "../store/useSettingsSheet";
import { formatEuro, subscriptionValues, VALUE_WINDOW_DAYS, type SubscriptionValue } from "../lib/subscriptions";
import { formatRuntime } from "../lib/format";
import { providerLogoUrl } from "../lib/tmdb";
import { RowHeader } from "./RowHeader";

/**
 * Il conto degli abbonamenti, in Tu.
 *
 * Una riga per servizio: quanto hai guardato lì nell'ultimo mese e, se hai
 * scritto il prezzo, quanto ti è costata ogni ora. Un servizio a zero non è
 * colorato d'allarme — l'app non ti dice cosa disdire — ma dice da quanto non
 * lo usi, che è il fatto su cui si decide.
 */

const shortDay = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" });

function usage(v: SubscriptionValue): string {
  if (!v.platform) return "Non so quali titoli della libreria stanno qui.";
  if (v.views === 0) {
    return v.lastSeen
      ? `Niente negli ultimi ${VALUE_WINDOW_DAYS} giorni · l'ultima volta il ${shortDay.format(new Date(`${v.lastSeen}T12:00:00`))}`
      : `Niente negli ultimi ${VALUE_WINDOW_DAYS} giorni`;
  }
  const what = v.views === 1 ? "1 visione" : `${v.views} visioni`;
  return v.minutes > 0 ? `${what} · ${formatRuntime(v.minutes)} in ${VALUE_WINDOW_DAYS} giorni` : `${what} in ${VALUE_WINDOW_DAYS} giorni`;
}

export function SubscriptionsCard() {
  const subs = useSubscriptions((s) => s.subs);
  const items = useLibrary((s) => s.items);
  const history = useLibrary((s) => s.history);
  const openSettings = useSettingsSheet((s) => s.open);
  const values = useMemo(() => subscriptionValues(subs, items, history), [subs, items, history]);
  const total = subs.reduce((sum, s) => sum + (s.monthly ?? 0), 0);

  if (subs.length === 0) {
    return (
      <section className="flex flex-col gap-4">
        <RowHeader title="I tuoi abbonamenti" />
        <div className="rounded-lg bg-surface p-4 shadow-[var(--shadow-sm)]">
          <p className="text-sm text-text-muted">
            Dimmi a cosa sei abbonato: ti dico quanto ti costa ogni ora che guardi, e in ogni scheda se un titolo è già
            incluso in quello che paghi.
          </p>
          <button type="button" onClick={() => openSettings("abbonamenti")} className="btn btn-secondary btn-sm mt-3">
            Scegli i servizi
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <RowHeader
        title="I tuoi abbonamenti"
        note={total > 0 ? `${formatEuro(total)} al mese` : undefined}
        trailing={
          <button type="button" onClick={() => openSettings("abbonamenti")} className="btn btn-plain btn-sm text-text-muted hover:text-text">
            Modifica
          </button>
        }
      />
      <ul className="list-group" style={{ "--row-inset": "64px" } as React.CSSProperties}>
        {values.map((v) => {
          const logo = providerLogoUrl(v.sub.logoPath, "w92");
          return (
            <li key={v.sub.providerId} className="list-row gap-3 py-3">
              {logo ? (
                <img src={logo} alt="" loading="lazy" decoding="async" className="h-9 w-9 shrink-0 rounded-[10px] object-cover" />
              ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-surface-2 text-xs font-semibold text-text">
                  {v.sub.name.slice(0, 2)}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-medium text-text">{v.sub.name}</span>
                  {v.sub.monthly != null && (
                    <span className="shrink-0 text-xs tabular text-text-muted">{formatEuro(v.sub.monthly)}/mese</span>
                  )}
                </p>
                <p className="mt-0.5 flex items-baseline justify-between gap-3 text-xs text-text-muted">
                  <span className="min-w-0">{usage(v)}</span>
                  {v.perHour != null && (
                    <span className="shrink-0 font-medium tabular text-text">{formatEuro(v.perHour)}/ora</span>
                  )}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="max-w-prose text-xs text-text-faint">
        Contano le voci del diario dei titoli che in libreria hanno quel servizio come piattaforma: l'app non sa dove hai
        premuto play, sa dove hai detto che sta il titolo.
      </p>
    </section>
  );
}
