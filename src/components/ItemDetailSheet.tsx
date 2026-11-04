import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useFocusTrap } from "../lib/useFocusTrap";
import { similarInLibrary } from "../lib/recommend";
import { paletteFor } from "../lib/palette";
import { formatRuntime, scrollBehavior } from "../lib/format";
import { STATUSES } from "../lib/status";
import { backdropSrcSet, backdropUrl } from "../lib/tmdb";
import { PosterArt } from "./PosterArt";
import { StatusMark } from "./StatusChip";
import { WatchAndLinks } from "./WatchAndLinks";
import { WatchButton } from "./WatchButton";
import { LinkToTmdb } from "./LinkToTmdb";
import { ItemSagaStrip } from "./ItemSagaStrip";
import { SagaLine } from "./SagaLine";
import { CastRow } from "./CastRow";
import { TitleFacts } from "./TitleFacts";
import { RelatedRow } from "./RelatedRow";
import { CollectionGrid } from "./CollectionGrid";
import { ShareSheet } from "./ShareSheet";
import { EpisodeList } from "./EpisodeList";
import { EpisodeGrid } from "./EpisodeGrid";
import { episodeLabel, nextEpisode } from "../lib/episodes";
import { DownloadButton } from "./DownloadButton";
import { SpoilerFreeRecap, TranslateOverview } from "./AiItemExtras";
import { BackIcon, EyeIcon, HeartIcon, InfoIcon, ListIcon, MinusIcon, PlayIcon, PlusIcon, ShareIcon, SparkleIcon, StackIcon, StarIcon } from "./icons";
import { ListPickerSheet } from "./ListPickerSheet";
import { TrailerPlayer } from "./TrailerPlayer";
import { youtubeKey } from "../lib/youtube";
import { useLists } from "../store/useLists";
import { useSelectedItem } from "../store/useSelectedItem";
import { useLibrary } from "../store/useLibrary";
import { useEditSheet } from "../store/useEditSheet";
import { useRateSheet } from "../store/useRateSheet";
import { useAddSheet } from "../store/useAddSheet";
import { useCriticDraft } from "../store/useCriticDraft";
import { useTitleLogo } from "../lib/useTitleLogo";
import { useFranchise } from "../lib/useFranchise";
import type { Item, Status } from "../types";
import { platformLabel, statusLabel, t } from "../lib/i18n";

/**
 * Un'azione tonda della riga sotto ai pulsanti: icona grande, parola sotto.
 *
 * È la forma che usano tutte le app di streaming per lo stesso motivo — sono
 * cinque cose che si fanno *al* titolo, e messe in fila come pulsanti pieni
 * sembrerebbero tutte l'azione principale, che è invece una sola: Guarda.
 */
function RoundAction({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="group flex min-w-16 flex-col items-center gap-1.5 text-xs font-medium text-text-muted"
    >
      {/* Un cerchio pieno e neutro per tutte e cinque: quando un'azione è
          accesa lo dice l'icona, nel colore dell'accento. Prima erano cinque
          anelli, e i tre accesi avevano anche il fondo colorato — la riga più
          colorata della scheda, sotto il titolo. */}
      <span
        className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 transition-[transform,background-color] duration-200 group-hover:bg-surface-hover group-active:scale-95"
        style={{ color: active ? "var(--accent-text)" : "var(--text)" }}
      >
        {children}
      </span>
      {label}
    </button>
  );
}

type Tab = "episodi" | "dettagli" | "collezione" | "simili";

