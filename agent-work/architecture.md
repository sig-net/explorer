# Architecture

Status: round 2. `decisions.md` holds what is settled. D10 to D15 wait for the user.
Marks: `[run 6763bf5]` and `[read 6763bf5]` refer to this repository at that commit.
`[read mpc 73bb9dfe]` refers to `sig-net/mpc` on `develop`. Probes ran on 2026-11-16 against
Blockfrost's Midnight preprod with the project token from `dev-secrets`.

## Design

### Shape

```
browser (packages/ui) --HTTP JSON--> backend (packages/backend) --SQL--> database
                                          |
                                          +--GraphQL over HTTP--> Midnight indexer (per network, token held server side)
```

- The UI reads lifecycles, events and transaction inspections from the backend alone. It holds
  no Midnight endpoint and no token.
- The backend is one long-running Node process with two parts that share nothing but the
  database: an indexer loop per configured network, which writes, and an HTTP API, which reads.
- The database is the only state. A backend restart resumes from the cursor rows.

### Source the backend reads (D01)

The Midnight indexer's GraphQL API, behind a port (an interface the indexer loop
depends on) so a node-backed source can replace it. Reads are bounded block ranges through
`contractEvents(filter: { contractAddress, types: [MISC], fromBlock, toBlock }, limit, offset)`,
the query the SDK's `signetEventSourceFromIndexer` already sends.

### No gaps

Per network one cursor row holds `next_block`. One pass of the loop:

1. Read the indexer's tip `{ block { height hash } }`. Call it `tip`.
2. If `next_block > tip`, sleep and go to 1.
3. Take the range `[next_block, min(tip, next_block + RANGE - 1)]`.
4. Read every event of the signer and of the responder in that range, paging until a short page.
5. For each `SignBidirectionalEvent`, fetch the raw transaction by hash and inspect it (the
   ledger WebAssembly, in Node).
6. In ONE database transaction: insert the events, upsert the lifecycle rows they touch, insert
   the inspections, set `next_block = range end + 1`.
7. Go to 1 without sleeping while behind the tip.

Why this has no gaps: the cursor moves only inside the transaction that stores the range, so
"`next_block = N`" is a statement that every event below N is stored. A crash anywhere before
the commit leaves the cursor where it was, and the range is read again. The event primary key
(network, indexer event id) makes a repeated insert a no-op. A range at or below the tip is
finalised, so paging it by offset reads a set that does not change.

A subscription cannot make that statement: it delivers events, never "block N is complete", so
a stream that dropped an event and a stream with nothing to say look the same.

### Chain identity and resets

The cursor row stores the chain's genesis hash (`block(offset: { height: 0 }) { hash }`). Each
pass compares it. A different hash, or a tip below `next_block - 1`, means the network was
reset: the backend deletes that network's rows and its cursor in one transaction and starts
again from the configured start block.

### Network separation (D03)

One set of tables with a `network` column leading every primary key and index. A wipe
is `DELETE ... WHERE network = $1`.

### Data model (proposed)

- `chain_cursor(network PK, genesis_hash, signer_address, responder_address, start_block,
  next_block, tip_height, tip_read_at)`. A change of either address is treated as a reset.
- `signet_event(network, event_id, contract_address, roles, name, payload, kind, request_id,
  decode_error, transaction_hash, block_height, block_hash, block_time)`, primary key
  `(network, event_id)`. The source of truth: every event either contract emitted, with the
  three kinds the UI shows today (decoded, unrecognised, undecodable). Decoded fields are
  derived from `payload` by the shared decoder on read, never stored twice.
- `sign_bidirectional_lifecycle(network, request_id, first_event_id, caller_address,
  requested_at, signature_responded_at, responded_at, request_count, signature_count,
  respond_count)`, primary key `(network, request_id)`, index `(network, first_event_id DESC)`.
  The table the list page reads: one row per request id. Written by the indexer loop in the
  same transaction as the events. Rebuildable from `signet_event` at any time.
- `sign_bidirectional_transaction_inspection(network, transaction_hash, request_id, call_chains
  jsonb, request jsonb, error)`. The result of inspecting a notification's transaction. The raw
  transaction is not stored (12.6 KB each, mostly proofs).

### Read model: aggregate table, written by the application (D04)

The list page reads `sign_bidirectional_lifecycle`, a table, not a SQL view. The indexer loop
upserts it in application code, in the transaction that stores the events. No database trigger.

### API (proposed)

`packages/api` defines the contract once: zod schemas (zod is a TypeScript validation library:
one schema gives both the runtime check and the static type) for each request and response, a
typed fetch client for the UI, and a route adapter the backend mounts. Bytes travel as lowercase
hex, bigints as decimal strings.

- `GET /networks`: the networks the backend indexes, each with its contract addresses, MPC root
  public key, tip, `next_block` and how far behind it is.
- `GET /networks/:network/lifecycles?before=&limit=&search=&excludeCallers=`: keyset pages,
  newest first.
