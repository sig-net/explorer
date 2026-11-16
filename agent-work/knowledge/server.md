# Pack: server

Read this when your step composes the backend's parts into its process, or builds on that composition.

## The parts, as stage 4 exported them

- `parseBackendEnv(env)` returns a frozen `BackendConfig { databaseUrl, port, corsOrigins, networks }`, and each `BackendNetworkConfig` holds `network`, `config` (an `ExplorerNetworkConfig`: both addresses, `startBlock`, `sourceUrl` with its token), `pollIntervalSeconds`, `tipMargin` and `maxRange` (`packages/backend/src/config/backend-env.ts:11-80`). `portSchema` refuses 0 (`:127-130`), and one test compares the whole configuration with `toEqual` (`backend-env.test.ts:57`). [read c9d0e97]
- `openDatabase(connectionString)` opens the pool (`packages/backend/src/db/database.ts:13`). `migrateNetworkSchema(db, network)` and `wipeNetworkSchema(db, network)` are in `packages/backend/src/db/migrate.ts:14` and `:51`, each under a session advisory lock named after the schema (`:88-101`). `networkSchemaName(network)` is in `packages/backend/src/db/schema.ts:30`. [read c9d0e97]
- `createIndexerSource({ queryUrl, signerContractAddress, responderContractAddress })` is the one production `MidnightSource` (`packages/backend/src/source/indexer/indexer-source.ts:17-37`). [read c9d0e97]
- `inspectTransactionForStorage(rawTransactionHex, notifications)` (`packages/backend/src/inspection/sign-bidirectional-transaction-inspection.ts:27`) is the production `InspectTransaction` (`packages/backend/src/ingest/ingest-cycle.ts:62`), and loads the ledger WebAssembly. [read c9d0e97]
- `startIngestLoop(deps, settings, { pollIntervalMs, signal, onOutcome, sleep })` (`packages/backend/src/ingest/ingest-loop.ts:13-49`) resolves once the cycle in flight has returned after the signal aborts. A cycle takes no signal. After the n-th failure in a row it waits 60, 120, 240, then 300 s at the default interval (`:66-77`). [read c9d0e97]
- `runIngestCycle` cuts an error through `recordedErrorText` before the outcome leaves it (`packages/backend/src/ingest/ingest-cycle.ts:33-49`), so a URL in a source's error never reaches `onOutcome` whole. [read c9d0e97]
- `createPostgresExplorerService(db, networks)` takes each network as `{ network, config }` (`packages/backend/src/service/postgres-explorer-service.ts:30`, `:83`) and answers `starting` for a schema with no state row (`:97-106`). [read c9d0e97]
- `createHttpApp({ service, corsOrigins, ready, logError })` returns a Hono app (`packages/backend/src/http/http-app.ts:16`, `:49-56`). `ready` is synchronous. Nothing in `packages/backend/src` calls `serve` of `@hono/node-server` yet. [run c9d0e97]
- `createExplorerApiClient({ baseUrl })` of `@sig-net/explorer-api` takes the base URL without `/v1` (`packages/api/src/client.ts:29`, `:103`). [read c9d0e97]

## For tests of the composition

- `createTestDatabase()` returns `{ db, drop }` and keeps the URL of the database it made to itself (`packages/backend/src/db/testing.ts:11-51`). [read c9d0e97]
- The fixture events that `at(height, event)` of `packages/backend/src/ingest/testing.ts` places come from `@sig-net/explorer-lib/testing` (`notificationEvent`, `responseEvent`, `indexedSignetContractEvent`): `packages/backend/src/ingest/ingest-cycle.test.ts:1-60` shows a chain built and cycled. [read c9d0e97]
- `createInMemoryMidnightSource(genesisHash, blocks)` (`packages/backend/src/source/in-memory.ts:24`) gives `appendBlock`, `replaceBlock` and `failNextCall`. Two sources with different genesis hashes over one schema give the `stopped` outcome of D12. [unverified]
- Vitest's default timeout of a test is 5 s and the backend's `vitest.config.ts` sets none. A Node `http.Server` keeps `close()` waiting on keep-alive connections until `closeAllConnections()` is called. [unverified]
