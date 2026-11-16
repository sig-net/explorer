# Pack: contract

Read this when your step builds on, changes or reviews the two contracts stage 03 wrote: the api package and the database schema of `packages/backend`.

## As built

- zod is 4.6.7 and hono 4.13.18 in `node_modules`. [run 8823894]
- In the api package `z.enum(MidnightNetwork)` and `z.iso.datetime()` typecheck. [unverified]
- `@sig-net/explorer-lib` exports `parseContractAddressHex` and `isMidnightNetwork`. `StoredSignetEventNamed` is private to lib: reach it as `SignBidirectionalLifecycle['signBidirectionalEvents'][number]`. [read 8823894]
- `packages/api/src/index.ts` exports `client.ts`, `routes.ts`, `service.ts` and `wire.ts`. `explorerApiRoutes` carries the `/v1` prefix itself, so the backend mounts it at `/` and the client's base URL is given without `/v1`. The routes rethrow an error that is not an `ExplorerApiError`: the backend owns the 500 answer. `resolveLifecyclesQuery` in `wire.ts` holds the query rules (default limit, canonical callers, search fragment) for every `ExplorerService`. [read 8823894]
- The domain inspection of the api package (`SignBidirectionalInspection` in `service.ts`) is `{ callChains, request, requestCell }` or `{ failed }`: the cell stays beside the decoded record so that `lifecycleToWire` emits it unchanged (D35). [read 8823894]
- The SDK's `redactUrlQuery` keeps the names of the query string and writes `REDACTED` for each value. D13 is served by the api package, which cuts the source URL for the wire. [unverified]
- In a network's schema, hashes, addresses, payloads and raw transactions are `bytea` (Kysely gives `Buffer`). `events.request_id`, `requests.request_id` and `request_callers.caller` are lower case hex `text`, which the trigram indexes search. [read 68ece48]
- pg returns `bigint` as a string, so every pool is opened with `openDatabase(connectionString)` of `packages/backend/src/db/database.ts`, which reads it as a number. A query reaches a table only through `networkDb`. `packages/backend/src/db/migrate.ts` holds `migrateNetworkSchema` and `wipeNetworkSchema`, and creates `pg_trgm` itself under an advisory lock. [unverified]
- `@sig-net/explorer-api/testing` exports `explorerSeed` (events, and wire inspections by event id). Its fixture gives each event a transaction of its own. `createInMemoryMidnightSource(genesisHash, blocks)` of the backend has `appendBlock`, `replaceBlock` and `failNextCall(error)`. [unverified]
- A query built with Kysely on `networkDb` is qualified with the network's schema. A raw `sql` fragment inside it is not, and fails with `relation "events" does not exist`: qualify it by hand. [unverified]
- A scratch script outside the repository imports the backend's sources by absolute path, and reaches kysely with `createRequire('<repository>/packages/backend/src/db/')('kysely')`. [unverified]
- A filed report holds at most 6000 bytes. In a review's report the `covered:` lines sit under SUMMARY, since every line of FINDINGS must start with a mark. [unverified]
- On freshly inserted rows the planner costs a GIN trigram index fairly only after `VACUUM (ANALYZE)`, plain `ANALYZE` leaves it dearer than a sequential scan. A database just backfilled searches callers by sequential scan until autovacuum has run. [unverified]
- At 20,000 rows an `EXPLAIN` test avoids `Seq Scan on requests` only when the predicate matches well under 100 rows. Synthetic hex made with `lpad` and one repeated character defeats a trigram index: build it with `md5`. [unverified]
- The `lifecycle` view is `requests.*` plus `events`, so a column change of `requests` reaches it with no edit. The view exposes no callers: a service reads them from `request_callers (request_id, caller)` (D36), with `EXISTS` for a fragment search and `NOT EXISTS` for an exclusion. [unverified]
- `LifecyclePage.matchingEvents` counts the events of the matching lifecycles (D37). The sum of a lifecycle's three event arrays is written in `packages/api/src/testing.ts` and as `signBidirectionalLifecycleEventCount` in `packages/ui/src/lib/midnight/sign-bidirectional-lifecycle.ts`: its one home would be `packages/lib`. [unverified]
- `urlWithoutCredentials` of `packages/api/src/wire.ts` cuts the source URL for the wire: query string, fragment, user and password (D13, D39). The wire schema refuses a URL that still carries one. [unverified]
- `ingest_state.state` has the CHECK `ingest_state_state_known`, which admits the values of `EXPLORER_SYNC_STATES`. A test keeps the two lists equal. [unverified]
- oxlint's `require-array-sort-compare` refuses `toSorted()` with no compare function. `yarn typecheck` covers test files. `ExplorerSeedNetwork` of the api package's testing entry is wider than `ExplorerNetwork`. [unverified]
- A search over request id or caller written as one predicate (`request_id LIKE x OR EXISTS (caller LIKE x)`) uses neither trigram index. The form `request_id IN (SELECT request_id FROM requests WHERE request_id LIKE x UNION SELECT request_id FROM request_callers WHERE caller LIKE x)` uses both. A `LIKE` pattern escapes `\`, `%` and `_`, since the search may hold any character. [unverified]
- `with_postgres` removes its container when the shell that called it exits: a step that works over several commands starts a container of its own. [unverified]
- After 300,000 rows were inserted in one statement into a table with a `gin_trgm_ops` index, autovacuum ran 60 s later with no setting changed and a fragment search then planned a `Bitmap Index Scan` on it (D44). [run 68ece48]
- A stage check calls `as_stage_check` of `agent-work/lib/checks.sh` and then runs the step checks, which then share its PostgreSQL, its repository checks and one test run per workspace. [run 68ece48]