- `GET /networks/:network/lifecycles/:requestId`: one lifecycle with its events and inspections.
- `GET /networks/:network/callers`: distinct caller addresses, for the exclude filter.

### Repository layout

Yarn workspaces, as the user set out:

- `packages/ui`: the present app.
- `packages/backend`: the indexer loops and the HTTP server.
- `packages/api`: schemas, client, route adapter.
- `packages/lib`: code with two real consumers. From the census of what the backend and the UI
  both need: the event decoding wrapper (`signet-events.ts`), contract address parsing, the
  network list. `sign-bidirectional-transaction-inspection.ts` moves to the backend alone, and
  the ledger WebAssembly leaves the browser bundle.

### What changes in the UI

- The events context, the event store, the starting block control and the step-back logic are
  replaced by paged reads of the backend.
- Search and the excluded callers filter become query parameters the backend answers.
- The configuration popover shows the indexer URL, the node URL, the contract addresses and the
  start block read-only, filled from `GET /networks` (D07). The MPC root public key, the EVM RPC
  URLs and the MPC output cache URL stay editable, as the browser still uses them (D05, D06).
- The UI polls the backend for new rows (D14).

## Out of scope

- The Solana and contract analyser routes.
- Indexing from a Midnight node by replaying transactions, as `sig-net/mpc` does (D01).
- Moving the EVM transaction status, the MPC output cache read, or the signature and
  attestation checks to the backend (D05, D06).

## Assumptions

- A1 The Blockfrost preprod indexer answers `contractEvents` with `fromBlock` and `toBlock`
  bounds when given a project token. [run 6763bf5]: 15,070 events of the preprod signer and
  responder read in 42 s, 100 per page.
- A2 The indexer's tip is the node's finalised head. [run 6763bf5]: one sample, same height
  3441450 and same hash from `chain_getFinalizedHead` and from `{ block { height hash } }`,
  while the node's best head was 3441452. One sample is one sample: stays [unverified] as a
  general statement. Gate: stage 1 compares the two every pass for a day.
- A3 When the indexer reports tip N, every event of every block up to N is already served by
  `contractEvents`. [unverified]. The no-gap argument rests on it. Gate: stage 1 runs the loop
  twice against preprod, once live range by range and once as a single pass over the same
  blocks an hour later, and compares the event id sets.
- A4 A year of preprod data is about 1.5 million events and 500,000 lifecycles. [run 6763bf5]:
  15,070 events between blocks 3389203 and 3441443 (3.6 days). Whether that rate is real use or
  load testing is unknown.
- A5 At that size a lifecycle view over the events takes 1.8 s for the newest 50 rows and an
  aggregate table 0.6 ms. [run 6763bf5]: Postgres 17 in a scratch container, synthetic rows,
  one run each, warm cache.
- A6 Deleting one network's rows at that size takes about 1.3 s. [run 6763bf5]: same scratch
  database.
- A7 A raw sign bidirectional transaction is 12.6 KB. [run 6763bf5]: 7 transactions.
- A8 `@midnightntwrk/ledger-v9` loads and deserialises a transaction under Node, outside a
  browser. [unverified]. Gate: first step of stage 1, a script that inspects one preprod
  transaction in Node.
- A9 The genesis block hash changes when a test network is reset. [unverified]: reasoned from
  how a chain is restarted, not observed.
- A10 The mpc indexer reads a node alone over HTTP JSON-RPC, walks every finalised height in
  order, decodes `send_mn_transaction` extrinsics with the ledger crates and replays transcript
  programs to obtain the events, and advances its checkpoint only after the consumer has
  processed a block. [read mpc 73bb9dfe] `chain-midnight/src/indexer.rs:626-730`,
  `rpc.rs:396-539`, `emissions.rs:84-190`.
- A11 The mpc indexer holds no chain identity check. [read mpc 73bb9dfe] `rpc.rs:588`,
  `indexer.rs:149`.
- A12 Today the UI reads from three places: the Midnight indexer (events, tip, raw
  transactions), the MPC output cache, and EVM JSON-RPC nodes. [read 6763bf5]
  `src/lib/midnight/signet-event-store.ts:240`, `indexer-block-height.ts:30`,
  `sign-bidirectional-transaction-loader.ts:36`, `mpc-output-cache.ts:27`,
  `evm-transaction-status.ts:110`.

## Open questions

- Q1 [answered] The token-gated indexer. D01.
- Q2 [answered] Postgres (D02). Where it runs was not answered: asked again as Q8.
- Q3 [answered] A `network` column. D03.
- Q4 [answered] An aggregate table. D04.
- Q5 [answered] They stay in the browser. D05.
- Q6 [answered] They stay in the browser. D06.
- Q7 [answered] The fields stay, read-only, for information. D07.
- Q8 [open] Where do the backend and Postgres run, and who serves the UI: GitHub Pages as today
  with the backend on another origin, or one deployment (a compose stack) that serves both?
