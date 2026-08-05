/**
 * Che formato è, guardando l'indirizzo.
 *
 * Sta in `services/` e non in `fromLibrary.ts` perché lo leggono entrambi i
 * lati: il motore video, che deve scegliere quale lettore costruire, e i
 * pannelli che validano quello che scrivi. `fromLibrary.ts` conosce gli store
 * di CineMate e gli hook del player non devono conoscerli, quindi la risposta
 * comune vive qui, dove nessuno dei due sconfina.
 *
 * Si guarda l'estensione e non il tipo dichiarato dal server: il tipo arriva
 * solo dopo la richiesta, e a quel punto il lettore va già scelto. La query
 * string si scarta, perché un manifest firmato finisce spessissimo per
 * `.mpd?token=…` e senza tagliarla non lo riconoscerebbe nessuno.
 */
function pathOf(raw: string): string | null {
  try {
    return new URL(raw).pathname;
  } catch {
    return null;
  }
}

export function isHlsUrl(raw: string): boolean {
  const path = pathOf(raw);
  return path !== null && /\.m3u8?$/i.test(path);
}

export function isDashUrl(raw: string): boolean {
  const path = pathOf(raw);
  return path !== null && /\.mpd$/i.test(path);
}

/** Un manifest che il player sa aprire, di qualunque dei due formati. */
export function isStreamUrl(raw: string): boolean {
  return isHlsUrl(raw) || isDashUrl(raw);
}
