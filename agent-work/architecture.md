# Architecture

## Design

The design the user settled. Change it only after a stage 01 gate or a user decision, and record
the change in `decisions.md`.

### 1. Shape

```
browser (packages/ui, static site)
   |  HTTP, JSON, CORS            also, directly from the browser:
   v                                - public EVM RPC (transaction status)
packages/backend  (Node)            - MPC output cache
   |- HTTP host (Fastify)
   |- services  -> repositories -> Postgres
   |- ingester  -> chain source -> Midnight indexer (Blockfrost)
   |- EVM trace fallback -> keyed EVM RPC
```

- The browser never talks to a Midnight indexer or node.
- The backend stores facts. It never returns a verdict. Signature checks, attestation checks and
  transaction inspection stay in the UI, computed from raw data the backend serves.
- Everything the database holds can be read again from a chain. That is what makes "drop and
  rebuild" safe. Storing anything that cannot be re-read needs a user decision first.

### 2. Packages

| Package | Holds | Runtime | May import |
| --- | --- | --- | --- |
| `packages/lib` | Domain code with two real consumers: network set, value schemas, Signet event decoding | Browser and Node | `@sig-net/midnight` (never the ledger WebAssembly) |
| `packages/api` | Per resource: zod schema, service interface, args schemas, HTTP client, service adaptor, in-memory fake | Browser and Node | `lib` |
| `packages/backend` | Composition root, HTTP host, configuration, ingester, chain source, schema, repositories, service implementations | Node | `lib`, `api` |
| `packages/ui` | The React app | Browser | `lib`, `api` |

Dependencies point one way: `lib` <- `api` <- `ui`, `backend`. `ui` and `backend` never import
each other. `api` holds no Fastify, no Drizzle, no React.

Code moves into `lib` only when its second consumer exists. Moving something "because it looks
shared" is forbidden by the repository rules.

### 3. Networks

- The networks are the SDK's `MidnightNetwork` set: `undeployed`, `preview`, `preprod`, `mainnet`.
- The backend serves a network when its configuration is complete: indexer URL, signer address,
  responder address, MPC root public key, start block. Otherwise the network is listed as
  `not configured`.
- One deployment per network. A deployment is the pair of contracts plus root key and start
  block. If the configuration of a network differs from what the database holds for it, the
  backend refuses to index that network until it is reset (section 9).
- The UI selects the network in the URL (`networkId`), as it does today.
- Preprod takes its addresses, root key and MPC output cache URL from the SDK
  (`getSignerContractAddress` and friends) unless overridden by configuration.

### 4. Data model

Postgres, through Drizzle. Table names end in `_v1`. Column properties are named exactly as the
resource fields. Every table is keyed by `network_id` first.

#### 4.1 `midnight_signet_deployments_v1`

What the backend indexes for a network. Written at start-up from configuration.

| Column | Type | Notes |
| --- | --- | --- |
| `network_id` | text, PK | |
| `signer_contract_address` | text | 64 hex, lowercase |
| `responder_contract_address` | text | 64 hex, lowercase |
| `mpc_root_public_key` | text | canonical form from the SDK |
| `start_block` | bigint | first block indexed |
| `create_time` | timestamptz | |

#### 4.2 `midnight_signet_indexer_checkpoints_v1`

| Column | Type | Notes |
| --- | --- | --- |
| `network_id` | text, PK | |
| `processed_block` | bigint | every block up to and including this one is fully stored |
| `processed_block_hash` | text | hash of that block when it was processed |
| `state` | text | `running` or `halted` |
| `halt_reason` | text, null | set exactly when `halted` |
| `head_block` | bigint | the indexer's height at the last loop, for the status display |
| `update_time` | timestamptz | |

#### 4.3 `midnight_signet_events_v1`

Every event either contract emitted, decodable or not.

| Column | Type | Notes |
| --- | --- | --- |
| `network_id` | text | PK part |
| `block_height` | bigint | PK part |
| `block_position` | integer | PK part. Rank of the event among this network's stored events in its block, in emission order, from 0 |
| `block_hash` | text | |
| `block_time` | timestamptz | |
| `transaction_hash` | text | |
| `contract_address` | text | the emitter |
| `emitter_roles` | text[] | `signer`, `responder`, or both when one contract plays both |
| `indexer_event_id` | bigint | the indexer's cursor, kept for audit and ordering inside a block |
| `event_name` | text | as emitted, NUL padding stripped |
| `payload` | bytea | as the SDK normalises it |
| `kind` | text | `decoded`, `unrecognised`, `undecodable` |
| `undecodable_reason` | text, null | |
| `request_id` | text, null | set exactly when `kind = decoded` |

