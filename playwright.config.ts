import { defineConfig, devices } from "@playwright/test";

/**
 * Lo smoke test end-to-end: l'app vera, costruita come in produzione e servita
 * da `vite preview`, in un Chromium vero. Niente rete verso TMDB: il test
 * percorre la strada che funziona senza chiave.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:4173",
    // I service worker restano fuori: tra un test e l'altro servirebbero
    // la versione vecchia dalla cache.
    serviceWorkers: "block",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 860 } } }],
  webServer: {
    command: "npm run build && npx vite preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
