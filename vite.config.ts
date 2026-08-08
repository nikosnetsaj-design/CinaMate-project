import { defineConfig } from 'vite'
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

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
})