Indexes: `(network_id, request_id, block_height, block_position)`.

The key is the chain position, never the indexer's id: the id is not guaranteed stable across
indexer instances.

#### 4.4 `midnight_signet_sign_requests_v1` (the aggregate table)

One row per declared request id, written by the ingester in the same transaction as the events
that change it. It groups by DECLARED id and verifies nothing, exactly as the UI's
`aggregateSignBidirectionalLifecycles` does today.

| Column | Type | Notes |
| --- | --- | --- |
| `network_id` | text | PK part |
| `request_id` | text | PK part |
| `first_event_block_height` | bigint | sort key: a request is ordered by its earliest event |
| `first_event_block_position` | integer | sort key |
| `state` | text | `requested`, `signed`, `responded`, `unrequested` (see below) |
| `caller_address` | text, null | from the first Sign Bidirectional event |
| `request_time` | timestamptz, null | block time of the first Sign Bidirectional event |
| `signature_time` | timestamptz, null | block time of the first Signature Responded event |
| `response_time` | timestamptz, null | block time of the first Respond Bidirectional event |
| `duration_ms` | bigint, null | `response_time - request_time`. May be negative |
| `sign_bidirectional_event_count` | integer | |
| `signature_responded_event_count` | integer | |
| `respond_bidirectional_event_count` | integer | |
| `last_event_block_height` | bigint | lets a client ask what changed |
| `last_event_block_position` | integer | |

`state` is derived from the counts and names what was DECLARED, not what was verified:
`unrequested` (no Sign Bidirectional event), `requested` (one, and no response of either kind),
`signed` (a Signature Responded event and no Respond Bidirectional event), `responded` (a Respond
Bidirectional event).

Indexes: `(network_id, first_event_block_height desc, first_event_block_position desc)`,
`(network_id, caller_address, first_event_block_height desc, first_event_block_position desc)`,
`(network_id, state, first_event_block_height desc, first_event_block_position desc)`, and a
trigram index on `request_id` and on `caller_address` for fragment search (`pg_trgm`).

Before stage 03 fixes the columns, census every column and filter the current table renders
(`sign-bidirectional-lifecycle-table.tsx`, `explorer.tsx`). A value the list needs must be a
column here. A value only the expanded row needs comes from the events.

The table must always equal a rebuild from `midnight_signet_events_v1`. A test proves it.

#### 4.5 `midnight_transactions_v1`

Read-through cache of raw Midnight transactions, for the UI's transaction inspection.

| Column | Type |
| --- | --- |
| `network_id` | text, PK part |
| `transaction_hash` | text, PK part |
| `raw` | bytea |
| `create_time` | timestamptz |

Served only for a hash that appears in `midnight_signet_events_v1`, so the backend is not an open
proxy to the indexer.

#### 4.6 `ethereum_transaction_outputs_v1`

Read-through cache of the `debug_traceTransaction` fallback.

