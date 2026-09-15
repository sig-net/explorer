# Explorer

A React single-page application for exploring sig.network activity across supported networks.

## Stack

| Concern              | Tool                                                                           |
| -------------------- | ------------------------------------------------------------------------------ |
| UI                   | React 19.3 with the React Compiler enabled                                     |
| Build and dev server | Vite 8 (Rolldown bundler) with `@vitejs/plugin-react` 6                        |
| Language             | TypeScript 7 (native compiler), strict mode                                    |
| Routing              | TanStack Router, file based, routes in `src/routes`                            |
| Styling              | Tailwind CSS 4 through `@tailwindcss/vite`                                     |
| Tests                | Vitest 5 in browser mode (Chromium via Playwright) with `vitest-browser-react` |
| Lint and format      | Oxlint (type aware) and Oxfmt                                                  |
| Package manager      | Yarn 4 (pinned in `package.json`, resolved by Corepack)                        |

## Requirements

- Node.js 22.12 or newer.
- Corepack, which ships with Node.js. Running `yarn` picks up the version pinned in
  `package.json`. If the shim is missing, run `corepack enable` once.
- The Chromium build used by the test runner, installed once with:

```bash
yarn playwright install chromium
```

## Scripts

| Command             | What it does                                                   |
| ------------------- | -------------------------------------------------------------- |
| `yarn dev`          | Start the dev server with hot module replacement               |
| `yarn build`        | Type-check every project and emit a production build to `dist` |
| `yarn preview`      | Serve the production build locally                             |
| `yarn typecheck`    | Type-check without emitting                                    |
| `yarn lint`         | Run Oxlint                                                     |
| `yarn format`       | Format the tree with Oxfmt                                     |
| `yarn format:check` | Fail if any file is not formatted                              |
| `yarn test`         | Run the test suite once in headless Chromium                   |
| `yarn test:watch`   | Run the test suite in watch mode                               |
| `yarn check`        | Typecheck, lint, format check and test in sequence             |

## Theme and palette

`src/index.css` declares every sig.network colour scale (brand, clamshell, dark-neutral, the
near-white tints, and the error, gray-blue, success and warning utility scales) as Tailwind theme
tokens, so classes such as `bg-clamshell-100` or `text-dark-neutral-400` work anywhere. The shadcn
semantic variables (`--background`, `--primary`, `--muted` and so on) are mapped onto those scales
for light mode under `:root` and for dark mode under `.dark`.

Dark mode is a class on the root element. `ThemeProvider` in `src/theme` reads the stored choice,
falls back to the system preference, and the toggle in the app bar flips it and persists it in
local storage.

To add a shadcn component:

```bash
yarn dlx shadcn@latest add dropdown-menu
```

## Networks

Supported networks are declared once in `src/networks.ts`, which owns the id set, display labels
and icon paths. Icons live in `public/icons`. Midnight and sig.network ship black and white
variants, swapped by the dark class, and Solana uses one icon for both modes.

## Routing

Files under `src/routes` map to URLs by name: `index.tsx` is `/`, `$network.tsx` is
`/midnight` or `/solana`, and `__root.tsx` is the layout every route renders inside. The network
route validates its parameter against the declared network ids and renders the not-found view for
anything else. The switcher in the app bar navigates between network routes, so loading a network
URL directly selects that network. The Vite plugin regenerates
`src/routeTree.gen.ts` whenever a route file changes. That file is committed so a fresh
checkout type-checks before the first dev server run, and it is excluded from lint and
format.

Route components are code split automatically, so each route ships as its own chunk.

## Tests

Test files match `src/**/*.test.tsx` and run in a real browser. Render with `render` from
`vitest-browser-react`, query with `page` from `vitest/browser`, and assert with
`expect.element`, which retries until the assertion passes or times out.
