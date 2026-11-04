import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "../lib/useFocusTrap";
import { findPersonId, getPerson, profileUrl, type TmdbPerson, type TmdbPersonCredit } from "../lib/tmdb";
import { paletteFor } from "../lib/palette";
import { useLibrary } from "../store/useLibrary";
import { useSettings } from "../store/useSettings";
import { useSettingsSheet } from "../store/useSettingsSheet";
import { useSelectedPerson } from "../store/useSelectedPerson";
import { useSelectedItem } from "../store/useSelectedItem";
import { useCatalogPreview } from "../store/useCatalogPreview";
import { useCriticDraft } from "../store/useCriticDraft";
import { useNavigate } from "react-router-dom";
import { PosterArt } from "./PosterArt";
import { BackIcon, CheckIcon, ClockIcon, PersonIcon } from "./icons";
import type { Item } from "../types";
import { t } from "../lib/i18n";

/** Long filmographies are the norm; the tail is noise until it is asked for. */
const VISIBLE_CREDITS = 12;

function CreditCard({ credit, owned, onOpen, onAdd, adding }: {
  credit: TmdbPersonCredit;
  owned: Item | undefined;
  onOpen: (item: Item) => void;
  onAdd: (credit: TmdbPersonCredit) => void;
  adding: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => (owned ? onOpen(owned) : onAdd(credit))}
      disabled={adding}
      aria-label={owned ? t("PersonSheet.apri_dettagli_di", { v0: credit.title }) : t("PersonSheet.aggiungi_alla_libreria", { v0: credit.title })}
      className="w-24 shrink-0 text-left disabled:opacity-60"
    >
      <div className="relative">
        <PosterArt
          item={{ title: credit.title, kind: credit.kind, posterPath: credit.posterPath }}
          size="sm"
          showTitle={!credit.posterPath}
          className="w-24"
        />
        {owned && (
          <span
            className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur-sm"
          >
            {owned.status === "Visto" ? <CheckIcon size={11} /> : <ClockIcon size={11} />}
          </span>
        )}
      </div>
      <p className="mt-1.5 line-clamp-2 text-xs font-medium text-text">{credit.title}</p>
      <p className="font-mono tabular text-xs text-text-faint">{adding ? "…" : (credit.year ?? "")}</p>
      {credit.role && <p className="line-clamp-1 text-xs text-text-faint">{credit.role}</p>}
    </button>
  );
}

function CreditRow({ title, credits, hint }: { title: string; credits: TmdbPersonCredit[]; hint?: string }) {
  const items = useLibrary((s) => s.items);
  const openItem = useSelectedItem((s) => s.open);
  const openPreview = useCatalogPreview((s) => s.open);
  const close = useSelectedPerson((s) => s.close);
  const [expanded, setExpanded] = useState(false);

  if (credits.length === 0) return null;
  const shown = expanded ? credits : credits.slice(0, VISIBLE_CREDITS);

  /**
   * Un titolo della filmografia che non hai apre la sua scheda, non il modulo
   * di aggiunta: di un film mai visto si vuole prima sapere di cosa parla.
   */
  function preview(credit: TmdbPersonCredit) {
    close();
    openPreview({
      tmdbId: credit.tmdbId,
      mediaType: credit.mediaType,
      kind: credit.kind,
      title: credit.title,
      year: credit.year,
      posterPath: credit.posterPath,
    });
  }

  return (
    <section className="mt-5 flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-text">
            {title} <span className="text-sm font-normal text-text-faint">· {credits.length}</span>
          </h2>
          {hint && <p className="mt-0.5 text-xs text-text-faint">{hint}</p>}
        </div>
        {credits.length > VISIBLE_CREDITS && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="shrink-0 text-sm font-medium text-accent-text"
          >
            {expanded ? t("PersonSheet.meno") : t("PersonSheet.tutti")}
          </button>
        )}
      </div>
      <div className="no-scrollbar flex gap-3.5 overflow-x-auto pb-1">
        {shown.map((credit) => (
          <CreditCard
            key={`${credit.mediaType}-${credit.tmdbId}`}
            credit={credit}
            owned={items.find((i) => i.tmdbId === credit.tmdbId && i.tmdbMediaType === credit.mediaType)}
            onOpen={(item) => {
              close();
              openItem(item);
            }}
            onAdd={preview}
            adding={false}
          />
        ))}
      </div>
    </section>
  );
}

