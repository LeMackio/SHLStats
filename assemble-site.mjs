// Puts the site together in site/: the React app built into web/dist (npm --prefix web run build) next to the
// data that fetch-data.mjs writes into site/data. fetch-data.mjs calls this at the end; it can also be run on
// its own (node assemble-site.mjs) to refresh the app without fetching new data.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function assembleSite() {
  if (!existsSync('web/dist/index.html')) throw new Error('The app is not built yet: run npm --prefix web run build first');
  mkdirSync('site', { recursive: true });
  // Everything except the data is replaced, so files from older builds don't pile up
  for (const f of readdirSync('site')) if (f !== 'data') rmSync(`site/${f}`, { recursive: true, force: true });
  cpSync('web/dist', 'site', { recursive: true });
  // Stamp every build with a version: data URLs carry it, so a browser never mixes a new page with old cached data,
  // the open app reloads when the published version changes, and the service worker installs anew
  const BUILD = Date.now().toString(36);
  writeFileSync('site/index.html', readFileSync('site/index.html', 'utf8')
    .replace('</head>', `<script>window.SHL_BUILD = '${BUILD}';</script>\n</head>`));
  writeFileSync('site/sw.js', readFileSync('site/sw.js', 'utf8').replaceAll('__BUILD__', BUILD));
  writeFileSync('site/.nojekyll', '');
  return BUILD;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(`Site assembled, build ${assembleSite()}`);
