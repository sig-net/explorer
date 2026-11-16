# Pack: ui

Read this when your step changes the browser app. Paths are relative to the app's folder (the repository root before step 02.1, `packages/ui/` after).

## How the app reads Midnight today

- `src/components/contexts/MidnightContext.tsx` holds the selected network, its configuration (defaults of `src/lib/midnight/network.ts` plus in-memory edits) and the indexer services. [read 4234222]
- `src/components/contexts/MidnightSignetEventsContext.tsx` reads the indexer's tip (`src/lib/midnight/indexer-block-height.ts`), resolves a starting block, and drives `SignetEventStore` (`src/lib/midnight/signet-event-store.ts`), which reads both contracts slice by slice through the SDK and publishes `events` and `lifecycles`. [read 4234222]
- `src/lib/midnight/sign-bidirectional-lifecycle.ts` groups decoded events by request id into `SignBidirectionalLifecycle` (three lists, one per event kind) and holds the list's search and caller filters, which run in the browser over everything loaded. [read 4234222]
- `src/routes/midnight/explorer.tsx` is the page: search box, status line with event and request counts, the starting block control, Refresh, the excluded callers filter kept in the URL, and a step back loop that finds a linked `requestId` older than the window. [read 4234222]
- `src/components/midnight/sign-bidirectional-lifecycle-table.tsx` renders one row per lifecycle and, for an expanded row, calls `useLifecycleVerification`. [read 4234222]

## What an expanded row fetches

- `src/components/midnight/use-lifecycle-verification.ts` inspects each notification's transaction, then checks signatures and attestations in the browser. The inspection is the only Midnight read in it: `loadSignBidirectionalTransactionInspection(indexerUrl, notification)` (`src/lib/midnight/sign-bidirectional-transaction-loader.ts:66`) fetches the raw transaction from the indexer and runs `inspectSignBidirectionalTransaction` from a lazily imported module. [read 4234222]
- `src/components/midnight/use-sign-bidirectional-transaction-inspection.ts` is the second caller of that loader, for the transaction details panel. [read 4234222]
- `src/lib/midnight/sign-bidirectional-transaction-inspection.ts` is the one module that imports `@midnightntwrk/ledger-v9` as values. Its result is `{ callChains, request }`. [read 4234222]
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
- `SignetEventsSection`'s `TEvent` bound (`packages/ui/src/components/midnight/signet-events-section.tsx`) and `SignBidirectionalNotificationEvent` (`packages/ui/src/lib/midnight/sign-bidirectional-transaction-loader.ts`) type `source` as lib's `StoredSignetMiscEvent`. An `IndexedSignetMiscEvent` assigns to it. [run c09a270]
