import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Sheet } from "./Sheet";
import { TitlePreview } from "./TitlePreview";
import { useTitlePreview } from "../store/useTitlePreview";
import { useSettings } from "../store/useSettings";
import { useLibrary } from "../store/useLibrary";
import { useEditSheet } from "../store/useEditSheet";
import { useSelectedItem } from "../store/useSelectedItem";
import { draftFromTmdb } from "../lib/addFromTmdb";
import type { TmdbDetails } from "../lib/tmdb";

/**
 * L'anteprima di un titolo che non hai: trama, cast, durata, dove guardarlo.
 *
 * Cercare un titolo significava aprire il modulo di inserimento: per leggere
 * una trama bisognava prima decidere di salvarlo, cioè l'ordine esatto al
 * contrario. Chi cercava per curiosità restava con uno scaffale da riordinare.
 * Ora un risultato si apre e basta; «Aggiungi alla libreria» è un pulsante
 * dentro l'anteprima, non il prezzo per vederla.
 */
export function TitlePreviewSheetPortal() {
  const result = useTitlePreview((s) => s.result);
  return <AnimatePresence>{result && <PreviewSheet />}</AnimatePresence>;
}

function PreviewSheet() {
  const result = useTitlePreview((s) => s.result)!;
  const close = useTitlePreview((s) => s.close);
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const items = useLibrary((s) => s.items);
  const openNew = useEditSheet((s) => s.openNew);
  const openItem = useSelectedItem((s) => s.open);
  const [adding, setAdding] = useState(false);
  const titleId = "title-preview-title";

  const owned = items.find((i) => i.tmdbId === result.tmdbId);

  async function add(details: TmdbDetails) {
    setAdding(true);
    try {
      openNew(
        await draftFromTmdb(result.tmdbId, result.mediaType, result.kind, tmdbApiKey, {
          title: details.title || result.title,
          year: details.year ?? result.year,
          posterPath: details.posterPath ?? result.posterPath,
        }),
      );
    } catch {
      // Il foglio si apre comunque con quello che l'anteprima aveva già in
      // mano: meglio un modulo da completare che un tocco che non fa niente.
      openNew({ title: details.title || result.title, kind: result.kind, year: details.year ?? undefined });
    }
    setAdding(false);
    close();
  }

  return (
    <Sheet onClose={close} titleId={titleId}>
      <div className="flex flex-col gap-4 p-5 pt-8 sm:p-6">
        <h2 id={titleId} className="sr-only">
          Dettagli di {result.title}
        </h2>
        <TitlePreview
          result={result}
          apiKey={tmdbApiKey}
          adding={adding}
          alreadyInLibrary={!!owned}
          backLabel="Chiudi"
          onBack={close}
          onAdd={(details) => void add(details)}
          // Quando ce l'hai già, la cosa utile non è aggiungerlo un'altra volta
          // ma andare alla scheda che hai — con i tuoi voti e le tue note.
          onOpenOwned={
            owned
              ? () => {
                  close();
                  openItem(owned);
                }
              : undefined
          }
        />
      </div>
    </Sheet>
  );
}
