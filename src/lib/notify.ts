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

/**
 * Resolves to false when the notification could not be shown, so the caller
 * can fall back.
 *
 * Two fixes live here. Chrome on Android refuses `new Notification()` outright
 * ("Illegal constructor": only a service worker may show one there), and the
 * `catch` turned that into a silent fallback — every reminder on the most
 * common phone became a toast. The registration's `showNotification` works on
 * Android and desktop alike, so it goes first. And the icon used an absolute
 * `/icon-192.png`, which on GitHub Pages — served under the repository's path
 * — is a 404: notifications arrived with the browser's generic icon.
 */
export async function showNotification(title: string, body: string, tag: string): Promise<boolean> {
  if (!notificationsAllowed()) return false;
  const icon = `${import.meta.env.BASE_URL}icon-192.png`;
  const options: NotificationOptions = { body, tag, icon };
  try {
    const registration = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (registration) {
      await registration.showNotification(title, options);
      return true;
    }
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}
