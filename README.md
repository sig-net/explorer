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

Dark mode is a class on the root element. `ThemeProvider` in `src/components/contexts/ThemeContext.tsx` reads the stored choice,
falls back to the system preference, and the toggle in the app bar flips it and persists it in
local storage.

To add a shadcn component:

```bash
yarn dlx shadcn@latest add dropdown-menu
```

## Networks

Supported networks are declared once in `src/lib/networks.ts`, which owns the id set, display labels
and icon paths. Icons live in `public/icons`. Midnight and sig.network ship black and white
variants, swapped by the dark class, and Solana uses one icon for both modes.

## Midnight configuration

`src/lib/midnight/network.ts` owns the list of Midnight networks (the `MidnightNetwork` enum
from `@sig-net/midnight`), the default indexer, indexer websocket and node URLs for each, the MPC
root public key and Signet contract address where the SDK publishes them, and the
parser that turns a raw query value into a network.

A local `undeployed` stack generates its own MPC root public key and Signet contract address, so
the SDK publishes neither. To avoid re-entering them after every reload, put them in `.env.local`
(ignored by git) and restart `yarn dev`, which also restarts on its own when the file changes:

```dotenv
VITE_MIDNIGHT_UNDEPLOYED_MPC_ROOT_PUBLIC_KEY=0x04...
VITE_MIDNIGHT_UNDEPLOYED_SIGNET_CONTRACT_ADDRESS=380b...
```

They become the `undeployed` defaults, so Reset Defaults returns to them. Unset variables leave the
fields empty. A value that is not a valid secp256k1 public key or 32-byte hex contract address
stops the app from loading, and the error names the variable. Only variables prefixed `VITE_` reach
the browser, and each one read is declared in `src/vite-env.d.ts`.

`@sig-net/midnight` loads the Midnight ledger and onchain-runtime WebAssembly modules. Vite's
dependency optimizer cannot inline those, so `vite.config.ts` adds `vite-plugin-wasm` and keeps
the two wasm packages out of the prebundle. The rest of the SDK tree is still optimized, which
matters because it includes CommonJS packages. `MidnightProvider` in
`src/components/contexts/MidnightContext.tsx` is mounted at the root and exposes the selected network, the effective
configuration (defaults plus any edits), the indexer services, and actions to edit or reset the
configuration. Read it with the `useMidnight` hook from the same file. Edits live in memory only
and are kept per network until the page reloads.

The indexer services are the indexer public data provider and the Signet event source built on
it. `src/lib/midnight/indexer-services.ts` owns them: they are rebuilt only when the effective
indexer or indexer websocket URL changes, and the replaced provider is disposed to close its
WebSocket connection. They are `null` until the first build completes, just after the provider
mounts.

The selected network is owned by the URL: every `/midnight` page carries `?networkId=<network>`.
A missing or unknown value is rewritten to `stagenet` before the page loads, and the route
layout copies the validated value into the context. The cog at the right of the Midnight bar
opens the configuration popover, where changing the network rewrites the query string of the
current page.

## Routing

Files under `src/routes` map to URLs by name: `index.tsx` is `/`, `solana.tsx` is `/solana`,
and `__root.tsx` is the layout every route renders inside. `midnight.tsx` is the layout for every
`/midnight` page: it renders the Midnight bar with the Explorer and Contract Analyser tabs, and
the files under `src/routes/midnight` are the tab pages. Bare `/midnight` redirects to
`/midnight/explorer`. The switcher in the top app bar navigates between network roots, and the
current network is derived from the first path segment, so loading a network URL directly selects
that network. The Vite plugin regenerates
`src/routeTree.gen.ts` whenever a route file changes. That file is committed so a fresh
checkout type-checks before the first dev server run, and it is excluded from lint and
format.

Route components are code split automatically, so each route ships as its own chunk.

## Tests

Test files match `src/**/*.test.tsx` and run in a real browser. Render with `render` from
`vitest-browser-react`, query with `page` from `vitest/browser`, and assert with
`expect.element`, which retries until the assertion passes or times out.
