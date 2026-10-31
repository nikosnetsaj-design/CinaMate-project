import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAddSheet } from "../store/useAddSheet";
import { useLibrary } from "../store/useLibrary";
import { useSelectedItem } from "../store/useSelectedItem";
import { useWatchProgress } from "../store/useWatchProgress";
import { continueWatching, lastSeenDates } from "./continueWatching";

/**
 * Le scorciatoie dell'icona (manifest → `shortcuts`): una pressione lunga
 * sull'icona di CineMate offre «Continua a guardare», «Aggiungi titolo» e
 * «Cerca». Le prime due arrivano come `?apri=…` e si eseguono qui, una volta;
 * il parametro si toglie subito, perché ricaricare non deve rifarle.
 */
export function useLaunchAction() {
  const [params, setParams] = useSearchParams();
  const action = params.get("apri");

  useEffect(() => {
    if (!action) return;
    const next = new URLSearchParams(params);
    next.delete("apri");
    setParams(next, { replace: true });

    if (action === "aggiungi") {
      useAddSheet.getState().open();
    } else if (action === "riprendi") {
      const { items, history } = useLibrary.getState();
      const entry = continueWatching(items, useWatchProgress.getState().progress, lastSeenDates(history))[0];
      if (entry) useSelectedItem.getState().open(entry.item);
      else useLibrary.getState().pushToast("info", "Niente da riprendere: non c'è niente a metà.");
    }
  }, [action, params, setParams]);
}
