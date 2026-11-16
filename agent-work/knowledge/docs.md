# Pack: docs

Read this when your step writes or corrects the repository's documentation.

## What the root README says that is no longer true

Line numbers are those of `README.md` at c9d0e97, which describes the app as it was before the backend existed.

- Lines 123, 198, 199 and 220 to 256: the section "Preprod and Blockfrost", the variables `VITE_MIDNIGHT_<NETWORK>_SIGNER_CONTRACT_ADDRESS`, `VITE_MIDNIGHT_<NETWORK>_RESPONDER_CONTRACT_ADDRESS`, `VITE_MIDNIGHT_PREPROD_BLOCKFROST_PROJECT_ID` and `VITE_MIDNIGHT_PREPROD_SIGNET_EVENTS_FROM_BLOCK`, and the table of indexer, indexer WebSocket and node URLs. The browser reads none of them. [run c9d0e97]
- Line 291 names `indexer-services.ts`, and line 301 places `@midnightntwrk/ledger-v9` in a lazy chunk of the UI. Both are gone from the UI, whose build emits one `.wasm`, the onchain runtime. [read c9d0e97]
- Line 321 names `MidnightSignetEventsProvider` and `MidnightSignetEventsContext.tsx`, 325 the UI calling `streamSignetEvents`, 344 `signet-events-window.ts`, 383 `signet-event-store.ts`, 397 `useMidnightSignetEvents`, 443 `signBidirectionalLifecycleCalledBy`. None exists. [run c9d0e97]
- Line 375 names `packages/ui/src/lib/midnight/signet-events.ts`: the module is `packages/lib/src/midnight/signet-events.ts`. [run c9d0e97]
- Line 456 names `sign-bidirectional-transaction-loader.ts`, which is gone. Lines 458 and 489 place the transaction inspection and its fixture under `packages/ui`: they are in `packages/backend/src/inspection/`. [run c9d0e97]
- Lines 33, 45 and 193 name `yarn dev`, which step 05.7 renames `yarn dev:ui` (D60). [read c9d0e97]

## What is true today

- The variables the UI reads are `VITE_EXPLORER_API_URL`, `VITE_MIDNIGHT_DEFAULT_NETWORK`, `VITE_MIDNIGHT_PREPROD_MPC_ROOT_PUBLIC_KEY`, `VITE_MIDNIGHT_UNDEPLOYED_MPC_ROOT_PUBLIC_KEY`, `VITE_MIDNIGHT_PREPROD_MPC_OUTPUT_CACHE_URL`, `VITE_MIDNIGHT_ETHEREUM_MAINNET_RPC_URL` and `VITE_MIDNIGHT_ETHEREUM_SEPOLIA_RPC_URL` (grep of `VITE_` over `packages/ui`). [run c9d0e97]
- The UI's image forwards every `VITE_MIDNIGHT_*` and `VITE_EXPLORER_*` variable of its container to the app (`packages/ui/docker/30-explorer-env.sh`). [read c9d0e97]
- The request list loads 50 lifecycles and a "Load more" button the next 50 (`packages/ui/src/components/midnight/sign-bidirectional-lifecycle-table.tsx`). Search and caller exclusion are answered by the backend, and a search under 3 characters is no search (D22, D41). [read c9d0e97]
- The configuration popover shows the backend's addresses, start block and source URL read only and marks a network the backend does not serve, and the page shows each network's sync state (D11). [unverified]
- `oxfmt` formats Markdown and skips `AGENTS.md` (`.oxfmtrc.json`): `yarn format` after writing, `yarn format:check` to see. [read c9d0e97]
- `AGENTS.md` keeps setup instructions and reference material out of itself, in `README.md` and `docs/` (`AGENTS.md:4`). Its file layout rules name `packages/ui` alone. [read c9d0e97]

## What the workflows need, which nobody on this machine changes

- `.github/workflows/pages-deploy.yml:81` copies `dist/index.html` and `:84` uploads `dist`: the build writes `packages/ui/dist`. Its build step (`:74-79`) sets no `VITE_EXPLORER_API_URL`, which the UI needs to find the backend. [read c9d0e97]
- `.github/workflows/docker-publish.yml:1` says "root Dockerfile", and `:72` and `:108` build `context: .` with no `file:`: the UI's image is `packages/ui/Dockerfile`. Nothing publishes `packages/backend/Dockerfile`. [read c9d0e97]
