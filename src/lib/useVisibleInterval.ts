import { useEffect, useRef } from "react";

/**
 * `setInterval`, but only while the page is actually being looked at.
 *
 * A hidden tab is a tab nobody can see the result of, so every tick it takes
 * is battery spent on nothing — and on a phone the app is usually hidden
 * rather than closed, so "nobody is looking" is the normal state, not the
 * exception. Browsers throttle background timers but do not stop them, and a
 * throttled timer that wakes the radio is still the expensive part.
 *
 * The callback also fires once on becoming visible again, because the whole
 * point of a poll is that its answer goes stale — coming back to a five-minute
 * old reading and waiting another five minutes for a fresh one would be worse
 * than not pausing at all.
 */
export function useVisibleInterval(callback: () => void, intervalMs: number) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    let timer = 0;

    const stop = () => {
      if (timer) window.clearInterval(timer);
      timer = 0;
    };

    const start = () => {
      stop();
      timer = window.setInterval(() => callbackRef.current(), intervalMs);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        callbackRef.current();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs]);
}