function ItemDetail({ item }: { item: Item }) {
  const close = useSelectedItem((s) => s.close);
  const open = useSelectedItem((s) => s.open);
  const items = useLibrary((s) => s.items);
  const setStatus = useLibrary((s) => s.setStatus);
  const toggleFav = useLibrary((s) => s.toggleFav);
  const incrementEpisode = useLibrary((s) => s.incrementEpisode);
  const decrementEpisode = useLibrary((s) => s.decrementEpisode);
  const setRewatch = useLibrary((s) => s.setRewatch);
  const removeItem = useLibrary((s) => s.removeItem);
  const openEdit = useEditSheet((s) => s.openEdit);
  const openRate = useRateSheet((s) => s.open);
  const openAddSheet = useAddSheet((s) => s.open);
  const setCriticQuestion = useCriticDraft((s) => s.setQuestion);
  const navigate = useNavigate();

  const containerRef = useFocusTrap(close);
  const tabsRef = useRef<HTMLDivElement>(null);
  const titleId = `item-detail-${item.id}`;
  const logo = useTitleLogo(item);
  const shelfMates = useMemo(() => similarInLibrary(item, items), [item, items]);
  const [sharing, setSharing] = useState(false);
  const [pickingList, setPickingList] = useState(false);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const trailerKey = youtubeKey(item.trailerUrl);
  const inLists = useLists((s) => s.lists.some((l) => l.kind === "manual" && l.itemIds.includes(item.id)));
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [a, b] = paletteFor(item.title);
  const isSeries = item.kind !== "film" && item.kind !== "doc";
  const [tab, setTab] = useState<Tab>(isSeries ? "episodi" : "dettagli");
  const nextUp = nextEpisode(item);
  const pct = isSeries && item.episodes ? Math.round(((item.seen || 0) / item.episodes) * 100) : null;
  const watchedMinutes = item.kind === "film" ? (item.status === "Visto" ? item.runtime : 0) : (item.seen || 0) * item.runtime;

  // La collezione decide da sola se esistere: per un film la conosce TMDB
  // (`collectionId`), per una serie la ricostruisce `lib/franchise.ts` e la
  // risposta arriva poco dopo l'apertura. La scheda compare quando c'è
  // qualcosa dentro, e non prima — una scheda vuota è peggio di una in meno.
  const franchise = useFranchise(item);
  // Finché la risposta non c'è vale la collezione TMDB, che si sa dal record:
  // per i film — il caso comune — la scheda è lì da subito e non compare a
  // pagina già letta. Dopo, decide quello che è stato trovato davvero.
  const hasCollection = franchise.loading ? item.collectionId != null : franchise.entries.length > 1;

  const TABS: { id: Tab; label: string }[] = [
    ...(isSeries ? [{ id: "episodi" as const, label: t("ItemDetailSheet.episodi_2") }] : []),
    ...(hasCollection ? [{ id: "collezione" as const, label: t("ItemDetailSheet.collezione") }] : []),
    { id: "dettagli", label: t("ItemDetailSheet.dettagli") },
    { id: "simili", label: t("ItemDetailSheet.simili") },
  ];
  // La scheda scelta può sparire sotto i piedi — una collezione che si rivela
  // vuota — e senza questo resterebbe un pannello vuoto senza nessuna linguetta
  // accesa. In quel caso vince la prima.
  const active: Tab = TABS.some((t) => t.id === tab) ? tab : TABS[0].id;

  return createPortal(
    <div className="fixed inset-0 z-70 overflow-y-auto bg-bg" ref={containerRef} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      {/* L'intestazione larga, con il play sopra: è la prima cosa che si vede e
          la prima cosa che si vuole fare. La locandina verticale resta in
          basso a sinistra, perché è quella che rende il titolo riconoscibile. */}
      <div className="relative aspect-video max-h-[46vh] w-full overflow-hidden">
        <div className="absolute inset-0" style={{ background: `linear-gradient(150deg, ${b}, ${a})` }} />
        {item.backdropPath && (
          <img
            src={backdropUrl(item.backdropPath, "w1280") ?? undefined}
            srcSet={backdropSrcSet(item.backdropPath)}
            sizes="100vw"
            alt=""
            aria-hidden="true"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 35%, var(--bg) 100%)" }} />

        <button
          type="button"
          onClick={() => {
            close();
            navigate(`/player?titolo=${encodeURIComponent(item.id)}`);
          }}
          aria-label={t("ItemDetailSheet.riproduci", { v0: item.title })}
          className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md transition-transform duration-200 hover:scale-105 active:scale-95"
        >
          <PlayIcon size={28} />
        </button>

        {/* Locandina, voto e trailer allineati alla colonna del testo, non ai
            bordi dello schermo: su un tablet in orizzontale o sul computer la
            locandina stava appoggiata al margine sinistro e il titolo a
            centinaia di pixel di distanza. */}
        <div className="absolute inset-x-0 bottom-3.5">
          <div className="mx-auto flex max-w-3xl items-end gap-3.5 px-4 sm:px-6">
            <PosterArt item={item} size="lg" showTitle={false} priority className="w-20 shrink-0 shadow-[var(--shadow-lg)] sm:w-24" />
            {item.vote != null && (
              <button
                type="button"
                onClick={() => openRate(item.id)}
                aria-label={t("ItemDetailSheet.cambia_il_voto", { v0: item.vote })}
                className="pb-1 text-left transition-transform active:scale-95"
              >
                <span className="tabular text-4xl font-semibold leading-none text-white">{item.vote}</span>
                <span className="text-sm text-white/70">/10</span>
              </button>
            )}
            {/* Il trailer sta sull'immagine, dove lo cerca l'occhio, e si apre
                qui dentro invece che su YouTube: uscire per novanta secondi
                voleva dire perdere la scheda. Così la fila delle azioni resta
                di cinque. */}
            {trailerKey && (
              <button
                type="button"
                onClick={() => setTrailerOpen(true)}
                className="btn btn-sm mb-0.5 ml-auto bg-black/45 text-white backdrop-blur-md hover:bg-black/65"
              >
                <PlayIcon size={14} />
                {t("ItemDetailSheet.trailer")}
              </button>
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={close}
        aria-label={t("ItemDetailSheet.torna_indietro")}
        className="icon-btn fixed left-3 top-3 z-20 bg-black/45 text-white backdrop-blur-md hover:bg-black/65 hover:text-white"
      >
        <BackIcon />
      </button>

      <div className="mx-auto max-w-3xl px-4 pb-28 pt-4 sm:px-6">
        <span className="text-sm font-medium text-text-muted">{platformLabel(item.platform)}</span>
        <div className="mt-0.5 flex items-start justify-between gap-3">
          {/* Il logo disegnato quando TMDB ce l'ha, il titolo scritto quando
              non c'è. L'`h1` resta in entrambi i casi: l'immagine porta il
              testo nell'`alt`, così l'intestazione della pagina esiste anche
              per chi non la vede. */}
          <h1 id={titleId} className="t-display text-text">
            {logo ? (
              <img src={logo} alt={item.title} className="max-h-16 w-auto max-w-[min(100%,20rem)] object-contain" />
            ) : (
              item.title
            )}
          </h1>
        </div>

        {/* La riga dei dati: anno, classificazione, quanto dura. Testo nudo
            separato da punti invece di sei pastiglie — sono fatti, non filtri,
            e incasellarli li faceva sembrare cliccabili. */}
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm tabular text-text-muted">
          {[
            item.year || null,
            item.certification || null,
            isSeries && item.seasons ? t(item.seasons === 1 ? "ItemDetailSheet.stagione" : "ItemDetailSheet.stagioni", { v0: item.seasons }) : null,
            item.runtime ? formatRuntime(item.runtime) + (isSeries ? "/ep" : "") : null,
            item.genre || null,
            item.quality || null,
          ]
            .filter(Boolean)
            .map((value, i) => (
              <span key={String(value)} className="flex items-center gap-2">
                {i > 0 && <span aria-hidden="true" className="text-text-faint">·</span>}
                {value === item.certification || value === item.quality ? (
                  <span className="rounded-xs bg-surface-2 px-1.5 py-px text-xs font-medium text-text">{value}</span>
                ) : (
                  value
                )}
              </span>
            ))}
        </p>

        {/* Alto di proposito: "guardalo adesso" è il motivo per cui la scheda si
            apre dopo una ricerca, e stava sotto le note. */}
        <WatchButton item={item} onNavigate={close} />
        <DownloadButton item={item} />

        {/* Cinque azioni, tutte reversibili e tutte con un effetto visibile.
            "La mia lista" non c'è: in CineMate la lista *è* lo stato, che ha
            la sua riga di pastiglie in Dettagli, e un interruttore a due valori
            avrebbe dovuto inventare uno stato "non in lista" che non esiste. */}
        <div className="mt-6 flex flex-wrap justify-around gap-2">
          <RoundAction label={t("ItemDetailSheet.preferito")} active={item.fav} onClick={() => toggleFav(item.id)}>
            <HeartIcon size={17} filled={item.fav} />
          </RoundAction>
          <RoundAction label={t("ItemDetailSheet.voto")} active={item.vote != null} onClick={() => openRate(item.id)}>
            <StarIcon size={17} filled={item.vote != null} />
          </RoundAction>
          <RoundAction
            label={t("ItemDetailSheet.guardato")}
            active={item.status === "Visto"}
            // Coppia onesta: "l'ho visto" e "voglio vederlo" sono i due stati
            // fra cui questo pulsante può spostarti senza inventare nulla.
            onClick={() => {
              const watched = item.status !== "Visto";
              setStatus(item.id, watched ? "Visto" : "Da vedere");
              // Appena visto e senza voto: la domanda giusta arriva da sola.
              if (watched && item.vote == null) openRate(item.id);
            }}
          >
            <EyeIcon size={17} />
          </RoundAction>
          <RoundAction label={t("ItemDetailSheet.liste")} active={inLists} onClick={() => setPickingList(true)}>
            <ListIcon size={17} />
          </RoundAction>
          <RoundAction label={t("ItemDetailSheet.condividi")} onClick={() => setSharing(true)}>
            <ShareIcon size={17} />
          </RoundAction>
        </div>

        {item.overview && <p className="mt-6 text-base leading-relaxed text-text-muted">{item.overview}</p>}

        {/* Il voto di TMDB sta qui e non accanto al tuo, in cima: sono due
            giudizi diversi e affiancarli suggerirebbe un confronto che non
            interessa a nessuno. Qui è un dato del titolo fra gli altri. */}
        {item.tmdbRating != null && (
          <p className="mt-2.5 flex items-center gap-2 text-sm text-text-muted">
            <span className="flex text-text-faint">
              <StarIcon size={14} filled />
            </span>
            <span className="tabular font-semibold text-text">{item.tmdbRating.toFixed(1)}</span>
            <span className="text-text-faint">{t("CatalogSheet.media_di_tmdb")}</span>
          </p>
        )}

        <CastRow item={item} />

        {/* La collezione, annunciata dove si legge la scheda invece che solo
            nella riga delle linguette. Una serie che fa parte di qualcosa di
            più grande è un fatto del titolo, come l'anno o il cast: dirlo qui
            costa una riga e risparmia la scoperta per caso. Sparisce quando sei
            già nella scheda che aprirebbe. */}
        {hasCollection && active !== "collezione" && (
          <button
            type="button"
            onClick={() => {
              setTab("collezione");
              requestAnimationFrame(() => tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
            }}
            className="mt-4 flex w-full items-center gap-3 rounded-md border border-border bg-surface-2 p-3.5 text-left transition-colors hover:bg-surface-hover"
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{ background: "color-mix(in srgb, var(--accent) 16%, transparent)", color: "var(--accent-text)" }}
            >
              <StackIcon size={17} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] uppercase tracking-[0.16em] text-text-faint">
                {t("ItemDetailSheet.fa_parte_di_una")}
              </span>
              <span className="block truncate font-display text-sm font-semibold text-text">
                {franchise.name ||
                  (item.collectionName ?? "") ||
                  t("ItemDetailSheet.titoli_nella_stessa_storia", { v0: franchise.progress.total })}
              </span>
            </span>
            {franchise.progress.total > 0 && (
              <span className="shrink-0 font-mono tabular text-[11px] text-text-faint">
                {franchise.progress.watched}/{franchise.progress.total}
              </span>
            )}
            <span aria-hidden="true" className="shrink-0 text-text-faint">
              →
            </span>
          </button>
        )}

        {/* «Maggiori informazioni»: la scorciatoia dal cast ai dati del film.
            Le schede qui sotto ci sono già, ma dopo una fila di facce lo
            sguardo è a metà pagina e la riga delle schede è appena passata —
            un bersaglio grande che dice dove si va costa meno di una
            risalita. Sparisce quando sei già nella scheda che aprirebbe. */}
        <button
          type="button"
          onClick={() => {
            setTab("dettagli");
            // Sul frame successivo: se la scheda cambia, il blocco dei dati
            // non è ancora nel documento e lo scorrimento non troverebbe nulla.
            requestAnimationFrame(() => tabsRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: "start" }));
          }}
          className="chip mt-4 w-full"
        >
          <InfoIcon size={17} />
          {t("ItemDetailSheet.maggiori_informazioni")}
        </button>

        {/* Gli stessi segmenti di Tu, Cerca e Scopri: un modo solo, in tutta
            l'app, di dire in quale parte di una cosa ti trovi. */}
        <div
          ref={tabsRef}
          className="no-scrollbar mt-6 flex scroll-mt-4 gap-2 overflow-x-auto"
          role="tablist"
          aria-label={t("ItemDetailSheet.sezioni_del_titolo")}
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active === t.id}
              onClick={() => setTab(t.id)}
              className="chip"
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-5">
          {active === "episodi" && (
            <div className="flex flex-col gap-4">
              {/* Prima delle puntate: è la domanda di chi sta per riprendere. */}
              <SpoilerFreeRecap item={item} />
              <EpisodeList item={item} onNavigate={close} />

              {item.episodes ? (
                <div className="rounded-lg bg-surface p-4 shadow-[var(--shadow-sm)]">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-medium text-text">{t("ItemDetailSheet.avanzamento")}</span>
                    <span className="tabular text-sm font-semibold text-text-muted">{pct}%</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-hover">
                    <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${pct}%`, background: "var(--accent)" }} />
                  </div>
                  <div className="mt-1.5 flex justify-between text-xs tabular text-text-muted">
                    <span>
                      {item.seen || 0} {t("ItemDetailSheet.di")} {item.episodes} {t("ItemDetailSheet.episodi")}
                    </span>
                    <span>{formatRuntime(watchedMinutes)} {t("ItemDetailSheet.guardate")}</span>
                  </div>
                  <div className="mt-4">
                    <EpisodeGrid item={item} />
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => decrementEpisode(item.id)}
                      disabled={(item.seen || 0) === 0}
                      aria-label={t("ItemDetailSheet.togli_l_ultimo_episodio")}
                      className="btn btn-secondary btn-sm flex-1 disabled:opacity-40"
                    >
                      <MinusIcon size={16} />
                      {t("ItemDetailSheet.togli")}
                    </button>
                    <button
                      type="button"
                      onClick={() => incrementEpisode(item.id)}
                      disabled={!nextUp}
                      className="btn btn-primary btn-sm flex-[2] disabled:opacity-40"
                    >
                      {nextUp ? t("ItemDetailSheet.segna", { v0: episodeLabel(nextUp) }) : t("ItemDetailSheet.tutto_visto")}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {active === "dettagli" && (
            <div className="flex flex-col">
              <div>
                <span className="mb-2 block text-sm font-medium text-text">{t("ItemDetailSheet.stato")}</span>
                <div className="flex flex-wrap gap-2">
                  {STATUSES.map((s: Status) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setStatus(item.id, s);
                        if (s === "Visto" && item.status !== "Visto" && item.vote == null) openRate(item.id);
                      }}
                      aria-pressed={item.status === s}
                      className="chip"
                    >
                      <StatusMark status={s} />
                      {statusLabel(s)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex gap-3">
                <div className="flex flex-1 items-center justify-between gap-3 rounded-lg bg-surface-2 p-3 pl-4">
                  <div>
                    <span className="block text-sm font-medium text-text">{t("ItemDetailSheet.rivisto")}</span>
                    <span className="tabular text-sm text-text-muted">
                      {item.rewatch || 0} {(item.rewatch || 0) === 1 ? t("ItemDetailSheet.volta") : t("ItemDetailSheet.volte")}
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setRewatch(item.id, (item.rewatch || 0) - 1)}
                      aria-label={t("ItemDetailSheet.una_volta_in_meno")}
                      disabled={(item.rewatch || 0) === 0}
                      className="icon-btn bg-surface-hover disabled:opacity-40"
                    >
                      <MinusIcon />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRewatch(item.id, (item.rewatch || 0) + 1)}
                      aria-label={t("ItemDetailSheet.una_volta_in_piu")}
                      className="icon-btn bg-surface-hover"
                    >
                      <PlusIcon />
                    </button>
                  </div>
                </div>
                {item.vote == null && (
                  <button
                    type="button"
                    onClick={() => openRate(item.id)}
                    className="btn btn-secondary btn-sm flex-1"
                  >
                    <StarIcon size={14} />
                    {t("ItemDetailSheet.dai_un_voto")}
                  </button>
                )}
              </div>

              <TranslateOverview item={item} />

              {item.notes && (
                <div className="mt-4 rounded-lg bg-surface p-4 shadow-[var(--shadow-sm)]">
                  <span className="mb-1.5 block text-sm font-medium text-text-muted">{t("ItemDetailSheet.le_tue_note")}</span>
                  <p className="text-sm italic leading-relaxed text-text">{item.notes}</p>
                </div>
              )}

              <WatchAndLinks item={item} />

              {/* Chi l'ha fatto, quanto è costato, chi l'ha prodotto, cosa c'è
                  da vedere. Sotto "dove guardarlo" perché è la scheda del film
                  in sé: si legge dopo aver deciso *se* guardarlo. */}
              <TitleFacts item={item} />

              <LinkToTmdb item={item} />

              {/* L'eliminazione si conferma qui dentro, con le parole che dicono
                  cosa si perde. Era il dialogo grigio del browser: l'unico punto
                  dell'app che sembrasse una pagina web. */}
              {confirmingDelete ? (
                <div
                  role="alert"
                  aria-labelledby={`${titleId}-delete`}
                  className="mt-6 rounded-lg p-4"
                  style={{ background: "color-mix(in srgb, var(--danger) 10%, var(--surface))" }}
                >
                  <p id={`${titleId}-delete`} className="text-sm text-text">
                    {t("ItemDetailSheet.tolgo")}{item.title}{t("ItemDetailSheet.dalla_libreria_voto_note")}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => setConfirmingDelete(false)} className="btn btn-secondary flex-1">
                      {t("ItemDetailSheet.annulla")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        removeItem(item.id);
                        close();
                      }}
                      className="btn btn-danger-fill flex-1"
                    >
                      {t("ItemDetailSheet.elimina")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-6 flex gap-2">
                  <button type="button" onClick={() => openEdit(item)} className="btn btn-secondary flex-1">
                    {t("ItemDetailSheet.modifica")}
                  </button>
                  <button type="button" onClick={() => setConfirmingDelete(true)} className="btn btn-danger flex-1">
                    {t("ItemDetailSheet.elimina")}
                  </button>
                </div>
              )}
            </div>
          )}

          {active === "collezione" && (
            <div className="flex flex-col gap-5">
              {/* Prima la linea dei capitoli — prequel e sequel in ordine, con
                  "sei qui" — che esiste solo per i film di una collezione TMDB.
                  Poi la griglia, che tiene dentro anche quello che una
                  collezione TMDB non sa: le serie, gli spin-off, i
                  documentari. Per una serie c'è solo la seconda, ed è
                  esattamente il buco che prima non aveva niente. */}
              <SagaLine item={item} />
              <CollectionGrid item={item} />
              <ItemSagaStrip item={item} />
            </div>
          )}

          {active === "simili" && (
            <div className="flex flex-col gap-4">
              {/* Le locandine di TMDB per prime: sono la risposta piena alla
                  domanda "e adesso cosa guardo", e i titoli che hai già
                  portano il segno invece di sparire. */}
              <RelatedRow item={item} />

              {/* Due domande diverse, quindi due sezioni. Questa è "questi ce
                  li hai già"; quella sotto è la lista TMDB di ciò che non hai,
                  ed è per questo che una apre un titolo e l'altra il foglio di
                  aggiunta. */}
              {shelfMates.length > 0 && (
                <div>
                  <span className="mb-2 block text-sm font-medium text-text">
                    {isSeries ? t("ItemDetailSheet.serie_simili_sul_tuo") : t("ItemDetailSheet.film_simili_sul_tuo")}
                  </span>
                  <div className="shelf gap-3">
                    {shelfMates.map(({ item: other, reason }) => (
                      <button
                        key={other.id}
                        type="button"
                        onClick={() => open(other)}
                        aria-label={t("ItemDetailSheet.apri_dettagli_di", { v0: other.title, v1: other.year })}
                        className="w-28 text-left"
                      >
                        <PosterArt item={other} size="sm" className="w-full" />
                        <p className="mt-2 line-clamp-2 text-sm font-medium leading-snug text-text">{other.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-text-faint">{reason}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Le tre stringhe salvate al momento dell'aggiunta restano solo
                  per i titoli non collegati a TMDB: per gli altri la fila di
                  locandine qui sopra dice la stessa cosa, meglio e con venti
                  titoli invece di tre. */}
              {item.similar.length > 0 && item.tmdbId == null && (
                <div>
                  <span className="mb-2 block text-sm font-medium text-text">{t("ItemDetailSheet.se_ti_e_piaciuto")}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {item.similar.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          close();
                          openAddSheet(s);
                        }}
                        className="chip"
                      >
                        {s}
                        <PlusIcon size={14} />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setCriticQuestion(t("ItemDetailSheet.parlami_di_e_consigliami", { v0: item.title }));
                  close();
                  navigate("/critico");
                }}
                className="btn btn-secondary w-full"
              >
                <SparkleIcon size={18} />
                {t("ItemDetailSheet.chiedi_al_critico")}
              </button>
            </div>
          )}
        </div>
      </div>

      {sharing && <ShareSheet target={{ kind: "item", item }} onClose={() => setSharing(false)} />}
      {pickingList && <ListPickerSheet item={item} onClose={() => setPickingList(false)} />}
      {trailerOpen && trailerKey && (
        <TrailerPlayer videoKey={trailerKey} title={t("ItemDetailSheet.trailer_2", { v0: item.title })} onClose={() => setTrailerOpen(false)} />
      )}
    </div>,
    document.body,
  );
}

export function ItemDetailSheetPortal() {
  const selected = useSelectedItem((s) => s.item);
  // Follow the live record rather than the snapshot captured on open, so edits
  // made from inside the sheet are reflected immediately. Falls back to the
  // snapshot for the frame between deleting an item and the sheet closing.
  const live = useLibrary((s) => (selected ? s.items.find((i) => i.id === selected.id) : undefined));
  const item = live ?? selected;
  return item ? <ItemDetail key={item.id} item={item} /> : null;
}
