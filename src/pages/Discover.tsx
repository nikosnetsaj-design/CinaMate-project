import { useEffect, useState } from "react";
import { useLibrary } from "../store/useLibrary";
import { useSettings } from "../store/useSettings";
import { useSettingsSheet } from "../store/useSettingsSheet";
import { useEditSheet } from "../store/useEditSheet";
import { useSelectedItem } from "../store/useSelectedItem";
import { getFeed, type DiscoverFeed, type TmdbSearchResult } from "../lib/tmdb";
import { draftFromTmdb } from "../lib/addFromTmdb";
import { PosterArt } from "../components/PosterArt";
import { EmptyState } from "../components/EmptyState";
import { UpcomingBoard } from "../components/UpcomingBoard";
import { NaturalSearch } from "../components/NaturalSearch";

const FEEDS: { id: DiscoverFeed; title: string; why: string }[] = [
  { id: "trending", title: "Di cosa si parla", why: "I film più visti questa settimana nel mondo" },
  { id: "cinema", title: "Ora al cinema", why: "In sala in Italia in questo momento" },
  { id: "trendingTv", title: "Serie del momento", why: "Le serie più seguite questa settimana" },
  { id: "top", title: "I più amati di sempre", why: "Voto più alto su TMDB" },
  { id: "upcoming", title: "In arrivo in sala", why: "Uscite italiane dei prossimi mesi" },
];

function Row({ feed, title, why }: { feed: DiscoverFeed; title: string; why: string }) {
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const items = useLibrary((s) => s.items);
  const openNew = useEditSheet((s) => s.openNew);
  const openItem = useSelectedItem((s) => s.open);
  const [rows, setRows] = useState<TmdbSearchResult[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [picking, setPicking] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    getFeed(feed, tmdbApiKey)
      .then((r) => !cancelled && setRows(r))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [feed, tmdbApiKey]);

  async function choose(r: TmdbSearchResult) {
    // Already in the library: open what you have rather than adding a twin.
    const owned = items.find((i) => i.tmdbId === r.tmdbId);
    if (owned) {
      openItem(owned);
      return;
    }
    setPicking(r.tmdbId);
    try {
      openNew(
        await draftFromTmdb(r.tmdbId, r.mediaType, r.kind, tmdbApiKey, {
          title: r.title,
          year: r.year,
          posterPath: r.posterPath,
        }),
      );
    } catch {
      setFailed(true);
    }
    setPicking(null);
  }

  if (failed) return null;

  return (
    <section className="flex flex-col gap-2.5">
      <div>
        <h2 className="font-display text-xl font-semibold text-text">{title}</h2>
        {/* Every row says why it is here — a suggestion without a reason is an advert. */}
        <p className="mt-0.5 text-xs text-text-faint">{why}</p>
      </div>
      <div className="flex gap-3.5 overflow-x-auto pb-1">
        {rows === null
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton aspect-2/3 w-28 shrink-0 rounded-sm" aria-hidden="true" />
            ))
          : rows.map((r) => {
              const owned = items.some((i) => i.tmdbId === r.tmdbId);
              return (
                <button
                  key={r.tmdbId}
                  type="button"
                  onClick={() => choose(r)}
                  disabled={picking !== null}
                  aria-label={owned ? `${r.title} — già in libreria, apri` : `Aggiungi ${r.title} alla libreria`}
                  className="w-28 shrink-0 text-left disabled:opacity-60"
                >
                  <div className="relative">
                    <PosterArt item={{ title: r.title, kind: r.kind, posterPath: r.posterPath }} size="sm" className="w-28" showTitle={!r.posterPath} />
                    {owned && (
                      <span
                        className="absolute right-1 top-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                        style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
                      >
                        ✓
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-xs font-medium text-text">{r.title}</p>
                  <p className="font-mono tabular text-[10px] text-text-faint">
                    {picking === r.tmdbId ? "…" : (r.year ?? "")}
                  </p>
                </button>
              );
            })}
      </div>
    </section>
  );
}

type Tab = "sfoglia" | "chiedi" | "prossimamente";
const TABS: { id: Tab; label: string }[] = [
  { id: "sfoglia", label: "Sfoglia" },
  { id: "chiedi", label: "Chiedi a parole" },
  { id: "prossimamente", label: "Prossimamente" },
];

export function Discover() {
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const openSettings = useSettingsSheet((s) => s.open);
  const [tab, setTab] = useState<Tab>("sfoglia");

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <div>
        <h1 className="font-display text-3xl font-semibold text-text">Scopri</h1>
        <p className="mt-1 text-sm text-text-muted">
          {tab === "sfoglia"
            ? "Tocca una copertina per aggiungerla alla tua libreria."
            : tab === "chiedi"
              ? "Scrivi cosa cerchi come lo diresti a voce. Claude traduce la frase in filtri, il catalogo TMDB risponde."
              : "Le date che ti riguardano: nuovi episodi delle serie che segui e film che aspetti."}
        </p>
      </div>

      {!tmdbApiKey ? (
        <EmptyState
          title="Serve la tua chiave TMDB"
          description="Scopri usa il catalogo di TMDB per mostrarti cosa sta uscendo e cosa guardano gli altri. La chiave è gratuita e resta su questo dispositivo."
          action={
            <button
              type="button"
              onClick={openSettings}
              className="rounded-sm px-4 py-2 text-sm font-semibold"
              style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
            >
              Aggiungi la chiave
            </button>
          }
        />
      ) : (
        <>
          <div className="flex gap-1 border-b border-border" role="tablist" aria-label="Sezioni di Scopri">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`-mb-px rounded-t-sm border-b-2 px-3.5 py-2 text-sm font-medium transition-colors ${
                  tab === t.id ? "text-text" : "border-transparent text-text-faint hover:text-text-muted"
                }`}
                style={tab === t.id ? { borderColor: "var(--accent)" } : undefined}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "sfoglia" && (
            <div className="flex flex-col gap-8">
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
