import { useEffect, useMemo, useState } from "react";
import { useLibrary } from "../store/useLibrary";
import { useSettings } from "../store/useSettings";
import { useServices } from "../store/useServices";
import { useSelectedItem } from "../store/useSelectedItem";
import { getWatchProviders, providerLogoUrl } from "../lib/tmdb";
import { bestCombo, onMine, REGIONS, servicesOf, summarize, type Availability, type Service } from "../lib/services";
import { countryLabel } from "../lib/palate";
import { useUpcoming } from "../lib/useUpcoming";
import { dayLabel, plural } from "../lib/format";
import { CatalogBlock } from "../components/NeedsCatalog";
import { EmptyState } from "../components/EmptyState";
import { PosterArt } from "../components/PosterArt";
import { RowHeader } from "../components/RowHeader";
import { CheckIcon } from "../components/icons";

function ServiceLogo({ service, size = 40 }: { service: Service; size?: number }) {
  const logo = providerLogoUrl(service.logoPath, "w92");
  return (
    <span className="block shrink-0 overflow-hidden rounded-[10px] bg-surface-2" style={{ width: size, height: size }}>
      {logo ? (
        <img src={logo} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
      ) : (
        // Senza logo: il nome per intero dove c'è posto, l'iniziale nelle pastiglie.
        <span className="flex h-full w-full items-center justify-center text-center text-[9px] font-semibold leading-tight text-text">
          {size < 32 ? service.name.charAt(0) : service.name}
        </span>
      )}
    </span>
  );
}

/**
 * Quale abbonamento conviene.
 *
 * Si parte da quello che vuoi vedere, non da un catalogo: per ogni titolo
 * della lista «Da vedere» si chiede a TMDB dove sta in abbonamento nel tuo
 * paese (le risposte restano in cache per un giorno). Ne escono tre risposte:
 * quale servizio ne ha di più e quanti *solo lì*, la combinazione che copre
 * di più, e cosa sta per arrivare su ciascuno. Con i tuoi abbonamenti segnati,
 * il filtro mostra cosa puoi guardare già stasera senza pagare altro.
 */
