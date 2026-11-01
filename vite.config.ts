import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { inlineMessages } from './scripts/vite-i18n.ts'

/**
 * `main.tsx` importa l'app solo dopo aver caricato i dati da IndexedDB, quindi
 * il pezzo dell'app è un import dinamico — e un import dinamico parte quando
 * lo si chiama, cioè dopo il disco. Questo plugin fa precaricare
 * (`modulepreload`) quel pezzo e i suoi import statici: il browser li scarica
 * mentre il disco si apre, senza eseguirli prima del tempo.
 *
 * I precaricamenti partono *dopo la prima pittura*, da uno script, e non come
 * `<link>` nell'HTML: sessanta richieste ad alta priorità messe davanti a
 * tutto contendevano la banda al foglio di stile e al codice d'ingresso, e la
 * prima schermata (l'ossatura, o il benvenuto) arrivava più tardi. Così prima
 * si disegna, poi si scarica il resto — un fotogramma dopo, non un secondo.
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
        const hrefs = JSON.stringify([...files].map((file) => `${base}${file}`))
        return [
          {
            tag: 'script',
            // Dopo la prima pittura «grande» (LCP) dove il browser la segnala,
            // dopo la prima pittura e basta dove no (Safari), e comunque entro
            // un secondo: la scorciatoia non deve mai diventare un ritardo.
            children: `(function(){var f=${hrefs},done=false;function go(){if(done)return;done=true;for(var i=0;i<f.length;i++){var l=document.createElement("link");l.rel="modulepreload";l.crossOrigin="";l.href=f[i];document.head.appendChild(l);}}var t=(window.PerformanceObserver&&PerformanceObserver.supportedEntryTypes)||[];var type=t.indexOf("largest-contentful-paint")>=0?"largest-contentful-paint":t.indexOf("paint")>=0?"paint":"";if(type){try{new PerformanceObserver(function(){setTimeout(go,0);}).observe({type:type,buffered:true});}catch(e){}}setTimeout(go,1000);})();`,
            injectTo: 'body' as const,
          },
        ]
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
  plugins: [inlineMessages(), react(), tailwindcss(), preloadApp()],
})
