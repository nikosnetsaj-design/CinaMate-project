/**
 * System notifications, best-effort. There is no server and no push
 * subscription: CineMate can only raise a notification while it is open, which
 * is why every caller also has a visible in-app fallback.
 */
export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationsAllowed(): boolean {
  return notificationsSupported() && Notification.permission === "granted";
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    return (await Notification.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

/** Returns false when the notification could not be shown, so the caller can fall back. */
export function showNotification(title: string, body: string, tag: string): boolean {
  if (!notificationsAllowed()) return false;
  try {
    new Notification(title, { body, tag, icon: "/icon-192.png" });
    return true;
  } catch {
    return false;
  }
}
