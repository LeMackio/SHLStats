# SHLstats

An independent SHL stats site in Swedish: overview, games and match pages, standings with simulated playoff odds, player and team stats, and player and team pages. It isn't affiliated with the SHL.

## Files

- `web/` is the site itself: a React app (Vite, TypeScript, Tailwind and shadcn/ui). `web/src/pages/` has one file per page, `web/src/components/` the shared pieces, and `web/src/styles.css` the site's look.
- `model.mjs` holds the team ratings, game odds and the season/playoff simulation.
- `fetch-data.mjs` pulls data from shl.se's public stats feeds, runs the model and writes the data into `site/data`.
- `assemble-site.mjs` puts the built app next to the data in `site/` and stamps the build's version. `fetch-data.mjs` runs it at the end.
- `history/odds.json` stores playoff odds per matchday. The workflow commits it automatically.
- `live-relay/` is the small Cloudflare Worker behind live scores and push notifications.
- `.github/workflows/refresh.yml` runs the build on a schedule and deploys to GitHub Pages.

Finished seasons, finished games and headshot links are cached in `cache/`, so each is fetched from shl.se only once.

## Build locally

Requires Node 22 or newer (the app's build tools need it).

```
npm ci --prefix web
npm --prefix web run build
node fetch-data.mjs
```

Then serve the `site/` folder with any static web server, for example `npx serve site`. Opening `site/index.html` directly from disk won't work, because the page loads its data files with `fetch`.

To work on the app, run `npm --prefix web run dev`. It reads the data from `site/data`, so run `node fetch-data.mjs` once first. After changing the app, `npm --prefix web run build` and `node assemble-site.mjs` update `site/` without fetching new data.

## Hosting (free)

1. Create a **public** repository on GitHub.
2. Upload these files, keeping the folder structure.
3. In the repository, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
4. Go to **Actions → Refresh SHL data and deploy → Run workflow**.
