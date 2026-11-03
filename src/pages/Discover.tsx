import { useEffect, useState } from "react";
import { useSettings } from "../store/useSettings";
import { useSettingsSheet } from "../store/useSettingsSheet";
import { getFeed, type DiscoverFeed, type TmdbSearchResult } from "../lib/tmdb";
import { useCatalogActions } from "../lib/useQuickAdd";
import { CatalogCard } from "../components/CatalogCard";
import { EmptyState } from "../components/EmptyState";
import { RowHeader } from "../components/RowHeader";
import { ErrorState } from "../components/ErrorState";
import { UpcomingBoard } from "../components/UpcomingBoard";
import { NaturalSearch } from "../components/NaturalSearch";
import { MoodPicker } from "../components/MoodPicker";
import { t } from "../lib/i18n";

const FEEDS: { id: DiscoverFeed; title: string; why: string }[] = [
  { id: "trending", title: t("Discover.di_cosa_si_parla"), why: t("Discover.i_film_piu_visti") },
  { id: "cinema", title: t("Discover.ora_al_cinema"), why: t("Discover.in_sala_in_italia") },
  { id: "trendingTv", title: t("Discover.serie_del_momento"), why: t("Discover.le_serie_piu_seguite") },
  { id: "top", title: t("Discover.i_piu_amati_di"), why: t("Discover.voto_piu_alto_su") },
  { id: "upcoming", title: t("Discover.in_arrivo_in_sala"), why: t("Discover.uscite_italiane_dei_prossimi") },
];

function Row({ feed, title, why }: { feed: DiscoverFeed; title: string; why: string }) {
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const actions = useCatalogActions();
  const [rows, setRows] = useState<TmdbSearchResult[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setRows(null);
    getFeed(feed, tmdbApiKey)
      .then((r) => !cancelled && setRows(r))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [feed, tmdbApiKey, attempt]);

  return (
    <section className="flex flex-col gap-4">
      {/* Every row says why it is here — a suggestion without a reason is an advert. */}
      <RowHeader title={title} note={why} />
      {failed ? (
        <ErrorState compact title={t("Discover.questa_riga_non_e")} description={t("Discover.tmdb_non_ha_risposto")} onRetry={() => setAttempt((n) => n + 1)} />
      ) : (
      <div className="shelf">
        {rows === null
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton aspect-2/3 w-32 shrink-0 rounded-sm sm:w-36" aria-hidden="true" />
            ))
          : rows.map((r) => (
              <CatalogCard
                key={`${r.mediaType}-${r.tmdbId}`}
                title={r}
                owned={actions.owned(r)}
                pending={actions.isPending(r)}
                onOpen={() => actions.open(r)}
                onQuickAdd={() => actions.quickAdd(r)}
                className="w-32 shrink-0 sm:w-36"
              />
            ))}
      </div>
      )}
    </section>
  );
}

type Tab = "sfoglia" | "chiedi" | "prossimamente";
const TABS: { id: Tab; label: string }[] = [
  { id: "sfoglia", label: t("tabs.discover.browse") },
  { id: "chiedi", label: t("tabs.discover.ask") },
  { id: "prossimamente", label: t("tabs.discover.upcoming") },
];

export function Discover() {
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const openSettings = useSettingsSheet((s) => s.open);
  const [tab, setTab] = useState<Tab>("sfoglia");

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-[var(--gutter)] py-6 sm:py-10">
      <div>
        <h1 className="t-display text-text">{t("page.discover")}</h1>
        <p className="mt-1 text-sm text-text-muted">
          {tab === "sfoglia"
            ? t("Discover.tocca_una_copertina_per")
            : tab === "chiedi"
              ? t("Discover.scrivi_cosa_cerchi_come")
              : t("Discover.le_date_che_ti")}
        </p>
      </div>

      {/*
        Sopra il controllo della chiave di proposito: la scoperta per stato
        d'animo legge la libreria che hai già e non tocca la rete. Metterla
        dentro il ramo protetto l'avrebbe nascosta proprio a chi non ha ancora
        una chiave TMDB — cioè a chi ha più bisogno di una via d'ingresso che
        funzioni subito.
      */}
      <MoodPicker />

      {!tmdbApiKey ? (
        <EmptyState
          title={t("Discover.serve_la_tua_chiave")}
          description={t("Discover.scopri_usa_il_catalogo")}
          action={
            <button
              type="button"
              onClick={() => openSettings()}
              className="btn btn-primary"
            >
              {t("Discover.aggiungi_la_chiave")}
            </button>
          }
        />
      ) : (
        <>
          {/* Gli stessi segmenti di Cerca: un modo solo di dire «sei qui». */}
          <div className="shelf gap-2" role="tablist" aria-label={t("Discover.sezioni_di_scopri")}>
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className="chip"
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "sfoglia" && (
            <div className="flex flex-col gap-10">
              {FEEDS.map((f) => (
                <Row key={f.id} feed={f.id} title={f.title} why={f.why} />
              ))}
            </div>
          )}
          {tab === "chiedi" && <NaturalSearch />}
          {tab === "prossimamente" && <UpcomingBoard />}
        </>
      )}
    </div>
  );
}
