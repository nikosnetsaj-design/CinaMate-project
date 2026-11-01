import { useState } from "react";
import { useSettings } from "../store/useSettings";
import { useSettingsSheet } from "../store/useSettingsSheet";

/**
 * Quando manca la chiave del catalogo, lo dice un posto solo.
 *
 * Prima lo dicevano dieci. `AddItemSheet`, `CatalogSheet`, `WatchAndLinks`,
 * `UpcomingRow`, `LinkToTmdb`, `AiItemExtras`, `NextChapterPrompt`,
 * `SagaSheet`, `CastRow` — ognuno con la sua frase, il suo tono e il suo modo
 * di rimandare alle Impostazioni. Erano dieci scuse locali per un fatto solo,
 * e nessuna delle dieci arrivava prima del momento in cui la cosa non
 * funzionava: si scopriva che serviva una chiave *fallendo*.
 *
 * Adesso il fatto è uno e la frase è una. Cambia la forma, perché una riga
 * sotto un titolo e una pagina di ricerca vuota non hanno lo stesso peso, ma
 * il testo dice sempre le stesse tre cose: **cosa manca, perché, e come si
 * accende.** Mai la parola «API» rivolta a chi legge: la persona gestisce
 * copertine e trame, non credenziali.
 */

/** Cosa resta spento senza catalogo, detto per quello che si vede. */
const WHAT = "Copertine, trame, cast e date arrivano da TMDB.";

function useTurnOn() {
  const openSettings = useSettingsSheet((s) => s.open);
  return () => openSettings("chiavi");
}

/**
 * La riga: sotto un contenuto che c'è comunque, e che senza catalogo è solo
 * meno ricco. Non interrompe niente, quindi non ha bisogno di essere chiusa.
 */
export function CatalogNote({ what = WHAT }: { what?: string }) {
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const turnOn = useTurnOn();
  if (tmdbApiKey) return null;

  return (
    <p className="t-caption text-text-faint">
      {what}{" "}
      <button
        type="button"
        onClick={turnOn}
        className="font-medium underline underline-offset-2"
        style={{ color: "var(--accent-text)" }}
      >
        Accendi il catalogo
      </button>
    </p>
  );
}

/**
 * Il blocco: al posto di un contenuto che senza catalogo non esiste proprio —
 * la griglia della ricerca, l'elenco dei risultati. Qui la spiegazione può
 * essere intera, perché è l'unica cosa sullo schermo.
 */
export function CatalogBlock() {
  const turnOn = useTurnOn();
  return (
    <div className="flex flex-col items-center gap-3.5 rounded-lg px-6 py-10 text-center bg-surface-2">
      <div className="flex flex-col gap-1.5">
        <h2 className="t-section text-text">Il catalogo è spento.</h2>
        <p className="mx-auto max-w-sm t-body text-text-muted">
          {WHAT} Serve una chiave tua: è gratis, ci vogliono due minuti, e resta su questo
          dispositivo.
        </p>
      </div>
      <button
        type="button"
        onClick={turnOn}
        className="btn btn-primary"
      >
        Accendi il catalogo
      </button>
    </div>
  );
}

const DISMISS_KEY = "cinemate:catalog-strip-hidden:v1";

/**
 * La striscia in cima alla Home: l'unico invito che parte da solo.
 *
 * È l'unico posto in cui l'app dice della chiave *prima* che qualcosa
 * fallisca — ed è anche l'unico che si può chiudere, perché un invito che
 * non si può togliere è un cartello pubblicitario. Chiuso resta chiuso: la
 * decisione di non volere il catalogo è una risposta legittima, e
 * ripresentare la domanda a ogni avvio significherebbe non averla accettata.
 * Le altre due forme continuano a comparire dove servono davvero.
 */
export function CatalogStrip() {
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const turnOn = useTurnOn();
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  if (tmdbApiKey || hidden) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* best effort: al massimo ricompare al prossimo avvio */
    }
    setHidden(true);
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-surface px-4 py-3.5 shadow-[var(--shadow-sm)] sm:flex-row sm:items-center">
      <p className="min-w-0 flex-1 t-caption text-text-muted">
        <strong className="font-semibold text-text">Le copertine mancano.</strong> {WHAT}
      </p>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={turnOn}
          className="btn btn-primary btn-sm"
        >
          Accendilo
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Non ora: nascondi l'avviso sul catalogo"
          className="btn btn-plain btn-sm font-medium text-text-muted"
        >
          Non ora
        </button>
      </div>
    </div>
  );
}
