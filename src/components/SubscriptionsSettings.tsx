import { useEffect, useState } from "react";
import { useSettings } from "../store/useSettings";
import { useSubscriptions } from "../store/useSubscriptions";
import { getProviderCatalog, providerLogoUrl, type TmdbProviderOption } from "../lib/tmdb";
import { formatEuro, parsePrice, type Subscription } from "../lib/subscriptions";
import { CatalogNote } from "./NeedsCatalog";

/**
 * «A cosa sei abbonato?» — una volta sola, e tre posti dell'app cambiano:
 * la scheda di un titolo dice se è già incluso in qualcosa che paghi, Scopri
 * ha una riga con cosa è popolare lì, e Tu fa il conto di quanto ti costa ogni
 * ora guardata. Il prezzo è facoltativo: senza, il conto dice le ore e basta.
 */

function Logo({ path, name }: { path: string | null; name: string }) {
  const url = providerLogoUrl(path, "w92");
  return url ? (
    <img src={url} alt="" loading="lazy" decoding="async" className="h-9 w-9 shrink-0 rounded-[10px] object-cover" />
  ) : (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-surface-hover text-xs font-semibold text-text">
      {name.slice(0, 2)}
    </span>
  );
}

function PriceField({ sub }: { sub: Subscription }) {
  const setPrice = useSubscriptions((s) => s.setPrice);
  const shown = sub.monthly != null ? String(sub.monthly).replace(".", ",") : "";
  const [draft, setDraft] = useState(shown);
  useEffect(() => setDraft(shown), [shown]);
  return (
    <label className="flex shrink-0 items-center gap-1.5 text-xs text-text-muted">
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        placeholder="—"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const price = parsePrice(draft);
          setPrice(sub.providerId, price);
          setDraft(price != null ? String(price).replace(".", ",") : "");
        }}
        aria-label={`Quanto paghi ${sub.name} al mese, in euro`}
        className="field field-sm w-20 text-right tabular"
      />
      €/mese
    </label>
  );
}

export function SubscriptionsSettings() {
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const subs = useSubscriptions((s) => s.subs);
  const toggle = useSubscriptions((s) => s.toggle);
  const [catalog, setCatalog] = useState<TmdbProviderOption[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!tmdbApiKey) return;
    let cancelled = false;
    getProviderCatalog(tmdbApiKey)
      .then((list) => !cancelled && setCatalog(list))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [tmdbApiKey]);

  const mine = new Set(subs.map((s) => s.providerId));
  const others = (catalog ?? []).filter((p) => !mine.has(p.id));
  // I primi venti sono quelli che quasi tutti hanno; gli altri — negozi a
  // noleggio, canali di nicchia — restano a un tocco.
  const visible = showAll ? others : others.slice(0, 20);
  const total = subs.reduce((sum, s) => sum + (s.monthly ?? 0), 0);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-text-muted">
        Tre cose cambiano: nella scheda di un titolo vedi subito se è già incluso in qualcosa che paghi, in Scopri c'è
        una riga con cosa è popolare lì, e in Tu il conto di quanto ti costa ogni ora guardata. Il prezzo è facoltativo.
      </p>

      {subs.length > 0 && (
        <section>
          <h3 className="mb-2 px-1 text-sm font-medium text-text-muted">
            I tuoi{total > 0 ? ` · ${formatEuro(total)} al mese` : ""}
          </h3>
          <ul className="list-group bg-surface-2 shadow-none" style={{ "--row-inset": "64px" } as React.CSSProperties}>
            {subs.map((s) => (
              <li key={s.providerId} className="list-row items-start gap-3 py-2.5">
                <Logo path={s.logoPath} name={s.name} />
                {/* Il prezzo sotto il nome e non accanto: su un telefono, in fila,
                    «Disney Plus» diventava «Disney …». */}
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-text">{s.name}</span>
                  <div className="mt-1.5">
                    <PriceField sub={s} />
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked
                  aria-label={`Abbonato a ${s.name}`}
                  onClick={() => toggle({ id: s.providerId, name: s.name, logoPath: s.logoPath })}
                  className="switch mt-0.5"
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {!tmdbApiKey && <CatalogNote what="L'elenco dei servizi in Italia lo sa TMDB." />}
      {tmdbApiKey && failed && <p className="text-xs text-text-faint">Non riesco a leggere l'elenco dei servizi. Riprova più tardi.</p>}
      {tmdbApiKey && !failed && catalog === null && (
        <div className="flex flex-col gap-2" aria-hidden="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-12 rounded-md" />
          ))}
        </div>
      )}
      {visible.length > 0 && (
        <section>
          <h3 className="mb-2 px-1 text-sm font-medium text-text-muted">{subs.length ? "Aggiungi" : "Servizi in Italia"}</h3>
          <ul className="list-group bg-surface-2 shadow-none" style={{ "--row-inset": "64px" } as React.CSSProperties}>
            {visible.map((p) => (
              <li key={p.id} className="list-row gap-3 py-2.5">
                <Logo path={p.logoPath} name={p.name} />
                <span className="min-w-0 flex-1 truncate text-sm text-text">{p.name}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={false}
                  aria-label={`Abbonato a ${p.name}`}
                  onClick={() => toggle({ id: p.id, name: p.name, logoPath: p.logoPath })}
                  className="switch"
                />
              </li>
            ))}
          </ul>
          {!showAll && others.length > visible.length && (
            <button type="button" onClick={() => setShowAll(true)} className="btn btn-plain mt-2 text-text-muted hover:text-text">
              Mostra tutti ({others.length})
            </button>
          )}
        </section>
      )}
    </div>
  );
}
