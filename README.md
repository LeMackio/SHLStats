# Isstats SHL

An independent SHL stats site with standings, simulated playoff and gold odds, player percentile cards, leaderboards and goalie GSAA. It isn't affiliated with the SHL.

- `template.html` is the page: layout, styles, the projection model and all rendering.
- `fetch-data.mjs` pulls data from shl.se's public stats feeds and writes `site/index.html` with the data baked in. It finds the current and previous season on its own, so it keeps working in future seasons.
- `.github/workflows/refresh.yml` runs the fetch on a schedule and deploys to GitHub Pages. It runs every 20 minutes during evening game hours (Swedish time) and every 3 hours otherwise.

## Build locally

Requires Node 18 or newer.

```
node fetch-data.mjs
```

Then open `site/index.html` in a browser.

## Hosting (free)

1. Create a **public** repository on GitHub named `isstats-shl`.
2. Upload these files, keeping the `.github/workflows` folder structure.
3. In the repository, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
4. Go to **Actions → Refresh SHL data and deploy → Run workflow**.

The site is published at `https://<your-username>.github.io/isstats-shl/`.
