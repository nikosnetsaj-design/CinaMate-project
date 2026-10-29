import { readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages serves the site from /<repo>/, so a production build for Pages
// needs that prefix on every asset. Local dev and preview stay at the root.
//
// Il percorso è dichiarato qui, esplicito e leggibile: è questo il valore che
// finisce su GitHub Pages. Resta però scavalcabile da GITHUB_REPOSITORY (che
// Actions imposta sempre, nella forma "owner/repo") per una ragione pagata una
// volta: quando il nome era scritto solo a mano, rinominare il repository
// lasciava ogni asset puntato al percorso vecchio e il sito pubblicato
// rispondeva 200 con una pagina bianca, perché il bundle dava 404.
const REPO_PATH = '/CinaMate-project/'
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1]
const base = process.env.GITHUB_PAGES === 'true' ? (repo ? `/${repo}/` : REPO_PATH) : '/'

/**
 * L'elenco dei file di cui è fatta questa versione, per il service worker.
 *
 * Il worker è scritto a mano e non può sapere come si chiamano i file: il
 * nome porta l'hash del build. Finché l'app era un pezzo solo bastava che la
 * pagina gli dicesse cosa aveva caricato; con le pagine a caricamento
 * differito, una pagina mai aperta con la rete non sarebbe stata in cache, e
 * offline si sarebbe aperta su un errore. Qui il build scrive due elenchi:
 *
 * - `precache`: tutto ciò che serve all'app offline, scaricato alla prima
 *   visita. Restano fuori il lettore — `hls.js` pesa più di tutto il resto, e
 *   scaricarlo a chi non lo apre mai è esattamente il consumo di batteria che
 *   `lib/prefetch` esiste per evitare — e la tavola del design;
 * - `all`: ogni file del build. Il worker cancella dalla cache quello che non
 *   ci compare più, perché ogni versione porta file nuovi e prima quelli
 *   vecchi restavano lì per sempre, sottraendo spazio ai video scaricati.
 */
function offlineAssetList(): Plugin {
  let publicDir = ''
  return {
    name: 'cinemate-offline-assets',
    apply: 'build',
    configResolved(config) {
      publicDir = config.publicDir
    },
    generateBundle(_options, bundle) {
      // I file di `public/` (icone, manifesto) non passano dal bundle ma il
      // worker li mette in cache lo stesso: vanno nell'elenco, o la pulizia
      // li butterebbe via a ogni avvio.
      const fromPublic = publicDir
        ? readdirSync(publicDir, { recursive: true, withFileTypes: true })
            .filter((entry) => entry.isFile())
            .map((entry) => relative(publicDir, join(entry.parentPath, entry.name)).split('\\').join('/'))
            .filter((name) => !name.startsWith('.') && name !== 'sw.js')
        : []
      const files = [...Object.values(bundle).map((file) => file.fileName), ...fromPublic]
        .filter((name) => !name.endsWith('.map') && name !== 'index.html')
      const skip = /(^|\/)(Player|DesignPreview)-[^/]*\.(js|css)$/
      // Font in alfabeti che l'app non usa: il CSS li dichiara con
      // `unicode-range`, quindi il browser non li chiede mai.
      const unusedFont = /-(cyrillic|cyrillic-ext|vietnamese|greek|greek-ext)-.*\.woff2?$/
      const precache = files.filter((name) => !skip.test(name) && !unusedFont.test(name) && !name.endsWith('.woff'))
      this.emitFile({
        type: 'asset',
        fileName: 'offline-assets.json',
        source: JSON.stringify({ precache, all: files }),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react(), tailwindcss(), offlineAssetList()],
})