| Column | Type |
| --- | --- |
| `chain_id` | bigint, PK part |
| `transaction_hash` | text, PK part |
| `trace` | jsonb (the value the SDK's `evmTraceOutputFromCallFrame` consumes or produces, decided in stage 03) |
| `create_time` | timestamptz |

Only a successfully read, mined trace is cached. A miss is never cached.

### 5. Ingestion: how no event is lost

One ingester loop per network. It is a poll loop. A subscription may wake it early and is never a
source of truth.

```
loop:
  head   = chainSource.headBlock()                      # height and hash
  target = head.height - SAFETY_MARGIN
  check  = chainSource.blockAt(checkpoint.processed_block)
  if check.hash != checkpoint.processed_block_hash: HALT "chain changed under the checkpoint"
  while checkpoint.processed_block < target:
    range  = [processed_block + 1, min(processed_block + RANGE_SIZE, target)]
    events = chainSource.eventsInRange(signer, responder, range)   # complete or throws
    tip    = chainSource.blockAt(range.to)
    in ONE database transaction:
      insert events (key: network, height, position)
      update the sign request rows those events touch
      set checkpoint = (range.to, tip.hash)
  re-read the last REREAD_BLOCKS behind the checkpoint and compare with what is stored
  sleep POLL_INTERVAL
```

Rules:

- **Whole ranges, ascending, never skipped.** A range that keeps failing halts the network
  (`state = halted`, with the reason) and shows in the status. It is never stepped over.
- **`eventsInRange` is complete or it throws.** It pages the indexer and refuses a result unless
  ids ascend strictly across pages and every event lies inside the range. It merges both
  contracts and assigns `block_position` by ascending indexer id inside each block.
- **Idempotent.** A crash between reading and committing replays the range. The primary key makes
  the replay a no-op or an error, never a duplicate. A replay that would write a DIFFERENT row at
  an existing key halts the network.
- **Single writer.** A Postgres advisory lock per network. A second ingester for the same network
  waits or exits.
- **Chain change detection.** The hash check above catches a reorganisation below the checkpoint
  and a test network reset.
- **A fresh start begins at `start_block`**, never at the head. At start-up the backend checks
  that neither contract exists at `start_block - 1`, and refuses to index otherwise.
- **Trailing re-read and full audit.** The re-read catches an indexer that served a range before
  it had finished indexing it. The audit (stage 06) re-walks the whole history and compares.

What this guarantees: the backend loses nothing the indexer serves, and notices if the indexer
later serves something different. It cannot prove the indexer itself is complete. Stage 01 tests
the properties this rests on, and each has a written fallback.

`SAFETY_MARGIN`, `RANGE_SIZE`, `REREAD_BLOCKS` and `POLL_INTERVAL` are configuration with defaults
chosen from stage 01's findings.

### 6. The chain source seam

```ts
interface MidnightChainSource {
  headBlock(): Promise<BlockRef>
  blockAt(height: number): Promise<BlockRef>
  eventsInRange(contracts: SignetContracts, range: BlockRange): Promise<readonly ChainSignetEvent[]>
  rawTransaction(transactionHash: string): Promise<Uint8Array>
  contractExistsAt(contractAddress: string, height: number): Promise<boolean>
}
```

One implementation reads a Midnight indexer's GraphQL (Blockfrost for the public networks, a
local indexer for `undeployed`). A fake implementation drives the ingester's tests. A node-reading
implementation, as the MPC has in Rust, could replace it without touching storage.

### 7. The API

Transport: `POST /<service>/<method>`, JSON body, JSON reply. Replies are values, not HTTP
errors: `{ ok: true, ... }` or `{ ok: false, error: string }`. Bytes travel as lowercase hex
without `0x`, times as ISO 8601, 64-bit numbers that may exceed 2^53 as decimal strings.

Each service is an interface in `api`. The backend implements it over repositories. The UI gets
an HTTP implementation of the same interface. A fake implementation with fixtures ships in `api`
for UI development and tests.

| Service | Methods | Notes |
| --- | --- | --- |
| Network | `listNetworks` | Per network: configured or not, the deployment (addresses, root key, start block), indexing status (state, processed block, head block, time of the processed block), and the indexer's HOST ONLY |
| Sign request | `listSignRequests`, `getSignRequest`, `listCallers` | List: network, search fragment, excluded callers, states, page size, page token. Get: the row plus every event of the request, raw |
| Midnight transaction | `getMidnightTransaction` | Raw bytes by network and hash |
| Ethereum transaction output | `getEthereumTransactionOutput` | The trace fallback, by chain id and transaction hash |

Plus `GET /healthz` for liveness, outside the service pattern.

Never return the indexer URL or any EVM RPC URL: both carry keys.

Paging is by keyset on the sort key, newest first. The page token encodes the last row's sort key.

The UI stays live by polling: it refetches what it shows on an interval. A row can change after
it is first seen (its signature and response arrive later).

### 8. The UI after the change

- Reads everything through the `api` services. `SignetEventStore`, the indexer services and the
  block window code go.
- Verification is unchanged in substance: it runs in the browser on raw events, raw transactions
  and outputs. The MPC output cache and the public EVM RPC are still called from the browser.
  Only the `debug_traceTransaction` fallback goes through the backend.
