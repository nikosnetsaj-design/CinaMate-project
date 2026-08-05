import { useEffect, useMemo, useState } from "react";
import { useSettings } from "../store/useSettings";
import { useLibrary } from "../store/useLibrary";
import { useSelectedItem } from "../store/useSelectedItem";
import { useTitlePreview } from "../store/useTitlePreview";
import { useVisibleItems } from "../lib/useVisibleItems";
import { similarInLibrary } from "../lib/recommend";
import { getRecommendations, type TmdbSearchResult } from "../lib/tmdb";
import { PosterArt } from "./PosterArt";
import type { Item } from "../types";

/**
 * «Simili»: una sezione sola, non due.
 *
 * Prima erano due blocchi separati — le copertine di ciò che hai e, più sotto,
 * tre nomi nudi da aggiungere. Ma la domanda di chi apre questa scheda è una:
 * *e adesso cosa guardo che somigli a questo*. Che il titolo sia già tuo o no è
 * una differenza di cosa succede al tocco, non una ragione per due elenchi in
 * due posti diversi: qui i tuoi vengono per primi con marcato il motivo, gli
 * altri seguono con il «＋».
 *
 * I consigli non tuoi arrivano da `/recommendations` di TMDB — costruito su
 * cosa la gente guarda davvero dopo — e non dalle tre stringhe salvate il
 * giorno in cui il titolo è entrato in libreria, che erano nomi senza
 * copertina e invecchiavano lì.
 */

function Card({
  title,
  kind,
  posterPath,
  reason,
  owned,
  onClick,
}: {
  title: string;
  kind: Item["kind"];
  posterPath: string | null;
  reason?: string;
  owned: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="w-24 shrink-0 text-left sm:w-28">
      <div className="relative">
        <PosterArt item={{ title, kind, posterPath }} size="sm" showTitle={!posterPath} />
        <span
          aria-hidden="true"
          className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold"
          style={
            owned
              ? { background: "var(--accent)", color: "var(--accent-contrast)" }
              : { background: "rgba(0,0,0,0.55)", color: "#fff" }
          }
        >
          {owned ? "✓" : "＋"}
        </span>
      </div>
      <p className="mt-1.5 line-clamp-2 text-xs font-medium text-text">{title}</p>
      {reason && <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-text-faint">{reason}</p>}
    </button>
  );
}

export function SimilarTitles({ item }: { item: Item }) {
  const items = useVisibleItems();
  const allItems = useLibrary((s) => s.items);
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const openItem = useSelectedItem((s) => s.open);
  const openPreview = useTitlePreview((s) => s.open);
  const [recommended, setRecommended] = useState<TmdbSearchResult[] | null>(null);

  const shelfMates = useMemo(() => similarInLibrary(item, items), [item, items]);

  useEffect(() => {
    if (!tmdbApiKey || item.tmdbId == null || item.tmdbMediaType == null) return;
    let cancelled = false;
    getRecommendations(item.tmdbId, item.tmdbMediaType, tmdbApiKey)
      .then((r) => {
        if (!cancelled) setRecommended(r);
      })
      .catch(() => {
        if (!cancelled) setRecommended([]);
      });
    return () => {
      cancelled = true;
    };
  }, [item.tmdbId, item.tmdbMediaType, tmdbApiKey]);

  // I consigli che *hai già* sono ridondanti: la scheda li mostra fra i tuoi,
  // con un motivo vero al posto di «consigliato».
  const ownedTmdbIds = new Set(allItems.map((i) => i.tmdbId).filter((id): id is number => id != null));
  const fresh = (recommended ?? []).filter((r) => !ownedTmdbIds.has(r.tmdbId)).slice(0, 10);

  // La lista di TMDB salvata al momento dell'inserimento resta il ripiego per
  // chi non ha la chiave: tre nomi sono pochi, ma sono meglio di niente.
  const legacy = tmdbApiKey ? [] : item.similar.filter(Boolean).slice(0, 6);

  if (shelfMates.length === 0 && fresh.length === 0 && legacy.length === 0) {
    return (
      <p className="text-sm text-text-faint">
        Niente che gli somigli davvero, per ora — né sul tuo scaffale né fra i consigli di TMDB.
        Meglio una riga vuota che tre titoli messi lì a caso.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-text-faint">
        Il segno di spunta è roba tua: si apre. Il più è da aggiungere: si guarda prima.
      </p>

      <div className="flex gap-3 overflow-x-auto pb-1">
        {shelfMates.map(({ item: other, reason }) => (
          <Card
            key={other.id}
            title={other.title}
            kind={other.kind}
            posterPath={other.posterPath ?? null}
            reason={reason}
            owned
            onClick={() => openItem(other)}
          />
        ))}

        {fresh.map((r) => (
          <Card
            key={r.tmdbId}
            title={r.title}
            kind={r.kind}
            posterPath={r.posterPath}
            reason="Chi ha visto questo ha visto anche"
            owned={false}
            onClick={() => openPreview(r)}
          />
        ))}
      </div>

      {legacy.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {legacy.map((name) => (
            <span key={name} className="rounded-full border border-border-strong px-3 py-1.5 text-xs text-text-muted">
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
