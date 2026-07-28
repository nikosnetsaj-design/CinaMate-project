import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages serves the site from /<repo>/, so a production build for Pages
// needs that prefix on every asset. Local dev and preview stay at the root.
const base = process.env.GITHUB_PAGES === 'true' ? '/super-duper-fortnight/' : '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
})
