import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { useSelectedItem } from "../store/useSelectedItem";
import { useCatalogPreview } from "../store/useCatalogPreview";
import { useSelectedSaga } from "../store/useSelectedSaga";
import { useSelectedPerson } from "../store/useSelectedPerson";
import { useAddSheet } from "../store/useAddSheet";
import { useEditSheet } from "../store/useEditSheet";
import { useSettingsSheet } from "../store/useSettingsSheet";
import { useCommandPalette } from "../store/useCommandPalette";
import { useWebViewer } from "../store/useWebViewer";
import { useOnboarding } from "../store/useOnboarding";
import { useLibrary } from "../store/useLibrary";

/*
 * I fogli che coprono l'app — la scheda di un titolo, le impostazioni, il
 * modulo di aggiunta, il Web Viewer… — scaricati la prima volta che si
 * aprono, non all'avvio.
 *
 * Stavano tutti nel primo caricamento: le sole Impostazioni sono il file più
 * grande del progetto, e all'avvio servono a nessuno. Ognuno resta montato
 * dopo la prima apertura, così le animazioni di chiusura funzionano come
 * prima e la seconda apertura è istantanea.
 */
const ItemDetailSheetPortal = lazy(() => import("./ItemDetailSheet").then((m) => ({ default: m.ItemDetailSheetPortal })));
const CatalogSheetPortal = lazy(() => import("./CatalogSheet").then((m) => ({ default: m.CatalogSheetPortal })));
const SagaSheetPortal = lazy(() => import("./SagaSheet").then((m) => ({ default: m.SagaSheetPortal })));
const PersonSheetPortal = lazy(() => import("./PersonSheet").then((m) => ({ default: m.PersonSheetPortal })));
const AddItemSheetPortal = lazy(() => import("./AddItemSheet").then((m) => ({ default: m.AddItemSheetPortal })));
const EditItemSheetPortal = lazy(() => import("./EditItemSheet").then((m) => ({ default: m.EditItemSheetPortal })));
const SettingsSheetPortal = lazy(() => import("./SettingsSheet").then((m) => ({ default: m.SettingsSheetPortal })));
const CommandPalette = lazy(() => import("./CommandPalette").then((m) => ({ default: m.CommandPalette })));
const WebViewer = lazy(() => import("./WebViewer").then((m) => ({ default: m.WebViewer })));
const Onboarding = lazy(() => import("./Onboarding").then((m) => ({ default: m.Onboarding })));

/** Monta i figli la prima volta che `open` diventa vero, e poi li tiene. */
function WhenOpened({ open, children }: { open: boolean; children: ReactNode }) {
  const [ever, setEver] = useState(open);
  if (open && !ever) setEver(true);
  return ever ? <Suspense fallback={null}>{children}</Suspense> : null;
}

export function DeferredPortals() {
  const item = useSelectedItem((s) => s.item !== null);
  const catalog = useCatalogPreview((s) => s.target !== null);
  const saga = useSelectedSaga((s) => s.key !== null);
  const person = useSelectedPerson((s) => s.name !== null);
  const add = useAddSheet((s) => s.isOpen);
  const edit = useEditSheet((s) => s.isOpen);
  const settings = useSettingsSheet((s) => s.isOpen);
  const palette = useCommandPalette((s) => s.isOpen);
  const viewer = useWebViewer((s) => s.url !== null);
  const onboardingDone = useOnboarding((s) => s.done);
  const replaying = useOnboarding((s) => s.replaying);
  const [emptyAtStart] = useState(() => useLibrary.getState().items.length === 0);

  // ⌘K / Ctrl+K deve funzionare prima che la tavolozza sia mai stata scaricata.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        useCommandPalette.getState().open();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <WhenOpened open={palette}>
        <CommandPalette />
      </WhenOpened>
      <WhenOpened open={item}>
        <ItemDetailSheetPortal />
      </WhenOpened>
      <WhenOpened open={catalog}>
        <CatalogSheetPortal />
      </WhenOpened>
      <WhenOpened open={saga}>
        <SagaSheetPortal />
      </WhenOpened>
      <WhenOpened open={person}>
        <PersonSheetPortal />
      </WhenOpened>
      <WhenOpened open={add}>
        <AddItemSheetPortal />
      </WhenOpened>
      <WhenOpened open={edit}>
        <EditItemSheetPortal />
      </WhenOpened>
      <WhenOpened open={settings}>
        <SettingsSheetPortal />
      </WhenOpened>
      {/* Il primo minuto: copre tutto, e si mostra da sé solo a libreria
          vuota (o quando lo si rivede dalle Impostazioni). */}
      <WhenOpened open={replaying || (!onboardingDone && emptyAtStart)}>
        <Onboarding />
      </WhenOpened>
      {/* In fondo a tutto: il Web Viewer copre lo schermo intero da
          qualunque punto parta, senza portarsi via la pagina sotto. */}
      <WhenOpened open={viewer}>
        <WebViewer />
      </WhenOpened>
    </>
  );
}
