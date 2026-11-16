# Architecture

Status: settled in round 3. Every decision is in `decisions.md`, and none waits on the user.

## Outcomes

What the user asked for, in terms they would recognise as delivered or not. One line each:
`- O1 <the outcome>`. The review of the whole branch gives each a verdict.

- O1 A client of the sig integration opens the explorer and sees the requests of a supported Midnight network without entering an indexer URL, a node URL or any token.
- O2 The browser makes no request to a Midnight node or a Midnight indexer: every piece of Midnight data it shows comes from the explorer's backend.
- O3 The backend is a long running Node server that reads the Signet contracts of every supported network on a schedule and stores what it reads in a SQL database.
- O4 The stored history has no gaps: every event the signer and the responder emitted from the network's configured starting block up to the block the backend reports as processed is in the database, and a restart or a failed read loses none.
- O5 The data of one network can be wiped and indexed again, as after a test network reset, without touching the data of any other network.
- O6 Each row of the explorer's request list is served from one row of a SQL view that holds everything the row shows.
- O7 The repository is a yarn workspaces monorepo with the packages `ui`, `backend`, `lib` and `api`, where `api` holds both the client the UI calls and the adaptors the backend hosts.

## Design

### Shape

- `packages/ui`: the app of today. It reads lifecycles through the `api` client. It keeps the
  checks it runs itself (signature check, attestation check, EVM transaction status, MPC output
  cache), which need no Midnight node or indexer.
- `packages/backend`: one Node process. Per configured network it runs one ingest loop, and it
  serves the HTTP API. PostgreSQL is its store.
- `packages/api`: the contract. Request and response schemas, a fetch client for the UI, and the
  route adaptors the backend mounts on its HTTP server over a service interface.
- `packages/lib`: code with two real consumers (browser and Node): the network id set, contract
  address parsing, the stored event and lifecycle types. It never reads `import.meta.env`.

### Ingest: a cursor that moves only with complete data

Per network, the loop is:

1. Read the source's finalised tip (height and hash).
2. Check identity: the genesis hash equals the stored one, and the source's block hash at the
   cursor height equals the stored cursor hash. A mismatch stops the network's loop and marks it
   unhealthy.
3. Choose `target = min(tip, cursor + maxRange)`. Read every event both contracts emitted in
   `(cursor, target]`, the raw transaction of each, and inspect it for the request record.
4. In ONE SQL transaction: insert the events and transactions, upsert the request rows, and move
   the cursor to `(target, hash at target)` on the condition that it still holds the old value.
5. Any failure commits nothing. The loop retries with backoff from the same cursor.

The cursor is the per-network processed block: one row that says every event up to block N is
stored, with that block's hash (D06).

The source is a port. Its one adaptor reads the Midnight indexer's GraphQL at Blockfrost through
the SDK's `signetEventSourceFromIndexer`, with the project token from the server's environment.
The poll interval and `maxRange` are configuration values. The indexer adaptor is the one built (D08).

### Store: one PostgreSQL schema per network

Each network has its own schema (`preprod.events`, `preview.events`) with identical tables,
made by the same migrations. A wipe is `DROP SCHEMA <network> CASCADE` and a re-run of the
migrations.

- `ingest_state` (one row): genesis hash, signer address, responder address, starting block,
  cursor height, cursor hash, last success time, last error.
- `transactions`: hash, block height, block hash, block time, raw bytes, inspection (call chains
  and the request record) as JSON.
- `events`: sequence in emission order, transaction hash, contract role, name, request id (null
  when undecodable), payload bytes, decoded record as JSON, decode status.
- `requests` (maintained by the ingest transaction, one row per declared request id): request id,
  first event sequence, caller, first request time, first signature time, first response time,
  counts per event kind.
- `lifecycle` (a view): a `requests` row joined to its events and their transactions as JSON.
  This is the row the API returns.

### Deployment

A Dockerfile builds the backend image. The image runs the migrations at start, reads its
configuration from the environment, serves a liveness and a readiness endpoint, stops cleanly on
SIGTERM, and answers CORS for a configured list of origins (D09, D14). The UI stays a static
build on GitHub Pages and takes the backend's URL as a build variable.

A wipe of one network is an operator's command of the backend. The backend never wipes on its
own: on an identity mismatch it stops that network and reports it unhealthy (D12).

### UI

The request list is paged, searched and filtered by the backend. The configuration popover shows
the network's addresses, starting block and source URL read only (D11), and keeps as editable
only what the browser still uses itself: the MPC root public key, the EVM RPC URLs and the MPC
output cache URL (D10). The starting block control and the indexer services are removed. The
browser no longer loads the ledger WebAssembly (D07).

### API

Read-only HTTP JSON: the networks with their sync state (cursor, tip, lag, last error), a page of
lifecycles (newest first, keyset paged, search fragment, excluded callers, match count), one
lifecycle by request id, the distinct callers, and each network's configuration for display
(addresses, starting block, source URL without its query string: D11, D13).

## Out of scope

- Solana: its route stays the placeholder it is.
- Moving EVM transaction status, EVM tracing and the MPC output cache behind the backend (D10).
- Kubernetes manifests and any GitHub Actions workflow for the backend (D09, D14). The Pages build needs the backend's public URL as a build variable, which is a workflow change for the workstation.
- A node adaptor for the ingest source (D08).
- Push from backend to browser (websocket, server-sent events): the UI polls.
- Changes to `.github/workflows/**`: this machine's tokens cannot push them. What the workflows
  need is listed in the closing report of the build.

