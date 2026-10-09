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
    // Fallback version for data URLs; the published site gets its own stamp from ../assemble-site.mjs
    __BUILD__: JSON.stringify(Date.now().toString(36)),
  },
  build: {
    rollupOptions: {
      output: {
        // React in its own file, which rarely changes, so browsers keep it cached across updates (the shadcn/Base UI
        // components stay with the pages that use them)
        manualChunks: (id) => (/node_modules\/(react|react-dom|scheduler)\//.test(id) ? 'vendor' : undefined),
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
