import { useEffect } from "react";
import { useLibrary } from "../store/useLibrary";
import { useSettings } from "../store/useSettings";
import { useReminders } from "../store/useReminders";
import { loadUpcoming, trackedKey } from "./upcoming";
import { daysBetweenToday } from "./format";
import { showNotification } from "./notify";

/** Anything landing today or tomorrow is worth interrupting for; nothing else is. */
const ALERT_WINDOW_DAYS = 1;

/**
 * Checks the reminder list whenever the app is opened and announces whatever
 * has just landed — a system notification when the permission is there, a toast
 * otherwise, so the reminder is never silently swallowed. The `notified` map in
 * the store is what keeps one release from being announced twice.
 */
export function useReleaseAlerts() {
  const items = useLibrary((s) => s.items);
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const enabled = useReminders((s) => s.enabled);
  const key = trackedKey(items);
  const enabledKey = enabled.join(",");

  useEffect(() => {
    if (!tmdbApiKey || enabled.length === 0) return;
    let cancelled = false;

    void loadUpcoming(useLibrary.getState().items, tmdbApiKey).then((entries) => {
      if (cancelled) return;
      const reminders = useReminders.getState();
      const pushToast = useLibrary.getState().pushToast;

      for (const entry of entries) {
        if (!reminders.enabled.includes(entry.item.id)) continue;
        if (daysBetweenToday(entry.date) > ALERT_WINDOW_DAYS) continue;
        if (reminders.wasNotified(entry.item.id, entry.date)) continue;

        const when = daysBetweenToday(entry.date) === 0 ? "oggi" : "domani";
        const what =
          entry.type === "episodio"
            ? entry.season != null && entry.episode != null
              ? `Nuovo episodio S${entry.season}E${entry.episode} ${when}.`
              : `Nuovo episodio ${when}.`
            : `Esce ${when}.`;

        reminders.markNotified(entry.item.id, entry.date);
        if (!showNotification(entry.item.title, what, `cinemate-${entry.item.id}-${entry.date}`)) {
          pushToast("info", `${entry.item.title} — ${what.toLowerCase()}`);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [tmdbApiKey, key, enabledKey, enabled.length]);
}