- The list is paged. Search, excluded callers and state filter are backend queries and live in the
  URL beside `networkId`.
- The "Starting Block" control is removed.
- The configuration popover is read-only. It shows the selected network's configuration from the
  Network service and the browser-side endpoints from the build.
- A header line shows the indexing status: processed block, head block, and whether the network
  is halted.
- Configuration shrinks to `VITE_EXPLORER_BACKEND_URL`, `VITE_MIDNIGHT_DEFAULT_NETWORK` and the
  browser-side endpoint overrides (EVM RPC URLs, MPC output cache URL).
- The first page load still carries one WebAssembly module (the onchain runtime). The ledger
  module stays lazy.

### 9. Operations

- **No migrations.** `drizzle/` holds exactly one migration, regenerated from the whole schema.
  A schema change means dropping the database and indexing again from each `start_block`.
- **The wipe is always an explicit command.** The backend compares the applied schema with the
  one it ships and refuses to start on a mismatch. It never erases anything at start-up.
- **Reset one network:** a command that deletes that network's rows in every table and its
  checkpoint. Used for a contract redeploy, a test network reset and a corrected start block.
- **Roles:** one image, started as `ingest`, `serve` or both.
- **Local stack:** `compose.yaml` with Postgres only, bound to `127.0.0.1` on a host port that
  does not clash with the demo's 5432.
- **Hosting is out of scope for this task.** The UI stays on GitHub Pages and the backend allows
  its origin through CORS.

### 10. Backend configuration (environment)

Server-only. None of it reaches the browser.

| Variable | Purpose |
| --- | --- |
| `DB_CONNECTION_STRING` | Postgres |
| `BACKEND_ROLES` | `ingest`, `serve` or `ingest,serve` |
| `HTTP_PORT` | Port the host listens on |
| `CORS_ALLOWED_ORIGINS` | Comma-separated origins of the UI |
| `LOG_LEVEL` | |
| `MIDNIGHT_<NETWORK>_BLOCKFROST_PROJECT_ID` | Builds the Blockfrost indexer URL for that network |
| `MIDNIGHT_<NETWORK>_INDEXER_URL` | An explicit indexer URL, for `undeployed` or an override |
| `MIDNIGHT_<NETWORK>_SIGNER_CONTRACT_ADDRESS` | Override of the SDK's value, required where the SDK has none |
| `MIDNIGHT_<NETWORK>_RESPONDER_CONTRACT_ADDRESS` | Same |
| `MIDNIGHT_<NETWORK>_MPC_ROOT_PUBLIC_KEY` | Same |
| `MIDNIGHT_<NETWORK>_SIGNET_EVENTS_START_BLOCK` | First block indexed. Preprod has a built-in default |
| `ETHEREUM_SEPOLIA_RPC_URL`, `ETHEREUM_MAINNET_RPC_URL` | Keyed endpoints for the trace fallback |

Configuration is parsed once with zod at start-up into an immutable object. An invalid value stops
the start and the error names the variable, never its value.

## Out of scope

- `sig-net/full-stack-demo` entirely, including its use of the explorer image.
- Where the backend and its database are hosted.

## Assumptions

What the design rests on. Each is a gate of the first stage.

- `contractEvents` rows are ordered by ascending `id` always, including across pages. [unverified]
- `fromBlock` and `toBlock` are inclusive at both ends. [unverified]
- An offset walk of a closed block range is stable while the chain advances. [unverified]
- When the indexer reports height H, all events of every block at or below H are already served. [unverified]
- A block at or below the indexer's reported head is never replaced. [unverified]
- `block(offset: { height })` gives the hash of any past height, cheaply. [unverified]
- The indexer honours a `limit` large enough for one range, and its rate limits allow the ingestion loop. [unverified]
- `transactions(offset: { hash })` returns the raw bytes of an old transaction. [unverified]
- `contract(address, offset: { height })` says cleanly that a contract does not exist below its deployment block. [unverified]
- Node runs the backend's TypeScript, and its imports of the other workspace packages' source, with no build step. [unverified]
- `debug_traceTransaction` works from `SEPOLIA_FORK_RPC_URL` and its result decodes in Node with the SDK. [unverified]

## Open questions

None: every question of the architecture round was answered, and the answers are in `decisions.md`.
