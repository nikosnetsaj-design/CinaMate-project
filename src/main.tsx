import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/instrument-sans";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./index.css";
import App from "./App.tsx";
import { installGlobalErrorCapture } from "./lib/errorLog";

// Installed before React mounts, so an error thrown during the very first
// render is caught too — which is exactly the failure that otherwise leaves
// nothing behind but a blank page.
installGlobalErrorCapture();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* Router paths must sit under the same base the assets are served from. */}
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
