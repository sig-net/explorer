# Decisions

Append only. An agent that disagrees with an entry reports it and never acts against it.

`Decided by` is `user`, `planner` for how the thing is built, `planner (unconfirmed)` for what changes what the user gets until they have confirmed it, then `planner (confirmed)`, or `orchestrator` during execution.

| No. | Decision | Why | Decided by |
| --- | --- | --- | --- |
| D01 | The backend reads Midnight data from the token-gated indexer's GraphQL API (Blockfrost for preprod), with the token held server side. The source sits behind an interface. | It works today: 15,070 preprod events read in 42 s. Node-level indexing as in sig-net/mpc buys independence from the indexer that an explorer does not need. | user |
| D02 | The database is Postgres. | User's choice. The view and table timings were measured on Postgres 17. | user |
| D03 | Networks share one set of tables, with a `network` column leading every primary key and index. A wipe is a delete by network. | Tables per network multiply every query, migration and type. A delete by network took 1.3 s at a year of data. | user |
| D04 | The list page reads an aggregate table, `sign_bidirectional_lifecycle`, one row per request id. The indexer loop writes it in application code, in the transaction that stores the events. | Newest 50 rows at 500,000 lifecycles: 1.8 s from a view, 0.6 ms from the table. | user |
| D05 | The EVM transaction status and the MPC output cache are read by the browser, as today. | Both are public and need no token. The EVM status is a live view. | user |
| D06 | The signature and attestation checks run in the browser, as today. | Follows D05: the checks need the outputs the browser reads. | user |
| D07 | The configuration popover keeps its indexer, node, contract address and starting block fields as read-only information, filled from the backend. The fields D05 and D06 need (MPC root public key, EVM RPC URLs, MPC output cache URL) stay editable. | Those values are server configuration, and the user wants them visible. | user |
| D08 | No gaps: per network a cursor `next_block` that moves only inside the database transaction that stores a block range read up to the indexer's tip. Ranges are polled, not streamed. | The user proposed the block counter. A subscription never says a block is complete. | user |
| D09 | Repository layout: yarn workspaces `packages/ui`, `packages/backend`, `packages/api`, `packages/lib`. | User's brief. | user |
| D10 | The backend indexes each network's full history from its configured start block (the contracts' deployment block). The UI's starting block control and step-back are removed, and the list is paged. | The history fits: 15,070 events in 42 s. A window would leave old requests unreachable by link. | planner (unconfirmed) |
| D11 | A reset is detected by a changed genesis hash, a tip below the cursor, or a changed contract address in the configuration. The backend then deletes that network's rows and starts again, without asking anyone. | Test networks reset without notice, and stale rows would be shown as current. | planner (unconfirmed) |
| D12 | The raw transaction is not stored. The backend stores what the inspection derives from it: the call chains and the request record. | 12.6 KB each, mostly proofs, about 6 GB a year. It can be fetched again by hash. | planner (unconfirmed) |
| D13 | The API is public and read-only: no login, no key, CORS open to any origin. | The data is public chain data, and the UI is a static site on another origin. | planner (unconfirmed) |
| D14 | The UI learns of new rows by polling the backend every few seconds. | Simpler than a push channel, and a block takes 6 s. | planner (unconfirmed) |
| D15 | A network is indexed only when the backend's configuration names its indexer URL and both contract addresses. Today that means preprod, and undeployed on a local stack. The UI lists the others as not indexed. | Preview and mainnet have no signet contracts yet. | planner (unconfirmed) |
| D16 | The API contract is zod schemas in `packages/api`, with a typed fetch client and a route adapter. Bytes travel as lowercase hex, bigints as decimal strings. | One definition for both sides. JSON carries neither bytes nor bigints. | planner |
| D17 | `packages/lib` receives only modules both the backend and the UI import. The transaction inspection and the ledger WebAssembly move to the backend alone. | The repository's rule: share at the second real consumer. | planner |
