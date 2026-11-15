# Pack: the UI codebase

Paths here describe the repository BEFORE stage 02 (the app at the root, in `src/`). After stage
02 the same tree is under `packages/ui/`, and the orchestrator rewrites the paths.

## Stack

React 19.3 with the React Compiler, Vite 8 (Rolldown), TypeScript 7 strict, TanStack Router (file
based, `src/routes`), Tailwind 4, shadcn/ui on Base UI, Vitest 5 in browser mode, Oxlint and
Oxfmt, Yarn 4. `[read]` `README.md`, `package.json`. Import alias `@/` is `src/`.
`[read]` `vite.config.ts`.

## Layout rules (repository rules, enforced in review)

- `src/lib`: every non-React module. A domain with several modules gets a folder
  (`src/lib/midnight/`).
- `src/components`: React components. `src/components/ui`: only what the shadcn CLI writes.
  `src/components/contexts`: one file per context holding the value type, the provider and the
  `use<Name>` hook.
- `src/routes`: route files only. `src/routeTree.gen.ts` is generated.
- File by kind of code, then domain. Never by feature name. No new top-level folder under `src`.

## Routes

`[read]` `src/routes/`: `__root.tsx`, `index.tsx` (redirects to the Midnight explorer),
`midnight.tsx` (layout, owns the `networkId` search parameter and retains it across child
routes), `midnight/index.tsx`, `midnight/explorer.tsx` (the list, search parameters `requestId`
and `excludeCallers`), `midnight/contract-analyser.tsx` (a "coming soon" page), `solana.tsx`
(a "coming soon" page).

`[run]` `/` and `/midnight` land on `/midnight/explorer?networkId=preprod`.

## The data path today (what this task replaces)

| File | Role | Fate |
| --- | --- | --- |
| `src/lib/midnight/network.ts` | Network list, per-network defaults (indexer, node, Signet values, EVM RPC, cache URL, starting block), env overrides, parsers | Splits: chain configuration moves to the backend, browser-side endpoints stay |
| `src/lib/explorer-env.ts`, `src/vite-env.d.ts`, `public/env.js`, `docker/30-explorer-env.sh` | Build-time and container-time `VITE_MIDNIGHT_*` variables | Shrinks to the backend URL, default network and browser-side endpoints |
| `src/components/contexts/MidnightContext.tsx` | Selected network, effective configuration (defaults plus in-memory edits), indexer services, edit and reset actions | Configuration becomes read-only, sourced from the Network service |
| `src/lib/midnight/indexer-services.ts`, `indexer-block-height.ts` | Builds the SDK event source for an indexer URL, reads the tip height | Removed |
| `src/lib/midnight/signet-event-store.ts` | Reads both contracts' events in block slices, newest first, keeps them in memory, aggregates lifecycles | Removed. The backend ingester takes its place |
| `src/lib/midnight/signet-events-window.ts` | Block-window arithmetic for the starting block | Removed |
| `src/components/contexts/MidnightSignetEventsContext.tsx` | Feeds the store's snapshot to the page | Replaced by service calls |
| `src/lib/midnight/signet-events.ts` | `SignetContractEvent` and `decodeSignetContractEvent` | Moves to `lib` (the backend decodes too) |
| `src/lib/midnight/sign-bidirectional-lifecycle.ts` | Lifecycle type, aggregation, duration, search match, callers | Aggregation rules move to the backend. The type that the expanded row renders stays |
| `src/lib/midnight/sign-bidirectional-transaction-loader.ts` | Fetches the raw transaction from the indexer, runs the inspection | Fetches from the backend |
| `src/lib/midnight/evm-transaction-output.ts` | `debug_traceTransaction` from the browser | Calls the backend |
| `src/components/midnight/signet-events-starting-block.tsx` | The "Starting Block" control | Removed |
| `src/components/midnight/midnight-configuration.tsx` | The configuration popover, editable | Read-only |
| `src/components/midnight/excluded-callers-filter.tsx` | Filter built from the loaded rows' callers | List comes from the backend |
| `src/components/midnight/sign-bidirectional-lifecycle-table.tsx` | The list and its expanded rows | Paged, fed by the Sign request service |
| `src/components/midnight/signet-events-section.tsx` | Section header with counts and reading progress | Shows indexing status from the backend |

Unchanged in substance: `use-lifecycle-verification.ts`, `signature-check.ts`,
`attestation-check.ts`, `request-signing-key.ts`, `mpc-output-cache.ts`,
`evm-transaction-status.ts`, `evm-json-rpc.ts`, `sign-bidirectional-transaction-inspection.ts`
and the detail components.

`[read]` every file named above was read or listed in the planning session. The `Fate` column is
the plan, not a fact about the code.

## WebAssembly rule

`[read]` the repository's engineering rules, "Boundaries and ownership":

- Only `src/lib/midnight/sign-bidirectional-transaction-inspection.ts` imports
  `@midnightntwrk/ledger-v9` as values, and it is reached by dynamic `import()` only.
- Never import `@midnight-ntwrk/midnight-js-indexer-public-data-provider` or anything that reaches
  `@midnight-ntwrk/midnight-js-types` at runtime from shared or root-mounted code.
- `@sig-net/midnight` itself pulls the onchain runtime WebAssembly, which is expected on the first
  load. `vite.config.ts` keeps both wasm packages out of the dependency prebundle.
- After any dependency change: `yarn build` and check the emitted `.wasm` files
  (`checks-and-tooling.md`).

## Base path rule

The app is served at `/` in development and `/explorer/` on GitHub Pages. A file in `public` goes
through `publicAssetUrl` (`src/lib/public-asset-url.ts`). A route goes through the router.
`[read]` the repository's engineering rules.

## Tests

`[run]` 27 test files, 143 tests, all in browser mode. Fixtures live beside the code as
`*.fixture.ts` (`sign-bidirectional-event.fixture.ts`, `respond-bidirectional-event.fixture.ts`,
`sign-bidirectional-lifecycle.fixture.ts`, `sign-bidirectional-transaction-inspection.fixture.ts`).
They are the natural seed for the `api` fakes.

## UI conventions that bite

- Every element is a shadcn/ui component. Missing one: `yarn dlx shadcn@latest add <component>`.
  If shadcn has none, stop and report.
- Never a cursor class on a control. One rule at the end of `src/index.css` owns the pointer.
- Stores are plain classes with `subscribe` and `getSnapshot`, read through
  `useSyncExternalStore`. `[read]` `signet-event-store.ts`, `indexer-services.ts`.
- Times are rendered in local time. Tests pin `Asia/Kolkata`.
