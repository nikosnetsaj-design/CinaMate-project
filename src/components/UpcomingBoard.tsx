import { useEffect, useState } from "react";
import { useLibrary } from "../store/useLibrary";
import { useSettings } from "../store/useSettings";
import { useSelectedItem } from "../store/useSelectedItem";
import { useReminders } from "../store/useReminders";
import { groupByMonth, loadUpcoming, trackedKey, type UpcomingEntry } from "../lib/upcoming";
import { countdown, dayLabel, daysBetweenToday } from "../lib/format";
import { requestNotificationPermission } from "../lib/notify";
import { PosterArt } from "./PosterArt";
import { EmptyState } from "./EmptyState";
import { BellIcon } from "./icons";

function ReminderToggle({ itemId, title }: { itemId: string; title: string }) {
  const enabled = useReminders((s) => s.enabled.includes(itemId));
  const toggle = useReminders((s) => s.toggle);
  const pushToast = useLibrary((s) => s.pushToast);

  async function onClick() {
    const on = toggle(itemId);
    if (!on) {
      pushToast("info", `Promemoria tolto per "${title}".`);
      return;
    }
    const granted = await requestNotificationPermission();
    pushToast(
      granted ? "success" : "info",
      granted
        ? `Ti avviso quando esce "${title}".`
        : `Promemoria salvato. Senza il permesso di notifica lo vedrai qui dentro, aprendo CineMate.`,
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={enabled}
      aria-label={enabled ? `Togli il promemoria per ${title}` : `Avvisami quando esce ${title}`}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors"
      style={{
        borderColor: enabled ? "color-mix(in srgb, var(--accent) 45%, transparent)" : "var(--border-strong)",
        background: enabled ? "color-mix(in srgb, var(--accent) 14%, transparent)" : "transparent",
        color: enabled ? "var(--accent-text)" : "var(--text-faint)",
      }}
    >
      <BellIcon size={15} filled={enabled} />
    </button>
  );
}

function EntryRow({ entry }: { entry: UpcomingEntry }) {
  const openItem = useSelectedItem((s) => s.open);
  const { item, date, type, season, episode } = entry;
  const days = daysBetweenToday(date);
  const imminent = days <= 7;

  return (
    <li className="flex items-center gap-3 rounded-md border border-border bg-surface p-2.5">
      <button
        type="button"
        onClick={() => openItem(item)}
        aria-label={`Apri dettagli di ${item.title}, ${item.year}`}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <PosterArt item={item} size="sm" showTitle={false} className="w-11 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-semibold text-text">{item.title}</p>
          <p className="mt-0.5 truncate text-xs text-text-faint">
            {type === "episodio"
              ? season != null && episode != null
                ? `Nuovo episodio · S${season}E${episode}`
                : "Nuovo episodio"
              : "Uscita del film"}
          </p>
          <p className="mt-0.5 font-mono tabular text-[11px]" style={{ color: imminent ? "var(--accent-text)" : "var(--text-faint)" }}>
            {dayLabel(date)} · {countdown(date)}
          </p>
        </div>
      </button>
      <ReminderToggle itemId={item.id} title={item.title} />
    </li>
  );
}

export function UpcomingBoard() {
  const items = useLibrary((s) => s.items);
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const [entries, setEntries] = useState<UpcomingEntry[] | null>(null);
  const key = trackedKey(items);

  useEffect(() => {
    let cancelled = false;
    setEntries(null);
    void loadUpcoming(useLibrary.getState().items, tmdbApiKey).then((list) => {
      if (!cancelled) setEntries(list);
    });
    return () => {
      cancelled = true;
    };
  }, [tmdbApiKey, key]);

  if (entries === null) {
    return (
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-[74px] rounded-md" aria-hidden="true" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        title="Niente in arrivo"
        description="Qui compaiono i nuovi episodi delle serie che stai seguendo e i film ancora da uscire che hai messo in watchlist."
      />
    );
  }

  const months = groupByMonth(entries);

  return (
    <div className="flex flex-col gap-6">
      {months.map(({ month, entries: monthEntries }) => (
        <section key={month} className="flex flex-col gap-2.5">
          <h2 className="font-display text-lg font-semibold capitalize text-text">
            {new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(
              new Date(`${month}-01T00:00:00`),
            )}
          </h2>
          <ul className="flex flex-col gap-2.5">
            {monthEntries.map((entry) => (
              <EntryRow key={`${entry.item.id}-${entry.date}`} entry={entry} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
