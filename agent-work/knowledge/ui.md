# Pack: ui

Read this when your step changes the browser app. Paths are relative to the app's folder (the repository root before step 02.1, `packages/ui/` after).

## How the app reads Midnight today

- `src/components/contexts/MidnightContext.tsx` holds the selected network, its configuration (defaults of `src/lib/midnight/network.ts` plus in-memory edits) and the indexer services. [read 4234222]
- `src/components/contexts/MidnightSignetEventsContext.tsx` reads the indexer's tip (`src/lib/midnight/indexer-block-height.ts`), resolves a starting block, and drives `SignetEventStore` (`src/lib/midnight/signet-event-store.ts`), which reads both contracts slice by slice through the SDK and publishes `events` and `lifecycles`. [read 4234222]
- `src/lib/midnight/sign-bidirectional-lifecycle.ts` groups decoded events by request id into `SignBidirectionalLifecycle` (three lists, one per event kind) and holds the list's search and caller filters, which run in the browser over everything loaded. [read 4234222]
- `src/routes/midnight/explorer.tsx` is the page: search box, status line with event and request counts, the starting block control, Refresh, the excluded callers filter kept in the URL, and a step back loop that finds a linked `requestId` older than the window. [read 4234222]
- `src/components/midnight/sign-bidirectional-lifecycle-table.tsx` renders one row per lifecycle and, for an expanded row, calls `useLifecycleVerification`. [read 4234222]

## What an expanded row fetches

- `src/components/midnight/use-lifecycle-verification.ts` takes each sign bidirectional event's inspection from the lifecycle the backend served (`InspectedSignBidirectionalLifecycle`), then checks signatures and attestations in the browser. The UI imports no ledger and reads no indexer for it. [read d45b12d]
- The EVM status (`evm-transaction-status.ts`, `evm-transaction-output.ts`) and the MPC output cache (`mpc-output-cache.ts`) call their own services from the browser and stay as they are (D10). [read 4234222]

## Configuration

- `src/lib/explorer-env.ts` merges `import.meta.env` with `window.explorerEnv`, which the UI image's entrypoint writes (`docker/30-explorer-env.sh`). Every key is declared in `src/vite-env.d.ts` and listed in `parseRuntimeExplorerEnv`, which fails to compile when a declared key is missing from it. [read 4234222]
- `src/components/midnight/midnight-configuration.tsx` is the popover: one editable field per key of `MidnightNetworkConfig` (`:40-42` are the indexer, indexer websocket and node URLs). [read 4234222]
- Nothing but `network.ts`, the popover and the events path reads `indexerUrl`, and nothing reads `nodeUrl` or `indexerWsUrl` beyond the popover. [run 4234222]

## Tests

- Component tests are `*.test.tsx` beside the component and run in Chromium with `vitest-browser-react`. Fixtures are `src/lib/midnight/*.fixture.ts`. [read 4234222]
- The time zone of the test browser is fixed to `Asia/Kolkata` (`vite.config.ts:82`). [read 4234222]
- The UI's Vitest configuration is the `test` block of `packages/ui/vite.config.ts`: the UI has no `vitest.config.ts`. [run 53ef0ad]
- A Base UI popup stays mounted for its exit animation (100 ms) after it closes, and `screen` or `page.getByText` queries resolve before it unmounts. To wait for a popup to be gone, poll `document.querySelector` for its `data-slot` (`[data-slot="combobox-content"]`), as `excluded-callers-filter.test.tsx` does. [read 53ef0ad]
- Base UI's combobox calls `onInputValueChange` with reason `input-clear` when its popup unmounts. A handler that accepts every reason wipes what the user typed: accept `input-change` and `escape-key` alone, as `excluded-callers-filter.tsx` does. [read 53ef0ad]
- `SignetEventsSection`'s `TEvent` bound (`packages/ui/src/components/midnight/signet-events-section.tsx`) types `source` as lib's `StoredSignetMiscEvent`. An `IndexedSignetMiscEvent` assigns to it. [read d45b12d]
- oxlint enforces `react(set-state-in-effect)` as an error and flags extra effect dependencies: a refresh counter in the dependencies must be read in the effect body. [unverified]
- A test that renders the generated `routeTree` awaits `router.load()` first. The page's tests are in `packages/ui/src/components/midnight/explorer-page.test.tsx`, since a test under `src/routes` is read as a route. The list is read through the api client (`packages/ui/src/lib/explorer-api.ts`), whose base URL is `VITE_EXPLORER_API_URL`. [unverified]
- From a cold Vite cache (`packages/ui/node_modules/.vite`, `packages/ui/.vitest`) Vite optimises dependencies in the middle of the UI's test run and reloads, which fails tests that render the route tree. Seen at 8d493d7, 1 run in 4 with 7 failures, another with 2 timeouts while a second test run was using the machine. [run 8d493d7]
- `JsonViewer` (`packages/ui/src/components/json-viewer.tsx`) calls `useTheme`: a test that expands a row with a decoded request wraps it in `ThemeProvider`. [read d45b12d]
- `MidnightProvider` takes `children` alone: a test sets a configuration through `useMidnight().setConfig`. A valid signature makes `EvmTransactionStatus` call the configured EVM RPC, so such a test sets the RPC and cache URLs to `''`. [read d45b12d]
- `getByText` of vitest-browser does not match a span whose text is split by child elements (`valid for key` followed by a `CopyableHex`): assert on `container.textContent`. [unverified]
- A known request with a valid MPC signature is `SIGNED_REQUEST_ID` and `SIGNED_REQUEST_MPC_RESPONSE` of `packages/ui/src/lib/midnight/sign-bidirectional-event.fixture.ts`. `inspected-sign-bidirectional-lifecycle.fixture.ts` beside it builds an `InspectedSignBidirectionalLifecycle`, which is what the lifecycle table takes. [unverified]
- The Midnight network select is in `packages/ui/src/components/midnight/midnight-configuration.tsx`. `network-switcher.tsx` switches chains (Midnight, Solana). `MidnightProvider` calls `useExplorerApi`, so a test mounts it inside `ExplorerApiProvider`. [unverified]
- Vitest's browser mode takes the top-level `optimizeDeps` of `packages/ui/vite.config.ts`, whose `include` names every dependency the tests reach so that a cold run reloads nothing. A new dependency of a test goes into that list. [unverified]
- `explorerSeed` of `@sig-net/explorer-api/testing` serves preprod (synced, block 1012) and preview (starting) alone, and its preprod source URL carries `?project_id=seed-token`. [unverified]
- Under a machine load near 7 a browser test can time out at 15 s on a click with no reload: seen once in six cold runs, in `signet-events-section.test.tsx`. [unverified]
