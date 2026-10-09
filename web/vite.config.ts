import { createReadStream, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// The data files are built by ../fetch-data.mjs into ../site/data. In dev they are served
// from there at /data, so the React app reads exactly what the live site reads.
const DATA_DIR = path.resolve(import.meta.dirname, '../site/data')
const serveSiteData = (): Plugin => ({
  name: 'serve-site-data',
  configureServer(server) {
    server.middlewares.use('/data', (req, res, next) => {
      const file = path.join(DATA_DIR, decodeURIComponent((req.url || '').split('?')[0]))
      if (!file.startsWith(DATA_DIR) || !existsSync(file) || !statSync(file).isFile()) return next()
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      createReadStream(file).pipe(res)
    })
  },
})

// https://vite.dev/config/
export default defineConfig({
  // Relative asset URLs, so the site works from a GitHub Pages sub path
  base: './',
  plugins: [react(), tailwindcss(), serveSiteData()],
  define: {
    __BUILD__: JSON.stringify(Date.now().toString(36)),
  },
  // The shared stylesheet (and its icons) still live in ../src with the original site
  server: { fs: { allow: ['..'] } },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
