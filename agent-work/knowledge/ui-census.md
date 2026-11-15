# Pack: ui-census

Read this before changing how the UI gets its data, or before fixing what the API must serve.
It is the census of what the app reads, renders and filters today. Paths are as at the baseline,
under `src/`. After stage 02 the same files are under `packages/ui/src/`.

## Where the data comes from today

- `routes/__root.tsx:20-27` mounts `MidnightProvider` and, inside it, `MidnightSignetEventsProvider` around every page: events load whatever page is open. [read 6ee55f6]
- `components/contexts/MidnightContext.tsx:21-34` holds the selected network, its configuration (the ten fields of `MidnightNetworkConfig`, `lib/midnight/network.ts:20-44`), in-memory overrides typed into the popover, and the indexer services. [read 6ee55f6]
- `components/contexts/MidnightSignetEventsContext.tsx:67-192` reads the chain tip, resolves the starting block and drives `SignetEventStore` (`lib/midnight/signet-event-store.ts:98-286`), which reads both contracts newest first in slices and aggregates lifecycles in memory. [read 6ee55f6]
- The selected network is the `networkId` search parameter, validated and kept across pages by `routes/midnight.tsx:14-30`, then copied into the context (`:33-39`). [read 6ee55f6]
- Every consumer of `useMidnight()`: `use-sign-bidirectional-transaction-inspection.ts:26` (indexer URL), `use-lifecycle-verification.ts:137` (indexer URL, root key, both EVM RPC URLs, cache URL, signer address), `signature-check.tsx:24`, `sign-bidirectional-transaction-details.tsx:43`, `evm-transaction-status.tsx:313`, `midnight-configuration.tsx:81` (everything, editable), `sign-bidirectional-lifecycle-table.tsx:228` (network), `routes/midnight/explorer.tsx:160`, `routes/midnight/contract-analyser.tsx:21`, `routes/midnight.tsx:35`. All but the last three are under `components/midnight/`. [run 6ee55f6]
- The only consumers of the events context are `routes/midnight/explorer.tsx` and `components/midnight/signet-events-starting-block.tsx`. [run 6ee55f6]
- What goes when the UI reads the backend: `lib/midnight/signet-event-store.ts`, `indexer-services.ts`, `indexer-block-height.ts`, `signet-events-window.ts`, `components/midnight/signet-events-starting-block.tsx`, `components/contexts/MidnightSignetEventsContext.tsx`, each with its test, and the raw transaction query in `lib/midnight/sign-bidirectional-transaction-loader.ts:9-48`. [run 6ee55f6]

## What one list row renders

The table is `components/midnight/sign-bidirectional-lifecycle-table.tsx`. A row is one
`SignBidirectionalLifecycle` (`lib/midnight/sign-bidirectional-lifecycle.ts:18-29`): a request id
and three lists of decoded events.

- Requested at (`:252-260`): the block time of EVERY Sign Bidirectional event, stacked, three at most then an ellipsis. "no notification" when there is none. [read 6ee55f6]
- Request Id (`:261-272`): the id, a copy-link button and an open-in-new-tab button built from the route and `networkId`. [read 6ee55f6]
- Caller (`:273-286`): the caller address of EVERY Sign Bidirectional event, stacked, each with a button that excludes that caller. [read 6ee55f6]
- Type (`:287`): the constant text "Bidirectional". [read 6ee55f6]
- Signature (`:288-301`): the block time of every Signature Responded event, each with the time since the FIRST request. A pending icon when none. [read 6ee55f6]
- Response (`:302-310`): the block time of every Respond Bidirectional event. A pending icon when none. [read 6ee55f6]
- Duration (`:311-319`): first response minus first request, which may be negative (`lib/midnight/sign-bidirectional-lifecycle.ts:96-111`). [read 6ee55f6]
- Order: by each lifecycle's earliest event of any kind, newest first, compared by indexer event id (`lib/midnight/sign-bidirectional-lifecycle.ts:89-93`). [read 6ee55f6]
- So the list needs more than first values: it shows every time and every caller of a request with several notifications. The aggregate table of the architecture (4.4) keeps first values and counts. Stage 03 settles the difference. [read 6ee55f6]

## Filters and counts of the page

All in `routes/midnight/explorer.tsx`.

- Search (`:163-170`, `lib/midnight/sign-bidirectional-lifecycle.ts:128-140`): a case-insensitive fragment of the request id, or of ANY caller address the request names, with an optional `0x`. A `requestId` search parameter seeds the box, and editing the box drops it. [read 6ee55f6]
- Excluded callers (`:171-188`): the `excludeCallers` search parameter, a comma-separated list of canonical addresses. A request is excluded when ANY of its notifications names an excluded caller. A request with no notification is never excluded. [read 6ee55f6]
- The exclusion box offers every caller seen so far (`components/midnight/excluded-callers-filter.tsx:28-48`, fed by `signBidirectionalLifecycleCallers`). This is what `listCallers` replaces. [read 6ee55f6]
- The status text (`:93-134`) counts matching events and requests out of all loaded, and reports the load. There is no state filter today: the architecture adds one. [read 6ee55f6]
- A link to a request older than the window makes the page step the starting block back until the request is found (`:196-214`). With the whole history in the backend this search, its `searching` props and its splash go. [read 6ee55f6]
- The route rewrites the URL when a parameter is not in canonical form (`:57-87`). New parameters follow the same rule. [read 6ee55f6]

## What the expanded row needs

- Three columns of events, one tab per event (`components/midnight/signet-events-section.tsx:27-120`): the emitter's roles, transaction hash, block hash, block height, block time, then the decoded record. Tabs are keyed by the indexer's event id `source.id`. [read 6ee55f6]
- Verification (`components/midnight/use-lifecycle-verification.ts:134-245`) runs in the browser: the inspection of each notification's raw Midnight transaction, the signature check against the root key, the attestation check, and the output from the MPC cache first and an EVM trace second. Its result maps are keyed by `source.id` too. [read 6ee55f6]
- The indexer's event id is used as a key in six files: `use-lifecycle-verification.ts`, `signature-check.tsx`, `signet-events-section.tsx`, `attestation-check.tsx`, `sign-bidirectional-lifecycle-table.tsx` and `lib/midnight/sign-bidirectional-lifecycle.ts`. The backend's key is the chain position, so each of these needs a key that survives. [run 6ee55f6]
- The raw transaction is fetched once per indexer, hash and request, and the ledger WebAssembly is loaded by a dynamic import beside it (`lib/midnight/sign-bidirectional-transaction-loader.ts:65-82`). Keep the dynamic import exactly there. [read 6ee55f6]
- The trace fallback asks the EVM node itself today (`lib/midnight/evm-transaction-output.ts:33-70`) with the URL from `evmRpcUrl` (`lib/midnight/evm-transaction-status.ts:8-19`). The transaction STATUS display keeps asking the public RPC from the browser: only the trace moves to the backend. [read 6ee55f6]

## Configuration of the build

- The variables are the `VITE_MIDNIGHT_*` keys of `vite-env.d.ts:8-23`, read through `lib/explorer-env.ts:1-64`, which overlays `window.explorerEnv` set by `env.js` (`index.html:12`, written in the image by `docker/30-explorer-env.sh`). The env reader lists every key by hand, so a new key that is not added there is a type error. [read 6ee55f6]
- `VITE_EXPLORER_VERSION` is defined by `vite.config.ts:50-52` and is not an env file variable. [read 6ee55f6]
