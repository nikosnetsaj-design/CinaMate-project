import { useMemo, useState } from "react";
import { useLibrary } from "../store/useLibrary";
import { getLifetimeStats } from "../player/services/statsAndHistory";
import { computeStats } from "./stats";
import { levelFor } from "./activity";
import { useVisibleInterval } from "./useVisibleInterval";

/**
 * Il livello e le ore, calcolati una volta sola per chiunque li chieda.
 *
 * Sta qui e non dentro una pagina perché ora sono in due a chiederlo:
 * l'intestazione di **Tu**, che resta ferma su tutte le schede, e il riepilogo
 * che le sta sotto. Prima la pagina era una e la domanda si faceva una volta;
 * farla due volte da due componenti diversi significherebbe percorrere tutta
 * la libreria due volte a ogni tocco su una scheda.
 */
export function useLevelSummary() {
  const allItems = useLibrary((s) => s.items);

  // Il contatore del player corre mentre un video sta suonando in questa
  // stessa scheda del browser, quindi va ritirato invece che letto una volta
  // al montaggio — è ciò che «aggiornato in tempo reale» deve voler dire qui.
  const [lifetime, setLifetime] = useState(getLifetimeStats);
  useVisibleInterval(() => setLifetime(getLifetimeStats()), 5000);

  // Le statistiche leggono tutta la libreria e mai la vista filtrata dal
  // controllo genitori: un titolo nascosto è costato le ore che è costato.
  const stats = useMemo(() => computeStats(allItems), [allItems]);

  // Due sorgenti, un numero: le ore che il player ha misurato secondo per
  // secondo, più quelle che la libreria sa giustificare da ciò che risulta
  // visto. Le prime sono esatte, quindi guidano.
  const playerHours = lifetime.totalWatchedSec / 3600;
  const totalHours = Math.round(playerHours + stats.hours);

  return { stats, playerHours, totalHours, level: levelFor(totalHours) };
}
