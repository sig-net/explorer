# Pack: indexer

Read this when your step reads the Midnight indexer, or decides how events and transactions are stored.

## The service

- Preprod's indexer is `https://midnight-preprod.blockfrost.io/api/v0?project_id=<token>`, a GraphQL endpoint taking POST. Without the token it answers 403. The old public host `indexer.preprod.midnight.network` answers 410. [run 4234222]
- Its responses carry no rate limit header. The quota of the token's plan is not known. [run 4234222]
- `{ block { height hash timestamp } }` is the tip. `block(offset: { height: N }) { hash }` is the block at a height, and `null` above the tip. Height 0 gives the genesis hash, `df831b09a8baa92badf47762ce5ac439b7e47e3ed3d39600cfdd44fad552361b` on preprod. Hashes come without a `0x` prefix, timestamps in milliseconds. [run 4234222]
- On one sample the indexer's tip hash equalled the node's finalised head, and over a 90 second trial of `probes/indexer-soak.mjs` the tip was never ahead of the node's finalised height. [run 4234222]
- `transactions(offset: { hash: $hash }) { raw }` gives a transaction's bytes as hex. The one sampled was 12,586 bytes. [run 4234222]
- `ContractEventFilter` takes `contractAddress`, `fromBlock`, `toBlock`, `transactionHash`, `types`, `fieldPrefixes`. [run 4234222]

## Through the SDK

- `signetEventSourceFromIndexer({ queryUrl })` of `@sig-net/midnight` returns a source whose `streamSignetEvents(address, { fromBlock, toBlock })` yields every event of one contract in an inclusive block range, 100 a page by offset (`node_modules/@sig-net/midnight/dist/signet-contract-events.js:108-124`). [read 4234222]
- Each event is an `IndexedSignetMiscEvent`: `id`, `maxId`, `transactionId`, `transactionHash`, `blockHeight`, `blockHash`, `blockTimestamp` (a `Date`), `name`, `payload` (`dist/signet-contract-events.d.ts`). [read 4234222]
- `id` is one counter across all contracts of the chain: ascending `id` is emission order, and the ids of the two Signet contracts interleave with gaps. Over the whole preprod history it ascended on every page. [run 4234222]
- `tryDecodeSignetEvent(event)` gives `undefined` for a name that is not a Signet event, `{ ok: false, reason }` for a payload that does not decode, and `{ ok: true, event }` with `name`, `requestId` and `record`. The three names are `SignBidirectionalEvent`, `SignatureRespondedEvent`, `RespondBidirectionalEvent`. [read 4234222]
- The SDK, the ledger WebAssembly (`@midnightntwrk/ledger-v9`) and the explorer's `inspectSignBidirectionalTransaction` run under plain Node with no bundler: `probes/node-runtime.mjs` read an event, fetched its transaction and inspected it in 31 ms, recovering the request record. [run 4234222]
- The SDK redacts the query string when it puts the URL into an error (`redactUrlQuery`, `dist/signet-contract-events.js:204`). Code of our own must do the same. [read 4234222]

## Preprod's contracts and volume

- Signer `c423fca48329307ba00383e8c40cf1b3a83a7728a2b6721e863cfa16d25fb3ec`, deployed at block 3,386,746. Responder `627ef19bb1db09b4261e31a4f87a6b299581c3d635c409bad9ac4547370ef4d5`, deployed at 3,386,749 (`packages/ui/src/lib/midnight/network.ts:47-55`). The SDK publishes both addresses (`getSignerContractAddress`, `getResponderContractAddress`). [read 4234222]
- On 2026-11-16 the signer held 5,033 events and the responder 10,103, between blocks 3,389,203 and 3,441,654. Reading all of them took 9 s and 27 s. That is about 1,400 requests and 4,200 events a day. [run 4234222]
- A block takes 6 seconds (`src/lib/midnight/signet-events-window.ts:5`). [read 4234222]

## Running a probe

- From the repository root: `IDX="https://midnight-preprod.blockfrost.io/api/v0?project_id=$(dev-secrets get MIDNIGHT_PREPROD_BLOCKFROST_PROJECT_ID)" node agent-work/probes/node-runtime.mjs 2>&1 | redact`. The soak probe also takes `NODE_RPC`, which is `https://rpc.midnight-preprod.blockfrost.io?project_id=<token>` with no path: it answered `chain_getFinalizedHead`, `chain_getHeader` and `chain_getBlockHash` in a 90 second trial of the probe. [run 4234222]
- The SDK's `signetEventSourceFromIndexer` calls `fetch` with no `AbortSignal`, so the adaptor's deadline rejects `eventsIn` while the SDK's request runs on until the server ends it. [unverified]
- The backend's adaptor is `packages/backend/src/source/indexer/indexer-source.ts`, which exports `INDEXER_REQUEST_TIMEOUT_MS = 30_000` (D50 puts the other defaults in the backend's configuration). The conversion of a cell to `RequestCellWire` is written in the backend's inspection and in the private `inspectionToWire` of `packages/api/src/wire.ts`. [unverified]