## Assumptions

What the design rests on. Each line ends with [run <commit>], [read <commit>] or [unverified],
and an unverified one names the gate of the first stage that tests it.

- A1 The explorer reads Midnight data in three places, all against the indexer: events through the SDK's `contractEvents` query (`src/lib/midnight/signet-event-store.ts:267`, `node_modules/@sig-net/midnight/dist/signet-contract-events.js:108`), the tip through `{ block { height } }` (`src/lib/midnight/indexer-block-height.ts:1`), and a raw transaction by hash (`src/lib/midnight/sign-bidirectional-transaction-loader.ts:9`). It never calls the node. [read 942e473]
- A2 The preprod indexer and node at Blockfrost answer with a project token and refuse without one: the indexer answered 403 keyless, `indexer.preprod.midnight.network` answered 410, and with the token the indexer served its tip and the node served `chain_getFinalizedHead`, `chain_getBlockHash`, `chain_getHeader` and listed `archive_v1_*`. [run 942e473]
- A3 On 2026-11-16 preprod held 5,033 signer events and 10,103 responder events between blocks 3,389,203 and 3,441,654 (52,451 blocks, about 3.6 days): about 1,400 requests and 4,200 events a day, so about 500,000 requests and 1.5 million events a year at that rate. One sample of one network. [run 942e473]
- A4 Reading that whole history through the indexer took 9.3 s for the signer and 26.8 s for the responder, 153 pages of 100. The indexer's event id ascended across every page. [run 942e473]
- A5 At 4.5 million events and 1.5 million requests in PostgreSQL 17, a plain view that groups events by request id took 1.4 s for the newest 50 and 3.1 s with a caller exclusion. A maintained `requests` table with a lateral join to the events took 0.8 ms and 0.2 ms, a fragment search over request id or caller with trigram indexes 3.9 ms, a count 31 ms. Synthetic rows, one run, on this dev box. [run 942e473]
- A6 The MPC indexer reads a node alone over HTTP JSON-RPC, walks finalised blocks one at a time by number, and leaves the checkpoint to a consumer that saves it after it has consumed the block's events. With no checkpoint it starts at the current finalised head. It extracts events by decoding `Midnight.send_mn_transaction` extrinsics and replaying each call's transcripts in the ledger VM. (`chain-signatures/chain-midnight/src/indexer.rs:647-732`, `rpc.rs:457-539`, `emissions.rs:80-192` at mpc 73bb9dfe, read by a subagent.) [read 942e473]
- A7 The indexer never adds an event to a block at or below the tip it has reported. [unverified] Gate of stage 1: index a range, re-read it an hour later and compare. A difference means the indexer adaptor must trail the tip by a margin, or that the node adaptor is the only safe one.
- A8 The indexer's tip is a finalised block, so no block at or below it is replaced. [unverified] Gate of stage 1: compare the indexer's tip hash with the node's hash at that height over a run of polls. (One sample on 2026-11-16: the indexer's tip hash equalled the node's finalised head.)
- A9 `@midnightntwrk/ledger-v9` in Node can replay a transcript and yield its log emissions, which the node adaptor needs. [unverified] Gate of stage 1 if Q1 chooses the node: decode one known block and compare its events with the indexer's.
- A10 The upstream's request quota covers the ingest. A block by block walk of a node costs at least 3 calls a block, 43,200 a day per network at 6 s blocks. Polling the indexer every 12 s costs 3 calls a poll, 21,600 a day. [unverified] Depends on Q1.

## Open questions

One line each: `- Q1 [answered] <the question>`, then `[answered] <the answer>` in place of `[open]`. Answer: Blockfrost's existing indexer, with the token on the server (D08). The plan and its quota are not known: A10 stays a gate.

- Q1 [answered] What will the production backend read Midnight from: Blockfrost's indexer and node with a token kept on the server (which plan, what quota), a node sig-net runs, or a node and an indexer sig-net runs? Answer: Blockfrost's existing indexer, with the token on the server (D08). The plan and its quota are not known: A10 stays a gate.
- Q2 [answered] Where do the backend and its PostgreSQL run, and does the UI stay on GitHub Pages calling the backend across origins, or is it served from the same place? Answer: Kubernetes on Google Cloud, a Docker image for the backend, no GitHub Actions yet, the UI on GitHub Pages with CORS on the backend (D09).
- Q3 [answered] Do EVM transaction status, EVM tracing and the MPC output cache stay in the browser as today (recommended), or move behind the backend too? Answer: They stay in the browser (D10).
- Q4 [answered] The signer and responder addresses, the source URL and the starting block become server configuration, so the configuration popover loses those fields and the starting block control goes. A developer on a local `undeployed` stack runs the backend locally. Is that acceptable? Answer: Yes, and the UI still shows them read only (D11).
- Q5 [answered] When the backend finds that a network's genesis hash or contract addresses differ from what its schema was indexed for: stop that network and wait for an operator's wipe command (recommended), or wipe and index again on its own? Answer: Stop and wait for the operator (D12).
- Q6 [answered] The row of the request list: is it assembled when read, by a SQL view that joins the maintained `requests` table to the `events` table (recommended, measured at 0.8 ms for 50 rows), or stored whole, with the events of the request copied as JSON into the `requests` row and rewritten on every new event? Answer: assembled when read, by the view (D15).
