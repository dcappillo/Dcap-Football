# CapFootball

A 32-team football general manager simulation that runs entirely in the browser. You take over a franchise, hire a head coach, and run it season after season: weekly game simulation, depth charts, trades, free agency, contracts and the salary cap, coaching staffs and schemes, injuries, a week-by-week playoff bracket, Black Monday, and a 7-round draft.

There is no backend. Everything runs client-side, and saves download as files you can load later.

## Quick start

Requires Node.js 20 or newer.

```bash
npm install
npm run dev      # http://localhost:5173, rebuilds when you save a file
```

Refresh the browser after a rebuild to see changes.

## Scripts

| Command          | What it does                                                    |
| ---------------- | --------------------------------------------------------------- |
| `npm run dev`    | Unminified build plus a local server that rebuilds on change    |
| `npm run build`  | Production build into `dist/` (minified, content-hashed assets) |
| `npm test`       | Builds, then plays a full season and offseason headlessly       |
| `npm run lint`   | ESLint                                                          |
| `npm run format` | Prettier (`format:check` verifies without writing)              |

## Deploying to GitHub Pages

The workflow in `.github/workflows/deploy.yml` lints, tests and builds every push and pull request. Pushes to `main` are then published to GitHub Pages.

One-time setup:

1. Create a repository on GitHub and push this project to its `main` branch.
2. In the repository, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push again, or re-run the workflow from the **Actions** tab.

The game will be live at `https://<your-username>.github.io/<repo-name>/`. All asset paths are relative, so it works from a subpath. `dist/` is also a plain static site, so Netlify, Vercel or any static host works too (build command `npm run build`, publish directory `dist`).

## Project layout

```
src/
  index.html            Page shell and navigation markup
  styles/main.css       All styles
  load-order.json       The order source files are concatenated in (see below)
  js/
    core/               League creation, schedule, game simulation engine, shared helpers
    sim/                Stat distribution, scheme matchups, matchup-aware box scores
    season/             Season calendar, playoffs, end-of-season routing
    offseason/          Offseason pipeline (contract expirations, draft class import)
    roster/             Rosters, positions, depth charts, player detail
    players/            Attributes, development and progression, injuries
    coaching/           Coaches, coordinators, schemes, Black Monday, coaching hub
    contracts/          Negotiation, re-signing, cap management
    free-agency/        Free agent pool, offers, CPU bidding
    draft/              Draft order, pick registry, rookie generation, CPU drafting
    trades/             Trade center, trade values, CPU trade offers
    team/               Team chemistry
    stats/  awards/     Stats, league leaders, awards
    league/             Transaction log
    save/               Save / load
    game/               New game flow (franchise picker, coach creation, roster import)
    ui/                 Navigation drawer, home dashboard, tables, animations
scripts/
  build.js              Concatenates and minifies into dist/
  dev.js                Dev server with rebuild-on-change
tests/
  smoke.test.js         Headless end-to-end season test
```

## How the code fits together

The game is written as classic browser scripts that share one global scope, not ES modules. The markup and generated HTML call functions by name through inline `onclick` handlers, so those functions have to be globals. An earlier move to ES modules broke every one of those handlers, which is why this layout exists.

Some files extend a function defined in an earlier file:

```js
var previous = window.simulateGame;
window.simulateGame = function (...args) {
  const result = previous(...args);
  // ...add behaviour...
  return result;
};
```

Because of this, **file order matters**. `src/load-order.json` is the single source of truth for that order. The build fails if a file is listed but missing, or present but not listed. When you add a file, put it after anything it builds on.

One rule that follows from concatenating everything into a single script: don't declare a global with `var` that has the same name as a `function` declaration in another file. Function declarations are hoisted to the top of the bundle, so the `var` assignment would silently win.

## Testing

`npm test` loads the production build in [jsdom](https://github.com/jsdom/jsdom) with a seeded random number generator and plays new game → 17 weeks → playoffs → Black Monday → free agency → draft → next season. It fails on any uncaught error and checks that the same seed always produces the same league. CI runs it on every push, so a broken build never deploys.
