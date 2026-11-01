import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * `main.tsx` importa l'app solo dopo aver caricato i dati da IndexedDB, quindi
 * il pezzo dell'app è un import dinamico — e un import dinamico parte quando
 * lo si chiama, cioè dopo il disco. Questo plugin mette nell'HTML un
 * `modulepreload` per quel pezzo e per i suoi import statici: il browser li
 * scarica subito, mentre il disco si apre, senza eseguirli prima del tempo.
 */
function preloadApp(): Plugin {
  return {
    name: 'cinemate:preload-app',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const bundle = ctx.bundle
        if (!bundle) return
        const chunks = Object.values(bundle).filter((c) => c.type === 'chunk')
        const app = chunks.find((c) => c.facadeModuleId?.endsWith('/src/App.tsx'))
        if (!app) return
        const files = new Set<string>([app.fileName])
        const walk = (name: string) => {
          const chunk = chunks.find((c) => c.fileName === name)
          for (const dep of chunk?.imports ?? []) {
            if (!files.has(dep)) {
              files.add(dep)
              walk(dep)
            }
          }
        }
        walk(app.fileName)
        return [...files].map((file) => ({
          tag: 'link',
          attrs: { rel: 'modulepreload', crossorigin: '', href: `${base}${file}` },
          injectTo: 'head' as const,
        }))
      },
    },
  }
}

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

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react(), tailwindcss(), preloadApp()],
})