export function Services() {
  const items = useLibrary((s) => s.items);
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const { region, mine, setRegion, toggleMine } = useServices();
  const openItem = useSelectedItem((s) => s.open);
  const upcoming = useUpcoming();
  const [onlyMine, setOnlyMine] = useState(false);

  const wanted = useMemo(() => items.filter((i) => i.status === "Da vedere" && i.tmdbId && i.tmdbMediaType), [items]);
  // Anche le serie che segui: è lì che arrivano le stagioni nuove.
  const tracked = useMemo(
    () => items.filter((i) => (i.status === "Da vedere" || i.status === "In visione") && i.tmdbId && i.tmdbMediaType),
    [items],
  );
  const trackedKey = tracked.map((i) => i.id).join(",");
  const [state, setState] = useState<{ region: string; key: string; list: Availability[]; done: number } | null>(null);

  useEffect(() => {
    if (!tmdbApiKey) return;
    let cancelled = false;
    const queue = useLibrary.getState().items.filter((i) => trackedKey.split(",").includes(i.id));
    const out: Availability[] = [];
    let next = 0;
    let done = 0;
    setState({ region, key: trackedKey, list: [], done: 0 });
    async function worker() {
      while (next < queue.length && !cancelled) {
        const item = queue[next++];
        try {
          const info = await getWatchProviders(item.tmdbId as number, item.tmdbMediaType as "movie" | "tv", tmdbApiKey, region);
          out.push({ item, streaming: info.streaming, free: info.free });
        } catch {
          out.push({ item, streaming: [], free: [] });
        }
        done++;
        if (!cancelled && (done % 4 === 0 || done === queue.length)) setState({ region, key: trackedKey, list: [...out], done });
      }
    }
    void Promise.all(Array.from({ length: Math.min(4, queue.length) }, worker)).then(() => {
      if (!cancelled) setState({ region, key: trackedKey, list: [...out], done: queue.length });
    });
    return () => {
      cancelled = true;
    };
  }, [tmdbApiKey, region, trackedKey]);

  const ready = state !== null && state.region === region && state.key === trackedKey && state.done === tracked.length;
  const all = useMemo(() => state?.list ?? [], [state]);
  const wantedIds = useMemo(() => new Set(wanted.map((i) => i.id)), [wanted]);
  const list = useMemo(() => all.filter((av) => wantedIds.has(av.item.id)), [all, wantedIds]);
  const summary = useMemo(() => summarize(list), [list]);
  const combo = useMemo(() => bestCombo(list), [list]);
  const mineSet = useMemo(() => new Set(mine), [mine]);
  const watchable = useMemo(() => onMine(list, mineSet), [list, mineSet]);
  const nowhere = list.filter((av) => servicesOf(av).length === 0 && av.free.length === 0).length;

  // Cosa arriva, servizio per servizio: le uscite dei titoli che segui (da
  // vedere o in corso), sul servizio dove quei titoli stanno.
  const arriving = useMemo(() => {
    const byItem = new Map(all.map((av) => [av.item.id, servicesOf(av)]));
    const map = new Map<string, { label: string; date: string; item: (typeof items)[number] }[]>();
    for (const entry of upcoming) {
      for (const s of byItem.get(entry.item.id) ?? []) {
        const label =
          entry.type === "episodio" && entry.season != null && entry.episode != null
            ? `${entry.item.title} · S${entry.season}E${entry.episode}`
            : entry.item.title;
        map.set(s.key, [...(map.get(s.key) ?? []), { label, date: entry.date, item: entry.item }]);
      }
    }
    return map;
  }, [all, upcoming]);

  const services = useMemo(() => {
    const keys = new Map<string, Service>();
    for (const av of all) for (const s of servicesOf(av)) if (!keys.has(s.key)) keys.set(s.key, s);
    return [...keys.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [all]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 px-[var(--gutter)] py-6 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="t-display text-text">Abbonamenti</h1>
          <p className="mt-1 max-w-prose text-sm text-text-muted">Quale conviene, partendo da quello che vuoi vedere.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-text-muted">
          Paese
          <select value={region} onChange={(e) => setRegion(e.target.value)} className="field field-sm w-auto">
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {countryLabel(r)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!tmdbApiKey ? (
        <CatalogBlock />
      ) : wanted.length === 0 ? (
        <EmptyState
          title="La lista «Da vedere» è vuota."
          description="Metti in lista qualche titolo collegato al catalogo: qui vedi su quale servizio ce ne sono di più."
        />
      ) : !ready ? (
        <div className="flex flex-col gap-3" aria-live="polite">
          <p className="text-sm text-text-muted">
            Controllo dove stanno i tuoi titoli in {countryLabel(region)}… {state?.done ?? 0} di {tracked.length}
          </p>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-[72px] rounded-md" aria-hidden="true" />
          ))}
        </div>
      ) : (
        <>
          {/* --- Il consiglio ------------------------------------------ */}
          {combo.steps.length > 0 ? (
            <section className="flex flex-col gap-3 rounded-lg bg-surface p-5 shadow-[var(--shadow-sm)]">
              <p className="text-sm text-text-muted">Il consiglio</p>
              <p className="t-title text-text">
                Con {combo.steps[0].service.name} vedi {combo.steps[0].total} dei tuoi {wanted.length} titoli da vedere
                {combo.steps[1] ? `; aggiungendo ${combo.steps[1].service.name} arrivi a ${combo.steps[1].total}` : ""}
                {combo.steps[2] ? `, con ${combo.steps[2].service.name} a ${combo.steps[2].total}` : ""}.
              </p>
              <p className="text-xs text-text-muted">
                Conto fatto in {countryLabel(region)} sui titoli in abbonamento, non a noleggio.
                {nowhere > 0 && ` ${plural(nowhere, "titolo non è", "titoli non sono")} in abbonamento da nessuna parte, per ora.`}
              </p>
            </section>
          ) : (
            <p className="text-sm text-text-muted">
              Nessuno dei tuoi titoli da vedere è in abbonamento in {countryLabel(region)}, per ora: solo a noleggio o al cinema.
            </p>
          )}

          {/* --- I miei abbonamenti -------------------------------------- */}
          {services.length > 0 && (
            <section className="flex flex-col gap-3">
              <RowHeader title="I tuoi abbonamenti" note="Segna quelli che paghi già." />
              <div className="flex flex-wrap gap-2">
                {services.map((s) => {
                  const on = mineSet.has(s.key);
                  return (
                    <button key={s.key} type="button" aria-pressed={on} onClick={() => toggleMine(s.key)} className="chip gap-2 pl-1.5">
                      <ServiceLogo service={s} size={24} />
                      {s.name}
                      {on && <CheckIcon size={14} />}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* --- Per servizio ---------------------------------------- */}
          <section className="flex flex-col gap-4">
            <RowHeader title="Per servizio" />
            <ul className="list-group" style={{ "--row-inset": "68px" } as React.CSSProperties}>
              {summary.map(({ service, items: its, only }) => {
                return (
                  <li key={service.key} className="list-row items-start gap-3 py-3">
                    <ServiceLogo service={service} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-sm font-medium text-text">
                          {service.name}
                          {mineSet.has(service.key) && <span className="ml-1.5 text-xs font-normal text-text-muted">· ce l'hai</span>}
                        </span>
                        <span className="t-figure shrink-0 tabular text-text">{its.length}</span>
                      </div>
                      <p className="text-xs text-text-muted">
                        {plural(its.length, "titolo", "titoli")} della tua lista{only > 0 ? `, ${only} solo qui` : ""}
                      </p>
                      <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto">
                        {its.slice(0, 8).map((i) => (
                          <button key={i.id} type="button" onClick={() => openItem(i)} aria-label={`Apri dettagli di ${i.title}`} className="shrink-0">
                            <PosterArt item={i} size="sm" showTitle={false} className="w-9" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* --- In arrivo -------------------------------------------- */}
          {arriving.size > 0 && (
            <section className="flex flex-col gap-4">
              <RowHeader title="In arrivo" note="Le uscite dei titoli che segui, sul servizio dove stanno." />
              <ul className="list-group" style={{ "--row-inset": "68px" } as React.CSSProperties}>
                {[...arriving.entries()].map(([key, entries]) => {
                  const service = services.find((s) => s.key === key);
                  if (!service) return null;
                  return (
                    <li key={key} className="list-row items-start gap-3 py-3">
                      <ServiceLogo service={service} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-text">{service.name}</p>
                        <ul className="mt-1 flex flex-col gap-0.5">
                          {entries.map((n) => (
                            <li key={`${n.item.id}-${n.date}`} className="flex items-baseline justify-between gap-3 text-xs">
                              <button type="button" onClick={() => openItem(n.item)} className="min-w-0 truncate text-left text-text">
                                {n.label}
                              </button>
                              <span className="shrink-0 tabular text-text-muted">{dayLabel(n.date)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* --- Già stasera ------------------------------------------ */}
          <section className="flex flex-col gap-4">
            <RowHeader title="Con quello che hai" count={onlyMine ? watchable.length : undefined} />
            <button
              type="button"
              role="switch"
              aria-checked={onlyMine}
              onClick={() => setOnlyMine(!onlyMine)}
              className="flex min-h-11 items-center justify-between gap-3 rounded-lg bg-surface px-4 text-left text-sm text-text shadow-[var(--shadow-sm)]"
            >
              Solo sui miei abbonamenti
              <span aria-hidden="true" className="switch shrink-0" data-on={onlyMine} />
            </button>
            {!onlyMine ? (
              <p className="text-sm text-text-muted">
                Accendi il filtro per vedere i titoli della tua lista che stanno sui servizi che hai segnato, o gratis.
              </p>
            ) : mine.length === 0 ? (
              <p className="text-sm text-text-muted">Segna prima i tuoi abbonamenti qui sopra.</p>
            ) : watchable.length === 0 ? (
              <p className="text-sm text-text-muted">Niente della tua lista è sui tuoi abbonamenti, per ora.</p>
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {watchable.map((i) => (
                  <button key={i.id} type="button" onClick={() => openItem(i)} aria-label={`Apri dettagli di ${i.title}`} className="text-left">
                    <PosterArt item={i} size="sm" showTitle={false} className="w-full" />
                    <span className="mt-1 block truncate text-xs text-text">{i.title}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
