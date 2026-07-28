import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages serves the site from /<repo>/, so a production build for Pages
// needs that prefix on every asset. Local dev and preview stay at the root.
//
// The repo name is read from GITHUB_REPOSITORY ("owner/repo", always set by
// Actions) rather than written here: hardcoding it meant that renaming the
// repository left every asset pointing at the old path, and the published site
// answered 200 with a blank page because the bundle 404'd.
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1]
const base = process.env.GITHUB_PAGES === 'true' && repo ? `/${repo}/` : '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
})
