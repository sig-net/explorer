# Pack: the Signet domain

## The protocol in five lines

- Signet runs as TWO Midnight contracts per network. Requester contracts notify the **signer** of
  a request, and the signer emits a Sign Bidirectional event. The MPC posts its answers through
  the **responder**, which emits a Signature Responded event and later a Respond Bidirectional
  event (the attested result of executing the signed transaction on the foreign chain).
  `[read]` `README.md` "Midnight configuration".
- A request has a 32-byte **request id**. Events are linked by the id they DECLARE.
- The contracts are unauthenticated emitters. Nothing stops a kind being emitted twice, or a
  response being emitted for a request that never was. `[read]`
  `src/lib/midnight/sign-bidirectional-lifecycle.ts` (comment on `SignBidirectionalLifecycle`).
- Grouping by declared id therefore verifies NOTHING. Verification is separate, done in the
  browser: a signature is checked against the request's derived signing key under the MPC root
  public key, an attestation is checked over the output.
- One contract may play both roles. `[read]` `src/lib/midnight/signet-event-store.ts`
  (`contractReads`).

## Event kinds (the SDK's `SignetEventName`)

| Name | Emitted by | Carries |
| --- | --- | --- |
| `SignBidirectionalEvent` | signer | the notification: request id, caller address, path, the transaction to sign, schemas |
| `SignatureRespondedEvent` | responder | request id, signature (big R x and y, s, recovery id) |
| `RespondBidirectionalEvent` | responder | request id, target block height, output kind, attestation |

`[read]` `node_modules/@sig-net/midnight/dist/signet-contract-events.d.ts` and `.js`.
Decoding: `tryDecodeSignetEvent(source)` returns `undefined` for a name that is not a Signet
event, `{ ok: true, event }` or `{ ok: false, source, reason }`. The explorer keeps all three
outcomes as `decoded`, `unrecognised`, `undecodable`. `[read]` `src/lib/midnight/signet-events.ts`.

A raw event from the indexer (`IndexedSignetMiscEvent`) has: `name`, `payload` (bytes), `id` (the
indexer's global cursor, ascending in emission order), `maxId`, `transactionId`,
`transactionHash`, `blockHeight`, `blockHash`, `blockTimestamp`. `[read]` the same `.d.ts`.

## The lifecycle (one list row)

`[read]` `src/lib/midnight/sign-bidirectional-lifecycle.ts`:

- A lifecycle is every decoded event that declares one request id, in three lists by kind, each
  in emission order. Any list may be empty.
- Lifecycles are ordered by their EARLIEST event of any kind, newest first.
- Duration is from the first Sign Bidirectional event to the first Respond Bidirectional event.
  It can be negative. It is null while either is missing.
- Search matches a case-insensitive fragment of the request id or of a caller address, with an
  optional `0x` prefix.
- The caller is `record.callerAddress` of a Sign Bidirectional event.

The backend's aggregate table must reproduce exactly these rules
(`agent-work/architecture.md` section 4.4).

## What the expanded row loads today (all from the browser)

`[read]` `src/components/midnight/use-lifecycle-verification.ts` and the modules it imports:

| Data | From | After this task |
| --- | --- | --- |
| Raw Midnight transaction of the notification | the indexer, by hash (`sign-bidirectional-transaction-loader.ts`) | the backend |
| Transaction inspection | the ledger WebAssembly, in the browser (`sign-bidirectional-transaction-inspection.ts`) | unchanged |
| Attested output | the MPC output cache (`mpc-output-cache.ts`, SDK `MpcOutputCacheReader`) | unchanged, browser |
| EVM transaction status | a public EVM RPC (`evm-transaction-status.ts`) | unchanged, browser |
| EVM transaction output, when the cache has none | `debug_traceTransaction` (`evm-transaction-output.ts`) | the backend |
| Signature check, attestation check | computed (`signature-check.ts`, `attestation-check.ts`) | unchanged, browser |

## Networks and known deployments

- Networks: the SDK's `MidnightNetwork` enum: `undeployed`, `preview`, `preprod`, `mainnet`.
  `[read]` `src/lib/midnight/network.ts`.
- The SDK publishes Signet values for preprod only: `getSignerContractAddress`,
  `getResponderContractAddress`, `getMpcRootPublicKey`, `getMpcOutputCacheUrl`.
  `[read]` `README.md`, `network.ts`. `[unverified]` what each returns for a network with none.
- Preprod, at SDK `0.26.0-rc.15`: signer
  `c423fca48329307ba00383e8c40cf1b3a83a7728a2b6721e863cfa16d25fb3ec` deployed at block 3386746,
  responder `627ef19bb1db09b4261e31a4f87a6b299581c3d635c409bad9ac4547370ef4d5` at block 3386749.
  `[read]` `network.ts` (`SIGNET_EVENTS_EARLIEST_BLOCKS`). The start block is the lower one.
- Preprod contracts are redeployed with SDK release candidates. An SDK bump can change the
  addresses and so require a network reset.
- Volume: `[run]` the planning session saw about 8,700 events and 2,900 requests in the two days
  before the tip on preprod.
- Requests on preprod target Sepolia (chain id 11155111). `[run]` seen in an expanded row.

## How the MPC indexes Midnight (the model for the no-gaps design)

`[read]` `~/Projects/github.com/sig-net/mpc/chain-signatures/chain-midnight/src/indexer.rs`:

- It reads the NODE over RPC, not an indexer.
- `run_with_source`: read the persisted checkpoint, sample the finalised head, index every height
  from checkpoint + 1 to the head in order, then poll the finalised head and close every gap in
  order.
- A block that fails is retried for a fixed budget, then the run fails. It is never skipped.
- The checkpoint advances only after the consumer took the block, so a restart replays, and
  duplicates are removed downstream.
- A fresh MPC node anchors at the head. The explorer differs on purpose: it starts at the
  deployment block because it wants history.
