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

## Container image

`ci/Dockerfile` builds the app with Node 24 on Debian slim and serves `dist` from
`nginxinc/nginx-unprivileged`, configured by the server config in `ci/nginx`. The build context is
the repository root, so build from there:

```bash
docker build -f ci/Dockerfile -t explorer:local .
```

Run it on <http://localhost:8080>:

```bash
docker run --rm -d --name explorer -p 8080:8080 explorer:local
```

A Kubernetes manifest needs this much of the runtime contract:

| Property                    | Value                                  |
| --------------------------- | -------------------------------------- |
| Container port              | 8080                                   |
| User                        | non-root, uid 101                      |
| Liveness and readiness path | `/healthz`, 200 with a plain text body |
| Logs                        | access on stdout, errors on stderr     |

Under `readOnlyRootFilesystem: true` the pod also needs a writable `emptyDir` mounted at `/tmp`,
where nginx keeps its pid file and its temp directories. Without one the container exits during
start up with `mkdir() "/tmp/proxy_temp" failed (30: Read-only file system)`.

Vite inlines `VITE_*` values at build time, and `.dockerignore` keeps every `.env*` file out of
the build context, so an image serves the SDK's published network defaults and never a
developer's `.env.local`.

### Publishing

The `docker-publish` workflow publishes the image to Google Artifact Registry as
`europe-west1-docker.pkg.dev/near-cs-dev/explorer/ui`. It runs when a release tag is pushed:
`vX.Y.Z` for a stable release, which must point at a commit on `main`, or `vX.Y.Z-rc.N` for a
release candidate, which may come from any branch. Any other ref fails the run before anything is
built.

The push happens in the `deploy` environment, so a run waits there for a reviewer's approval. That
environment holds the `GOOGLE_CREDENTIALS` secret, the service-account key the push authenticates
with.

A run publishes one multi-architecture manifest covering `linux/amd64` and `linux/arm64` under
three tags: the release tag, the tagged commit's full hash and `latest`. Each architecture is also
published on its own as `<tag>-linux-amd64` and `<tag>-linux-arm64`.

## Canonical Tailwind classes

`yarn lint` also checks that every Tailwind class is written in its canonical form, the check the
Tailwind CSS IntelliSense extension surfaces as `suggestCanonicalClasses`. It comes from
`eslint-plugin-better-tailwindcss`, which Oxlint loads as a JS plugin, and only that plugin's
`enforce-canonical-classes` rule is switched on. A non-canonical class fails the run, and
`yarn lint --fix` rewrites it: `[&>[data-slot=table-container]]:h-full` becomes
`*:data-[slot=table-container]:h-full`.

The rule reads the theme from `src/index.css`, so an arbitrary value that names a theme token is
reported as well: `bg-[var(--color-clamshell-100)]` is flagged in favour of `bg-clamshell-100`.

`src/components/ui` is exempt, since the shadcn CLI writes those files and they are not hand
edited here.

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

`@sig-net/midnight` loads the Midnight onchain-runtime WebAssembly module through the Compact
runtime. Vite's dependency optimizer cannot inline it, so `vite.config.ts` adds `vite-plugin-wasm`
and keeps that package out of the prebundle. The rest of the SDK tree is still optimized, which
matters because it includes CommonJS packages. `MidnightProvider` in
`src/components/contexts/MidnightContext.tsx` is mounted at the root and exposes the selected network, the effective
configuration (defaults plus any edits), the indexer services, and actions to edit or reset the
configuration. Read it with the `useMidnight` hook from the same file. Edits live in memory only
and are kept per network until the page reloads.

The indexer services hold the Signet event source, which reads the indexer's query URL directly.
`src/lib/midnight/indexer-services.ts` owns them: they are rebuilt only when the effective indexer
URL changes, so the same URL always yields the same event source, which is what the event store
keys its loads on. They are `null` until the first build completes, just after the provider mounts.

### WebAssembly and bundle weight

The production build carries one WebAssembly module, the 1.4MB onchain runtime, and the whole
output is about 2.2MB. Keep it that way when adding Midnight features.
`@midnight-ntwrk/midnight-js-indexer-public-data-provider` is the package to watch. A static import
of it pulls in `@midnight-ntwrk/midnight-js-types`, which imports the Midnight ledger as runtime
values. Measured at 5.0.0-beta.6, that added two builds of the ledger WebAssembly (20.8MB, one of
them never fetched) plus Apollo Client, taking the output to 22.4MB. A feature that needs that
provider, for example to read contract state, loads it with a dynamic `import()` inside the route
that needs it, so the weight stays off the first page load. Check the `.wasm` files listed by
`yarn build` after adding any Midnight dependency.

The selected network is owned by the URL: every `/midnight` page carries `?networkId=<network>`.
A missing or unknown value is rewritten to `stagenet` before the page loads, and the route
layout copies the validated value into the context. The cog at the right of the Midnight bar
opens the configuration popover, where changing the network rewrites the query string of the
current page.

## Signet contract events

