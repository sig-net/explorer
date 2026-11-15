# Pack: the Midnight indexer

The backend's only source of Midnight data (decision D01). Stage 01 tests what is marked
`[unverified]` here, and the orchestrator updates this pack with the results.

## Reaching it

- Preprod through Blockfrost, every request carrying the project id in the query string:
  - query: `https://midnight-preprod.blockfrost.io/api/v0?project_id=<id>`
  - websocket: `wss://midnight-preprod.blockfrost.io/api/v0/ws?project_id=<id>`
  - node RPC: `https://rpc.midnight-preprod.blockfrost.io?project_id=<id>`
  `[read]` `README.md` "Preprod and Blockfrost". `[run]` the query URL answered in planning.
- A project id works on its own network only. `[read]` `README.md`.
- The id is a secret in practice: it is in the URL. Never print, log or return a URL. Scrub with
  `redact`, or replace `project_id=[^&\s"']+` before printing.
- `[run]` One response carried no rate-limit header. `[unverified]` the real limits and quota.
- A local `undeployed` stack serves its own indexer at `http://127.0.0.1:8088` and node at
  `127.0.0.1:9944`. `[read]` the demo's `.env.local.example`. None runs on this machine.

## The GraphQL schema (indexer v4)

`[run]` Introspected against preprod in planning (`__type` queries). Relevant parts:

```
Query
  block(offset: BlockOffset): Block                 # no offset: the latest block
  transactions(offset: TransactionOffset): [Transaction]
  contract(address: HexEncoded, offset: BlockOffset)
  contractAction(address: HexEncoded, offset: ContractActionOffset)
  contractEvents(filter: ContractEventFilter, limit: Int, offset: Int)

BlockOffset          { hash: HexEncoded, height: Int }
TransactionOffset    { hash: HexEncoded, identifier: HexEncoded }
ContractEventFilter  { contractAddress, types, fieldPrefixes, fromBlock: Int, toBlock: Int,
                       transactionHash: HexEncoded }
Block                { hash, height, protocolVersion, timestamp, author, parent, transactions, ... }
Transaction          { id, hash, protocolVersion, raw, block, contractActions, ... }

Subscription
  blocks(offset: BlockOffset)
  contractEvents(filter: ContractEventFilter, id: Int)
```

- `{ block { height hash timestamp } }` returns the latest block. `[run]` `timestamp` is a number
  of milliseconds.
- A contract event row has `id`, `maxId`, `transactionId`,
  `transaction { hash block { height hash timestamp } }`, and for a `MiscContractEvent` also
  `name` and `payload`. `[read]` the SDK query in
  `node_modules/@sig-net/midnight/dist/signet-contract-events.js` (`SIGNET_CONTRACT_EVENTS_QUERY`).
- Raw transaction: `transactions(offset: { hash: $hash }) { raw }`, first element.
  `[read]` `src/lib/midnight/sign-bidirectional-transaction-loader.ts`.
- Contract existence at a height: `contract(address, offset: { height })` answers from the
  deployment block on. `[read]` `README.md` and `src/lib/midnight/network.ts`. `[unverified]`
  what it returns below the deployment block (null or an error).

## How the SDK reads events

`[read]` `signetEventSourceFromIndexer` in the SDK file above:

- It is a paged query, NOT a subscription: `contractEvents(filter, limit: 100, offset)` with
  `filter = { contractAddress, fromBlock, toBlock }`, offset rising by 100.
- It pins the walk to the `maxId` of the first row and stops at the first row whose `id` exceeds
  it, so one walk is a point-in-time snapshot.
- It stops when a page has fewer than 100 rows.
- `fromBlock` and `toBlock` are documented as inclusive. `[read]` the `.d.ts`.
- It yields `IndexedSignetMiscEvent`, oldest first.
- The explorer's store additionally rejects an event outside the slice it asked for.
  `[read]` `src/lib/midnight/signet-event-store.ts` (`#readSlice`).
- `[run]` The SDK imports and runs in plain Node 26 (`import()` of `dist/index.js`, 96 exports).

The backend may use `signetEventSourceFromIndexer` or issue the same query itself. It needs the
`id` of every row, the page boundaries and the block hash, so issuing the query itself is likely
simpler than wrapping the stream. Stage 04 decides, after stage 01.

## What was observed, once

`[run]` One query in planning: signer contract, a range of 590 blocks ending 10 below the head,
`limit: 100`, `offset: 0`. It returned 60 rows, ids strictly ascending, every height inside the
range, `maxId` above the last id.

One sample proves nothing about the general case.

## Open questions (stage 01, step 01.2)

1. Is `contractEvents` ordered by ascending `id` always, including across pages?
2. Are `fromBlock` and `toBlock` inclusive at both ends?
3. Is an offset walk of a closed range stable while the chain advances?
4. When the indexer reports height H, are all events of every block at or below H already
   served? Or can a block appear before its events?
5. Is the latest block the indexer reports final? Can a block at or below it be replaced?
6. Does `block(offset: { height })` give the hash of any past height, cheaply?
7. Is `id` contiguous per contract, or only ascending? Is there any count to cross-check against?
8. What is the largest `limit` the indexer honours? What are the rate limits in practice?
9. Does `transactions(offset: { hash })` return the raw bytes for an old transaction?
10. What does `contract(address, offset: { height })` return below the deployment block?
