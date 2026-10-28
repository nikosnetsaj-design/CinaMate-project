import { useSettings } from "../store/useSettings";
import { useSelectedItem } from "../store/useSelectedItem";
import { useUpcoming } from "../lib/useUpcoming";
import { countdown } from "../lib/format";
import { PosterArt } from "./PosterArt";
import { RowHeader } from "./RowHeader";

/** Home keeps the row short: the full calendar lives in Scopri. */
const MAX_ON_HOME = 8;

export function UpcomingRow() {
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const openItem = useSelectedItem((s) => s.open);
  const upcoming = useUpcoming();

  if (!tmdbApiKey || upcoming.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <RowHeader title="In arrivo" to="/scopri" action="Calendario" />
      <div className="shelf">
        {upcoming.slice(0, MAX_ON_HOME).map(({ item, date, season, episode }) => (
          <button
            key={item.id}
            type="button"
            onClick={() => openItem(item)}
            aria-label={`Apri dettagli di ${item.title}, ${item.year}`}
            className="group w-32 text-left sm:w-36"
          >
            <PosterArt item={item} size="sm" className="w-full transition-transform duration-200 group-active:scale-[0.98]" />
            <p className="mt-2 line-clamp-1 text-sm font-medium text-text">{item.title}</p>
            <p className="tabular text-xs text-text-faint">
              {season != null && episode != null ? `S${season}E${episode} · ` : ""}
              {countdown(date)}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}
