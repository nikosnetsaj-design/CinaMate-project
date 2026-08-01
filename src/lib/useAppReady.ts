import { useEffect, useState } from "react";

/**
 * True once there is something real to draw.
 *
 * This used to be a flat 420 ms timer, started fresh on every mount. Two
 * things were wrong with that. The library is read from localStorage
 * synchronously while the store module is imported, so by the time any page
 * renders the data is already *there* — the wait was guarding against a flash
 * that could not happen. And because the timer restarted per mount, every
 * single navigation between Home, Libreria, Saghe, Dati and Profilo replaced
 * a page that could have been drawn immediately with almost half a second of
 * skeleton.
 *
 * What remains is the one case the skeleton is genuinely for: the very first
 * paint of a session, where the browser is still parsing fonts and CSS and an
 * empty shelf really can flash by. One frame is enough for that, and it is
 * remembered for the rest of the session so no later navigation pays it again.
 */
let paintedOnce = false;

export function useAppReady(): boolean {
  const [ready, setReady] = useState(paintedOnce);

  useEffect(() => {
    if (paintedOnce) return;
    const id = requestAnimationFrame(() => {
      paintedOnce = true;
      setReady(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return ready;
}