Once the indexer services exist and the selected network names a Signet contract address,
`MidnightSignetEventsProvider` in `src/components/contexts/MidnightSignetEventsContext.tsx`,
mounted at the root inside `MidnightProvider`, loads every event the contract has emitted. It
consumes the SDK's `streamSignetEvents`, an async generator that requests one indexer page of 100
events at a time, yields that page's events before requesting the next, and pins the indexer tip at
the first page so a page-boundary insert can neither duplicate nor skip an event. The SDK queries
the indexer's GraphQL endpoint itself and selects each event's transaction, so every event arrives
with its transaction hash and the height, hash and time of its block. Each event goes
through the SDK's `tryDecodeSignetEvent`, which yields a union over the three Signet event names
(SignBidirectionalEvent, SignatureRespondedEvent, RespondBidirectionalEvent) carrying the declared
request id and the decoded record. `src/lib/midnight/signet-events.ts` adds the explorer's own
policy on top: the explorer shows everything the contract emitted, so a name that is not a Signet
event becomes an unrecognised entry and a payload that fails to decode becomes an undecodable
entry that keeps the error. Every entry carries `source`, the event as the indexer served it: the
event id, the transaction hash, and the block height, hash and timestamp.

The events live in memory in `src/lib/midnight/signet-event-store.ts`, so switching tabs or moving
between the Midnight and Solana pages does not reload them. Each page is published as it arrives,
together with the id of the last loaded event and the indexer tip id (both are the indexer's global
event cursor, not counts). Loads are cached per indexer URL and contract address pair: switching
networks and back reuses the completed set, while changing either value starts a fresh load and
abandons any load that no longer matches. Only completed loads are kept. The address typed into
the configuration popover reaches the store only once it is 32 bytes of hex, in canonical form
(lowercase, `0x` prefix dropped), so a half-typed address starts no load and the popover marks the
field invalid. The popover checks the MPC root public key the same way: any spelling the SDK
accepts (SEC1 hex, compressed or uncompressed, or NEAR's `secp256k1:<base58>`) is valid, and
anything else is marked. Networks without a published address (preview, preprod, mainnet, and undeployed
without the environment variable) stay unconfigured. Nothing is written to local storage.

Read the state with the `useMidnightSignetEvents` hook from the same file as the provider. It
returns the status (`unconfigured`, `loading`, `loaded` or `error`), the events, the lifecycles
described below, the last and tip ids, the error message, and a `refresh` action that re-runs the
backfill.

### Sign bidirectional lifecycles

Every published snapshot also carries `lifecycles`, a view of the events built by
`src/lib/midnight/sign-bidirectional-lifecycle.ts`. It groups the decoded events by the request id
they declare into one `SignBidirectionalLifecycle` each, with a list per event kind:
`signBidirectionalEvents`, `signatureRespondedEvents` and `respondBidirectionalEvents`. Each is a
list since the contract is unauthenticated: nothing stops a kind being emitted twice under one
request id, or a response being emitted for a request that never was, and the view keeps all of it
so such cases can be seen. The grouping is by declared id only and verifies nothing. Events that
did not decode declare no request id and are left out. Lifecycles are ordered newest first, by the
indexer id of their earliest event.

The Explorer tab renders them with `SignBidirectionalLifecycleTable` in
`src/components/midnight/sign-bidirectional-lifecycle-table.tsx`, one row per lifecycle. The table
fills the height the page has left, down to the status line, with a sticky header, and scrolls
inside its body. The app shell in `src/routes/__root.tsx` is exactly one viewport tall, which is
what gives the table a height to fill. Times are block times as
`DD-MM-YY HH:MM:SS` in the browser's time zone, a cell lists at most three entries before an ellipsis, a clock marks a
signature or response that has not arrived, and Duration runs from the first request to the first
response. Hovering a truncated request id or caller shows the full value, and the copy button
beside it puts the full value on the clipboard. The search box filters
rows as you type by a fragment of the request id or of a caller contract address. The display
formatters live in `src/lib/format.ts`.

## Local SDK link

The explorer depends on the published `@sig-net/midnight`. To try SDK changes that are not
released yet, link a local checkout of the `sig-net/midnight-integration` repository. The link is a
local arrangement and is never committed.

Add `portal:` resolutions to `package.json` for the SDK and for its sibling
`@sig-net/midnight-serde`, which the SDK depends on as a workspace package. Paths are relative to
this repository, here for a checkout sitting beside it:

```json
"resolutions": {
  "@sig-net/midnight": "portal:../midnight-integration-decoded-signet-events/packages/signet-midnight",
  "@sig-net/midnight-serde": "portal:../midnight-integration-decoded-signet-events/packages/midnight-serde"
}
```

Then install:

```bash
yarn install
```

A portal consumes the SDK as TypeScript source, and the SDK declares enums, so set
`erasableSyntaxOnly` to `false` in `tsconfig.app.json` while the link is in place. Vite erases the
enums, and the published package is unaffected since it ships compiled JavaScript. To return to the
published package, remove the two resolutions, restore `erasableSyntaxOnly`, and run `yarn install`
again.

Yarn holds back any package published within the last 24 hours. `.yarnrc.yml` pre-approves the
`@sig-net` scope, so a fresh SDK release installs at once while every other package keeps that
protection.

## Routing

Files under `src/routes` map to URLs by name: `index.tsx` is `/`, `solana.tsx` is `/solana`,
and `__root.tsx` is the layout every route renders inside. `index.tsx` renders nothing: it
redirects `/` to `/midnight` with the default network, and bare `/midnight` redirects on to
`/midnight/explorer`, so a visitor landing on the site arrives at the Midnight explorer.
`midnight.tsx` is the layout for every
`/midnight` page: it renders the Midnight bar with the Explorer and Contract Analyser tabs, and
the files under `src/routes/midnight` are the tab pages. The Solana page carries a coming soon
banner while its explorer is being built. The switcher in the top app bar navigates between
network roots, and the
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
