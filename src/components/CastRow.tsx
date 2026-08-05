import { useEffect, useState } from "react";
import { useSettings } from "../store/useSettings";
import { useSelectedItem } from "../store/useSelectedItem";
import { useSelectedPerson } from "../store/useSelectedPerson";
import { getCast, profileUrl, type TmdbCastMember } from "../lib/tmdb";
import type { Item } from "../types";

/**
 * Il cast con le facce e i personaggi, e la regia accanto.
 *
 * Era una fila di pastiglie con i nomi: giusta come elenco, inutile come
 * riconoscimento. Un attore si ricorda per la faccia e per il personaggio —
 * «quella di Skye» prima di «Chloe Bennet» — e le foto tonde sono la forma che
 * lo dice in mezzo secondo.
 *
 * Le pastiglie non sono sparite: restano quando TMDB non è collegato o la
 * chiave non c'è, perché i nomi la libreria li ha comunque e un buco sarebbe
 * peggio di una lista sobria.
 */

function CastCircle({ member }: { member: TmdbCastMember }) {
  const openPerson = useSelectedPerson((s) => s.open);
  const closeItem = useSelectedItem((s) => s.close);
  const photo = profileUrl(member.profilePath);

  return (
    <button
      type="button"
      onClick={() => {
        closeItem();
        openPerson(member.name);
      }}
      aria-label={`Apri la scheda di ${member.name}`}
      className="w-20 shrink-0 text-center"
    >
      <span className="block aspect-square overflow-hidden rounded-full bg-surface-2">
        {photo ? (
          <img src={photo} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-display text-lg text-text-faint">
            {member.name.slice(0, 1)}
          </span>
        )}
      </span>
      <span className="mt-1.5 block line-clamp-2 text-[11px] font-medium leading-snug text-text">{member.name}</span>
      {member.character && (
        <span className="mt-0.5 block line-clamp-2 text-[10px] leading-snug text-text-faint">{member.character}</span>
      )}
    </button>
  );
}

/** I nomi che la libreria conosce comunque, come prima. */
function NameChips({ names, prefix }: { names: string[]; prefix?: string }) {
  const openPerson = useSelectedPerson((s) => s.open);
  const closeItem = useSelectedItem((s) => s.close);
  if (names.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {names.map((name) => (
        <button
          key={name}
          type="button"
          onClick={() => {
            closeItem();
            openPerson(name);
          }}
          aria-label={`Apri la scheda di ${name}`}
          className="rounded-full border border-border-strong px-2.5 py-1 text-xs text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
        >
          {prefix && <span className="text-text-faint">{prefix} </span>}
          {name}
        </button>
      ))}
    </div>
  );
}

export function CastRow({ item }: { item: Item }) {
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const [cast, setCast] = useState<TmdbCastMember[] | null>(null);
  const [all, setAll] = useState(false);

  // A single director field can hold several names — TV shows list every creator.
  const directors = item.director
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);

  const mediaType = item.tmdbMediaType;

  useEffect(() => {
    if (!tmdbApiKey || item.tmdbId == null || mediaType == null) return;
    let cancelled = false;
    getCast(item.tmdbId, mediaType, tmdbApiKey)
      .then((r) => {
        if (!cancelled) setCast(r);
      })
      .catch(() => {
        // Nessun cast dalle immagini: sotto restano i nomi della libreria.
        if (!cancelled) setCast([]);
      });
    return () => {
      cancelled = true;
    };
  }, [item.tmdbId, mediaType, tmdbApiKey]);

  const fallbackCast = item.cast.filter(Boolean).slice(0, 5);
  const hasCircles = cast !== null && cast.length > 0;
  if (!hasCircles && directors.length === 0 && fallbackCast.length === 0) return null;

  const shown = hasCircles ? (all ? cast : cast.slice(0, 6)) : [];

  return (
    <div className="mt-4 flex flex-col gap-2.5">
      {hasCircles && (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs font-medium uppercase tracking-wide text-text-faint">Cast</span>
            {cast.length > 6 && (
              <button
                type="button"
                onClick={() => setAll((v) => !v)}
                className="text-xs font-medium"
                style={{ color: "var(--accent-text)" }}
              >
                {all ? "mostra meno" : "mostra tutti →"}
              </button>
            )}
          </div>
          <div className={all ? "flex flex-wrap gap-3" : "flex gap-3 overflow-x-auto pb-1"}>
            {shown.map((member) => (
              <CastCircle key={`${member.id}-${member.character}`} member={member} />
            ))}
          </div>
        </>
      )}

      {/* La regia resta una pastiglia anche quando il cast ha le facce: è una
          persona sola e in un cerchio da ottanta pixel si perderebbe. */}
      <NameChips names={directors} prefix="Regia ·" />
      {!hasCircles && <NameChips names={fallbackCast} />}
    </div>
  );
}
