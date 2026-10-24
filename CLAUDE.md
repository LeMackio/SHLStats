# SHLstats

Fan site with stats for the Swedish Hockey League, live at https://shlstats.net.

## Working with the owner

- Reply in Swedish.
- Once a change is finished and tested, commit and push it without asking first. The owner doesn't want to click
  through GitHub Desktop.
- Before committing:
  - Run the type check and the build in `web/` (`npx tsc -p tsconfig.app.json --noEmit`, `npm run build`).
    `tsc -p .` checks nothing: the root tsconfig only holds references.
  - Check the change in the browser, at desktop width and at phone width (375 px), in both the dark and the light theme.
  - If data or `fetch-data.mjs` changed, run `node fetch-data.mjs` from the repo root. It must exit with 0.
- A local `node fetch-data.mjs` run also rewrites `history/odds.json`. Discard that with
  `git checkout -- history/odds.json` before committing or pulling. The scheduled GitHub Action owns that file.
- Run `git pull --rebase origin main` before pushing, because the Action commits odds to `main` too.
- After pushing, confirm that the Actions run for the commit succeeded
  (`https://api.github.com/repos/LeMackio/SHLStats/actions/runs`) and that the live site serves the new build.
- Write commit messages in English, as a short summary line followed by bullets explaining what changed and why.

## Principles

- Cut taglines, helper text and secondary labels. If a screen needs them to make sense, fix the layout.
  - Cards have a title and content only: `Panel` has no subtitle prop, and `PageHead` has no tagline.
  - No "Tryck på …" instructions. Show the thing instead, for example by opening the latest goal on a shot map.
  - Definitions of column abbreviations go in the header's `title` tooltip, not in a note under the table.
  - Data lines (a date under a clip, "4 mål" under a player) are content, not helper text.
- Make the decision that improves all three: the user experience, the developer experience, and the experience of an
  agent working in this repo, without breaking anything. Prefer rules that the code enforces, such as a prop that
  doesn't exist, over rules that have to be remembered.

## Layout

- `fetch-data.mjs` downloads everything from shl.se's API and Wikipedia and writes `site/data/*.json`, including the
  team logos (`site/data/logos/`).
  - `cache/` is gitignored locally. GitHub Actions keeps it between runs.
  - On a new machine, the first local run downloads every old season, game and shot once, so it takes a while.
- `web/` is the site itself, built with React, Vite and Arc UI. `npm run dev` there starts the dev server.
- CSS order: legacy `web/src/styles.css`, then `web/src/brand.css` (the brand layer, where new styles go). Arc's CSS
  modules are unlayered.
- Every push to `main` deploys through GitHub Actions to GitHub Pages. The same workflow also refreshes the data on a
  schedule.

## Live scores

- shl.se sends no CORS headers, so live scores go through a Cloudflare Worker,
  https://shlstats-live.marcuskbroman.workers.dev. Its code is in `live-relay/worker.js`, and the owner pastes it into
  the Cloudflare dashboard themselves.
- The worker's `SITES` allowlist holds shlstats.net, www.shlstats.net, lemackio.github.io and localhost:4323.
- If the domain ever changes, update `SITES` and ask the owner to redeploy the worker. Otherwise live scores silently
  stop working.
