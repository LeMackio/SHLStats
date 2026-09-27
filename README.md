# SHLstats

An independent SHL stats site in Swedish: overview, games and match pages, standings with simulated playoff odds, player and team stats, and player and team pages. It isn't affiliated with the SHL.

## Files

- `src/` is the site itself: `index.html`, `styles.css` and `app.js` (all pages and charts).
- `model.mjs` holds the team ratings, game odds and the season/playoff simulation.
- `fetch-data.mjs` pulls data from shl.se's public stats feeds, runs the model and builds everything into `site/`.
- `history/odds.json` stores playoff odds per matchday. The workflow commits it automatically.
- `.github/workflows/refresh.yml` runs the build on a schedule and deploys to GitHub Pages.

Finished seasons, finished games and headshot links are cached in `cache/`, so each is fetched from shl.se only once.

## Build locally

Requires Node 18 or newer.

```
node fetch-data.mjs
```

Then serve the `site/` folder with any static web server, for example `npx serve site`. Opening `site/index.html` directly from disk won't work, because the page loads its data files with `fetch`.

## Hosting (free)

1. Create a **public** repository on GitHub.
2. Upload these files, keeping the folder structure.
3. In the repository, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
4. Go to **Actions → Refresh SHL data and deploy → Run workflow**.
