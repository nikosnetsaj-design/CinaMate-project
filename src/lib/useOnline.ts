import { useEffect, useState } from "react";

/**
 * Whether the browser thinks it has a network.
 *
 * `navigator.onLine` is famously optimistic — it reports a connection to a
 * café's captive portal as being online — but it is never wrong in the
 * direction that matters here: when it says offline, it really is. That makes
 * it good enough to explain why a search returns nothing, and not good enough
 * to disable anything, which is why nothing here does.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}
