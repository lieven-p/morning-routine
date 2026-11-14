# Ochtendroutine

Offline-first PWA that guides two children through the school morning on one shared landscape tablet. Flemish Dutch, no runtime network requests, all data stays on the device.

Live site: <https://lieven-p.github.io/morning-routine/>

## Scripts

Node `^24.0.0 || >=26.0.0` (`.nvmrc` pins 26).

| Command | What it does |
| --- | --- |
| `npm ci` | Install from the lockfile |
| `npm run dev` | Vite dev server |
| `npm run lint` | oxlint, including the layer rules in `.oxlintrc.json` |
| `npm test` | Vitest (repository, device adapters including the development clock, session commands and the kids screen helpers, against `fake-indexeddb`) and the script checks that the layer rules and the precache check reject violations (run after `npm run build`) |
| `npm run build` | Type-check, build to `dist/`, then check that every file in `public/` is in the service worker precache |
| `npm run preview` | Serve `dist/` to try the installed/offline behaviour |

If `npm install` aborts with `ECONNRESET` behind a registry mirror, use `--maxsockets=4 --fetch-retries=5`.

## Layout

`src/domain` (pure rules), `src/app` (commands, queries, ports), `src/adapters` (browser APIs), `src/ui` (`kids`, `parent`). Imports are relative and the lint rules reject layer violations, `dexie` outside `src/adapters/db`, and `ui/kids` importing `ui/parent`.

All fixed text comes from `src/ui/copy.nl-BE.ts`.

Persistence goes through the `Repository` port in `src/app/ports.ts`; its Dexie implementation lives in `src/adapters/db/` (schema version 1, database `morning-routine`). Time comes from the `Clock` port (`src/adapters/device/clock.ts`).

The children's shell (`src/ui/kids/`) reads live data with `dexie-react-hooks` and issues only the session commands in `src/app/session-commands.ts` (start session, start timer, tick, untick, departed). On first open into an empty database, `src/app/sample-data.ts` writes a stand-in family (story 9 replaces it with the first-run flow). To time-travel in a browser, use the development clock below or Playwright's `page.clock`.

## Development clock

Run a whole morning in a few minutes by adding URL parameters, on any build (also the deployed site and `npm run preview`):

| Parameter | Meaning |
| --- | --- |
| `devNow=YYYY-MM-DDTHH:mm` | Local start time. Time begins at this moment and runs on from there. Required: without a valid `devNow` the other two do nothing. |
| `devSpeed=N` | Optional, 1 to 60 (default 1): time runs N times faster than real time. |
| `devReset` | Optional: deletes the development database before the app starts, then removes itself from the address, so a reload keeps the morning. |

Example: `/morning-routine/?devNow=2026-11-16T07:15&devSpeed=20&devReset` starts on a Monday at 07:15 and plays through the departure in about three real minutes.

With `devNow` the app uses its own IndexedDB `morning-routine-dev`, so the real database is never touched. Invalid values are ignored: the app then runs on the real clock and the real database. A reload restarts the clock at `devNow` and keeps the stored morning, so open the page with a later `devNow` to look at a later stage; add `devReset` to start over. The development database gets the sample family like any empty database.

## Deploy

Pushes to `main` run `.github/workflows/deploy.yml`: install, lint, build, then publish `dist` to GitHub Pages. In the repository settings, set Pages source to "GitHub Actions". Pushes to other branches and pull requests run install, lint and build only.

## Base path

The site is served under `/morning-routine/`. The constant lives in `site.config.ts`; `vite.config.ts` and the PWA manifest (`start_url`, `scope`) both read it. Change it there if the repository is renamed.

The service worker uses prompt-to-update, so a new version is never applied automatically.
