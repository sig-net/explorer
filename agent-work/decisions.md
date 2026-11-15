# Decisions

Append only. An agent that disagrees with an entry reports it and never acts against it.

`Decided by` is `user`, `planner (unconfirmed)` until the user has seen it, then `planner (confirmed)`, or `orchestrator` during execution.

| No. | Decision | Why | Decided by |
| --- | --- | --- | --- |
| D01 | The backend reads a Midnight indexer through Blockfrost. It does not read a node. | The SDK has an indexer reader in TypeScript. Reading a node means porting the MPC's Rust block decoding. The chain source is a seam so this can change. | user |
| D02 | Verification stays in the UI. The backend serves raw facts and never a verdict. | Clients trust our event data but check signatures and outputs themselves. | user |
| D03 | The list row is an aggregate TABLE written by the ingester, not a view and not database triggers. | Filtering, sorting and searching need real indexed columns. A grouping view recomputes over all history. The rules for grouping live in TypeScript already. | user |
| D04 | Rows are separated by a `network_id` column, not by a set of tables per network. | One schema, one set of queries. Resetting a network is a delete by key. | user |
| D05 | One deployment per network. A redeploy means resetting that network. History of a replaced deployment is not kept. | The explorer has only ever shown the SDK's current contracts. Keeping old deployments is a feature nobody asked for. | planner (confirmed) |
| D06 | No migrations. One regenerated schema migration. A schema change drops the database and re-indexes from each configured start block. | Everything stored can be read again from a chain. | user |
| D07 | The wipe is an explicit command. The backend refuses to start on a schema mismatch and never erases at start-up. | A server that erases its database at start-up is a hazard once deployed. | planner (confirmed) |
| D08 | Ingestion is strictly ascending from the start block, in whole block ranges, with a checkpoint advanced in the same transaction as the rows. | The no-gaps guarantee. After a wipe the list fills oldest first, and the UI shows indexing progress. | user |
| D09 | The UI's configuration popover is read-only and shows the selected network's configuration. Contract addresses can no longer be typed in. | The backend only indexes configured deployments. | user |
| D10 | The "Starting Block" control is removed. The list is paged. | The backend holds the whole history. | user |
| D11 | The `debug_traceTransaction` fallback goes through the backend. In development it uses `SEPOLIA_FORK_RPC_URL` from the shared test secrets. | A keyed RPC URL must not reach the browser. The UI still checks the attestation over the result. | user |
| D12 | Raw Midnight transactions and EVM trace outputs are read-through caches, fetched on first request, not at ingest. | Keeps ingestion to one concern. Both can be read again. | planner (confirmed) |
| D13 | Stack: Postgres, Drizzle over `pg`, zod, Fastify, pino. Patterns follow `full-stack-demo` branch `bernard/rebuild` (resource, repository, service, adaptor, unit of work). No Kafka, no outbox. | The user's reference. Nothing here publishes events. | user |
| D14 | Resources are keyed by their natural chain keys, not by the demo's `name` strings. | These rows mirror chain facts that already have keys. | planner (confirmed) |
| D15 | Monorepo with Yarn workspaces: `packages/ui`, `packages/backend`, `packages/api`, `packages/lib`. `api` is the contract (schemas, interfaces, client, adaptors). `lib` takes code only at its second consumer. | User's layout, tightened. | user |
| D16 | The UI stays on GitHub Pages. The backend allows its origin through CORS. Hosting of the backend is decided after this task. | User. | user |
| D17 | All four networks are supported in code. Built and tested against preprod. Undeployed, preview and mainnet are "to be tested". | No Blockfrost project ids or contracts for preview and mainnet, no local stack on this machine yet. | user |
| D18 | `full-stack-demo` is out of scope entirely, including its use of the explorer image. | User. | user |
| D19 | The UI stays live by polling. Search and filters live in the URL. | Simplest thing that works. The user raised no objection. | planner (confirmed) |
| D20 | Workflow files change only in stage 07. | A push that changes them may be refused, and every later commit would sit on top of it. | planner (confirmed) |
| D21 | The API never returns an indexer URL or an EVM RPC URL. It returns the indexer's host only. | Both carry keys. | planner (confirmed) |
| D22 | `agent-work/` is excluded from `oxfmt`. | The orchestrator edits it constantly and it must never fail a check. | planner (confirmed) |