function PersonDetail({ name }: { name: string }) {
  const close = useSelectedPerson((s) => s.close);
  const containerRef = useFocusTrap(close);
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const openSettings = useSettingsSheet((s) => s.open);
  const openItem = useSelectedItem((s) => s.open);
  const items = useLibrary((s) => s.items);
  const setCriticQuestion = useCriticDraft((s) => s.setQuestion);
  const navigate = useNavigate();

  const [person, setPerson] = useState<TmdbPerson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bioOpen, setBioOpen] = useState(false);

  useEffect(() => {
    if (!tmdbApiKey) return;
    let cancelled = false;
    setPerson(null);
    setError(null);

    void (async () => {
      try {
        const id = await findPersonId(name, tmdbApiKey);
        if (id === null) throw new Error("not found");
        const found = await getPerson(id, tmdbApiKey);
        if (!cancelled) setPerson(found);
      } catch {
        if (!cancelled) setError(t("PersonSheet.nessuna_scheda_tmdb_trovata", { v0: name }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [name, tmdbApiKey]);

  const titleId = `person-${name}`;
  const [a, b] = paletteFor(name);
  const photo = profileUrl(person?.profilePath, "h632");

  /** What this person contributed to *your* shelf — the reason the page exists. */
  const inLibrary = items.filter(
    (i) => i.director.toLowerCase().includes(name.toLowerCase()) || i.cast.some((c) => c.toLowerCase() === name.toLowerCase()),
  );
  const rated = inLibrary.filter((i) => i.vote != null);
  const avgVote = rated.length ? rated.reduce((sum, i) => sum + (i.vote ?? 0), 0) / rated.length : null;

  return createPortal(
    <div
      className="fixed inset-0 z-70 overflow-y-auto bg-bg"
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="relative h-40 overflow-hidden">
        <div className="absolute inset-0" style={{ background: `linear-gradient(150deg, ${b}, ${a})` }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 25%, var(--bg) 100%)" }} />
      </div>

      <button
        type="button"
        onClick={close}
        aria-label={t("PersonSheet.torna_indietro")}
        className="icon-btn fixed left-3 top-3 z-20 bg-black/45 text-white backdrop-blur-md hover:bg-black/65 hover:text-white"
      >
        <BackIcon />
      </button>

      {/* `relative` so this paints above the positioned banner it overlaps:
          without it the portrait pulled up by the negative margin is clipped. */}
      <div className="relative mx-auto -mt-16 max-w-3xl px-4 pb-28 sm:px-6">
        <div className="flex items-end gap-4">
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 border-bg bg-surface-2 shadow-[var(--shadow-lg)]">
            {photo ? (
              <img src={photo} alt={t("PersonSheet.foto_di", { v0: name })} loading="lazy" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-text-faint">
                <PersonIcon size={32} />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <p className="text-xs text-text-faint">{person?.knownFor || t("PersonSheet.persona")}</p>
            <h1 id={titleId} className="mt-0.5 font-display text-2xl font-semibold leading-tight text-text">
              {person?.name ?? name}
            </h1>
          </div>
        </div>

        {/* What the library itself knows is rendered first and unconditionally:
            it needs no key, no network, and it is the reason you tapped a name. */}
        {inLibrary.length > 0 && (
          <div className="mt-4 rounded-lg bg-surface-2 p-3.5">
            <span className="text-xs font-medium text-text-faint">{t("PersonSheet.nella_tua_libreria")}</span>
            <p className="mt-1 text-sm text-text">
              <span className="font-mono tabular font-semibold" style={{ color: "var(--accent-text)" }}>
                {inLibrary.length}
              </span>{" "}
              {inLibrary.length === 1 ? t("PersonSheet.titolo") : t("PersonSheet.titoli")}
              {avgVote != null && (
                <>
                  {t("PersonSheet.voto_medio")}
                  <span className="font-mono tabular font-semibold" style={{ color: "var(--accent-text)" }}>
                    {avgVote.toFixed(1)}
                  </span>
                </>
              )}
            </p>
            <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto pb-1">
              {inLibrary.map((owned) => (
                <button
                  key={owned.id}
                  type="button"
                  onClick={() => {
                    close();
                    openItem(owned);
                  }}
                  aria-label={t("PersonSheet.apri_dettagli_di_2", { v0: owned.title, v1: owned.year })}
                  className="w-20 shrink-0 text-left"
                >
                  <PosterArt item={owned} size="sm" showTitle={!owned.posterPath} className="w-20" />
                  <p className="mt-1 line-clamp-2 text-xs font-medium text-text">{owned.title}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {!tmdbApiKey ? (
          <div className="mt-4 rounded-lg bg-surface-2 p-4">
            <p className="text-sm text-text-muted">
              {t("PersonSheet.la_filmografia_completa_arriva")}
            </p>
            <button
              type="button"
              onClick={() => openSettings()}
              className="btn btn-primary mt-3"
            >
              {t("PersonSheet.aggiungi_la_chiave")}
            </button>
          </div>
        ) : error ? (
          <p className="mt-6 text-sm text-text-muted">{error}</p>
        ) : !person ? (
          <div className="mt-6 flex flex-col gap-2.5">
            <div className="skeleton h-4 w-2/3 rounded-xs" aria-hidden="true" />
            <div className="skeleton h-4 w-1/2 rounded-xs" aria-hidden="true" />
            <div className="skeleton mt-3 h-36 rounded-md" aria-hidden="true" />
          </div>
        ) : (
          <>
            {person.biography && (
              <div className="mt-4">
                <p className={`text-sm leading-relaxed text-text-muted ${bioOpen ? "" : "line-clamp-4"}`}>
                  {person.biography}
                </p>
                <button
                  type="button"
                  onClick={() => setBioOpen((o) => !o)}
                  className="mt-1 text-xs font-medium text-accent-text"
                >
                  {bioOpen ? t("PersonSheet.riduci") : t("PersonSheet.leggi_tutto")}
                </button>
              </div>
            )}

            {(person.birthday || person.placeOfBirth) && (
              <p className="mt-2 text-xs text-text-faint">
                {[person.birthday, person.placeOfBirth].filter(Boolean).join(" · ")}
              </p>
            )}

            <CreditRow title={t("PersonSheet.regia")} credits={person.directingCredits} />
            <CreditRow title={t("PersonSheet.interpretazioni")} credits={person.actingCredits} />

            <button
              type="button"
              onClick={() => {
                setCriticQuestion(t("PersonSheet.da_dove_comincio_con", { v0: person.name }));
                close();
                navigate("/critico");
              }}
              className="btn btn-secondary mt-6 w-full"
            >
              {t("PersonSheet.chiedi_al_critico_da")}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function PersonSheetPortal() {
  const name = useSelectedPerson((s) => s.name);
  return name ? <PersonDetail key={name} name={name} /> : null;
}
