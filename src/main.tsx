import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@fontsource-variable/newsreader/opsz.css";
import "@fontsource-variable/instrument-sans";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./index.css";
import { installGlobalErrorCapture } from "./lib/errorLog";
import { durable } from "./lib/durable";
import { registerServiceWorker } from "./lib/serviceWorker";
import { purgeExpired } from "./lib/persistentCache";

// Installed before React mounts, so an error thrown during the very first
// render is caught too — which is exactly the failure that otherwise leaves
// nothing behind but a blank page.
installGlobalErrorCapture();

// The offline shell. Registered after load inside the function, so it never
// competes with the first render for bandwidth.
registerServiceWorker();

// Le voci scadute della cache su disco. Vengono già saltate in lettura, ma
// nessuno le cancella se non le si rilegge — e proprio quelle che non si
// rileggono più sono quelle che restano. La pulizia gira quando il browser è
// fermo, mai durante l'avvio: è manutenzione, non deve rubare un millisecondo
// al primo render.
if (typeof requestIdleCallback === "function") {
  requestIdleCallback(() => void purgeExpired(), { timeout: 10_000 });
} else {
  // Safari non ha `requestIdleCallback`: un ritardo fisso ottiene lo stesso
  // scopo, cioè non essere nel mezzo dell'avvio.
  setTimeout(() => void purgeExpired(), 5_000);
}

/*
 * Prima il disco, poi l'app.
 *
 * La libreria, il diario e le posizioni del lettore stanno su IndexedDB, che
 * risponde in modo asincrono; gli store dell'app invece leggono in modo
 * sincrono quando i loro moduli vengono importati. Quindi l'app si importa
 * *dopo* che la copia in memoria è pronta — una manciata di millisecondi — e
 * da lì in avanti nessuno store si accorge del cambio. Il pezzo dell'app viene
 * scaricato in parallelo (vedi il plugin in vite.config.ts): si aspetta il
 * disco, non la rete.
 */
async function start() {
  await durable.hydrate();
  const { default: App } = await import("./App.tsx");
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      {/* Router paths must sit under the same base the assets are served from. */}
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <App />
      </BrowserRouter>
    </StrictMode>,
  );
}

void start();
