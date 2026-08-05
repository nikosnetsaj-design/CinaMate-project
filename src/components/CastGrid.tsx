import { useEffect, useState } from "react";
import { useSettings } from "../store/useSettings";
import { useSelectedPerson } from "../store/useSelectedPerson";
import { useSelectedItem } from "../store/useSelectedItem";
import { getCredits, profileUrl, type TmdbCastMember } from "../lib/tmdb";
import { PersonChip } from "./PeopleLinks";
import type { Item } from "../types";

/**
 * Il cast come volti invece che come elenco di nomi.
 *
 * Un nome si riconosce se lo si è già letto; una faccia si riconosce e basta —
 * "quella del film di ieri sera" è il modo in cui la gente cerca davvero un
 * attore. Da qui si apre la sua scheda, come dai nomi di prima.
 *
 * I volti arrivano da una chiamata a parte, fatta a foglio aperto e tenuta in
 * cache: in libreria il cast è salvato come cinque stringhe, e cambiarlo in
 * oggetti avrebbe voluto dire migrare ogni scheda mai scritta per una cosa che
 * si vede solo qui. Senza chiave TMDB, offline o mentre la richiesta è in volo
 * restano i nomi, che nella scheda ci sono già.
 */
function Initials({ name }: { name: string }) {
  const letters = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
  return (
    <span className="flex h-full w-full items-center justify-center bg-surface-hover font-display text-lg text-text-faint">
      {letters}
    </span>
  );
}

export function CastGrid({ item }: { item: Item }) {
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const openPerson = useSelectedPerson((s) => s.open);
  const closeItem = useSelectedItem((s) => s.close);
  const [cast, setCast] = useState<TmdbCastMember[] | null>(null);

  useEffect(() => {
    if (!item.tmdbId || !item.tmdbMediaType || !tmdbApiKey) return;
    let cancelled = false;
    getCredits(item.tmdbId, item.tmdbMediaType, tmdbApiKey)
      .then((res) => {
        if (!cancelled) setCast(res);
      })
      // Silenzioso di proposito: sotto c'è già l'elenco dei nomi, e un errore
      // rosso per una fotografia mancante sarebbe rumore.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [item.tmdbId, item.tmdbMediaType, tmdbApiKey]);

  // Senza volti si torna ai nomi salvati sulla scheda: è quello che c'era
  // prima, e funziona senza chiave, senza rete e sui titoli mai collegati.
  const names = item.cast.filter(Boolean).slice(0, 5);
  if (!cast || cast.length === 0) {
    if (names.length === 0) return null;
    return (
      <div className="mt-3 flex flex-wrap gap-1.5">
        {names.map((name) => (
          <PersonChip key={`cast-${name}`} name={name} />
        ))}
      </div>
    );
  }

  return (
    <div className="mt-4">
      <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-text-faint">Cast</span>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
        {cast.map((person) => (
          <button
            key={`${person.name}-${person.character}`}
            type="button"
            onClick={() => {
              closeItem();
              openPerson(person.name);
            }}
            aria-label={`Apri la scheda di ${person.name}`}
            className="w-[4.5rem] shrink-0 text-left"
          >
            <div className="h-[4.5rem] w-[4.5rem] overflow-hidden rounded-full border border-border">
              {person.profilePath ? (
                <img
                  src={profileUrl(person.profilePath) ?? undefined}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              ) : (
                <Initials name={person.name} />
              )}
            </div>
            <p className="mt-1.5 text-[11px] leading-tight text-text">{person.name}</p>
            {person.character && (
              <p className="text-[11px] leading-tight text-text-faint">{person.character}</p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
