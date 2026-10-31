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
import { BellIcon, CalendarIcon } from "./icons";

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
      className="icon-btn icon-btn-sm shrink-0"
      style={{
        background: enabled ? "color-mix(in srgb, var(--accent) 16%, transparent)" : "var(--surface-2)",
        color: enabled ? "var(--accent-text)" : "var(--text-muted)",
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
    <li className="list-row gap-3 py-2.5">
      <button
        type="button"
        onClick={() => openItem(item)}
        aria-label={`Apri dettagli di ${item.title}, ${item.year}`}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <PosterArt item={item} size="sm" showTitle={false} className="w-11 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text">{item.title}</p>
          <p className="mt-0.5 truncate text-xs text-text-muted">
            {type === "episodio"
              ? season != null && episode != null
                ? `Nuovo episodio · S${season}E${episode}`
                : "Nuovo episodio"
              : "Uscita del film"}
          </p>
          <p className="mt-0.5 font-mono tabular text-xs" style={{ color: imminent ? "var(--accent-text)" : "var(--text-faint)" }}>
            {dayLabel(date)} · {countdown(date)}
          </p>
        </div>
      </button>
      <ReminderToggle itemId={item.id} title={item.title} />
    </li>
  );
}

/**
 * Le uscite nel calendario del telefono: un file .ics, che si importa una
 * volta e si reimporta quando cambia qualcosa (gli eventi si aggiornano, non
 * si doppiano). Le uscite con la campanella portano anche l'avviso.
 */
function CalendarExport({ entries }: { entries: UpcomingEntry[] }) {
  const reminders = useReminders((s) => s.enabled);
  const pushToast = useLibrary((s) => s.pushToast);
  const withAlarm = entries.filter((e) => reminders.includes(e.item.id)).length;

  async function onClick() {
    const { buildIcs, deliverIcs } = await import("../lib/ics");
    const outcome = await deliverIcs(buildIcs(entries, new Set(reminders)));
    if (outcome === "downloaded") pushToast("success", "File del calendario scaricato: aprilo per aggiungere le uscite.");
  }

  return (
    <div className="flex flex-col items-start gap-3 rounded-lg bg-surface p-4 shadow-[var(--shadow-sm)] sm:flex-row sm:items-center sm:justify-between">
      <p className="min-w-0 text-sm text-text-muted sm:flex-1">
        {entries.length} {entries.length === 1 ? "uscita" : "uscite"} nel calendario del telefono
        {withAlarm > 0 ? `, ${withAlarm} con l'avviso della campanella` : ""}.
      </p>
      <button type="button" className="btn btn-secondary btn-sm shrink-0" onClick={() => void onClick()}>
        <CalendarIcon size={15} />
        Aggiungi al calendario
      </button>
    </div>
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
      <CalendarExport entries={entries} />
      {months.map(({ month, entries: monthEntries }) => (
        <section key={month} className="flex flex-col gap-2.5">
          <h2 className="font-display text-lg font-semibold capitalize text-text">
            {new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(
              new Date(`${month}-01T00:00:00`),
            )}
          </h2>
          <ul className="list-group" style={{ "--row-inset": "72px" } as React.CSSProperties}>
            {monthEntries.map((entry) => (
              <EntryRow key={`${entry.item.id}-${entry.date}`} entry={entry} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
