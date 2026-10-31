import { useEffect, useState, type ComponentType } from "react";
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
type Loader = () => Promise<ComponentType>;

const itemSheet: Loader = () => import("./ItemDetailSheet").then((m) => m.ItemDetailSheetPortal);
const catalogSheet: Loader = () => import("./CatalogSheet").then((m) => m.CatalogSheetPortal);
const sagaSheet: Loader = () => import("./SagaSheet").then((m) => m.SagaSheetPortal);
const personSheet: Loader = () => import("./PersonSheet").then((m) => m.PersonSheetPortal);
const addSheet: Loader = () => import("./AddItemSheet").then((m) => m.AddItemSheetPortal);
const editSheet: Loader = () => import("./EditItemSheet").then((m) => m.EditItemSheetPortal);
const settingsSheet: Loader = () => import("./SettingsSheet").then((m) => m.SettingsSheetPortal);
const palette: Loader = () => import("./CommandPalette").then((m) => m.CommandPalette);
const webViewer: Loader = () => import("./WebViewer").then((m) => m.WebViewer);
const onboarding: Loader = () => import("./Onboarding").then((m) => m.Onboarding);

/*
 * Non `React.lazy`: un componente lazy sospende al primo render anche quando
 * il modulo è già arrivato, e React ritarda di 300 ms la comparsa di quello
 * che era sospeso. Sulla scheda di un titolo — il gesto più frequente — erano
 * 300 ms di attesa a ogni prima apertura. Qui un modulo già caricato si
 * disegna subito; uno che non c'è ancora arriva con un semplice
 * aggiornamento di stato.
 */
const ready = new Map<Loader, ComponentType>();

function load(loader: Loader): Promise<ComponentType> {
  return loader().then((C) => {
    ready.set(loader, C);
    return C;
  });
}

/** Monta il foglio la prima volta che `open` diventa vero, e poi lo tiene. */
function Deferred({ open, loader }: { open: boolean; loader: Loader }) {
  const [ever, setEver] = useState(open);
  if (open && !ever) setEver(true);
  const [Component, setComponent] = useState<ComponentType | null>(() => ready.get(loader) ?? null);

  useEffect(() => {
    if (!ever || Component) return;
    let alive = true;
    load(loader)
      .then((C) => alive && setComponent(() => C))
      // Senza rete il pezzo non arriva: alla prossima apertura si riprova.
      .catch(() => alive && setEver(false));
    return () => {
      alive = false;
    };
  }, [ever, Component, loader]);

  return ever && Component ? <Component /> : null;
}

export function DeferredPortals() {
  const item = useSelectedItem((s) => s.item !== null);
  const catalog = useCatalogPreview((s) => s.target !== null);
  const saga = useSelectedSaga((s) => s.key !== null);
  const person = useSelectedPerson((s) => s.name !== null);
  const add = useAddSheet((s) => s.isOpen);
  const edit = useEditSheet((s) => s.isOpen);
  const settings = useSettingsSheet((s) => s.isOpen);
  const paletteOpen = useCommandPalette((s) => s.isOpen);
  const viewer = useWebViewer((s) => s.url !== null);
  const onboardingDone = useOnboarding((s) => s.done);
  const replaying = useOnboarding((s) => s.replaying);
  const [emptyAtStart] = useState(() => useLibrary.getState().items.length === 0);

  /*
   * La scheda di un titolo è il foglio che si apre di più: la si scarica
   * appena il browser è fermo dopo l'avvio, così il primo tocco su una
   * locandina non aspetta la rete. Fuori dal primo caricamento, ma prima del
   * primo gesto.
   */
  useEffect(() => {
    const warm = () => {
      void load(itemSheet).catch(() => undefined);
      void load(catalogSheet).catch(() => undefined);
    };
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(warm, { timeout: 4000 });
      return () => cancelIdleCallback(id);
    }
    const id = window.setTimeout(warm, 2000);
    return () => window.clearTimeout(id);
  }, []);

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
      <Deferred open={paletteOpen} loader={palette} />
      <Deferred open={item} loader={itemSheet} />
      <Deferred open={catalog} loader={catalogSheet} />
      <Deferred open={saga} loader={sagaSheet} />
      <Deferred open={person} loader={personSheet} />
      <Deferred open={add} loader={addSheet} />
      <Deferred open={edit} loader={editSheet} />
      <Deferred open={settings} loader={settingsSheet} />
      {/* Il primo minuto: copre tutto, e si mostra da sé solo a libreria
          vuota (o quando lo si rivede dalle Impostazioni). */}
      <Deferred open={replaying || (!onboardingDone && emptyAtStart)} loader={onboarding} />
      {/* In fondo a tutto: il Web Viewer copre lo schermo intero da
          qualunque punto parta, senza portarsi via la pagina sotto. */}
      <Deferred open={viewer} loader={webViewer} />
    </>
  );
}
