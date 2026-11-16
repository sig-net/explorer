# Pack: backend

Read this when your step writes or tests code of `packages/backend` or `packages/api`. The choices here are rows D16 to D25 of `../decisions.md`.

## Stack

- Hono is the HTTP framework (a small router whose app answers a standard `Request` with a `Response`, so tests call `app.request(...)` with no socket). `@hono/node-server` serves it. [unverified]
- Kysely with `pg` is the SQL layer: a typed query builder, with raw SQL through its `sql` tag for the view and the migrations. [unverified]
- zod validates everything that enters: the environment, query strings, the indexer's JSON, the wire. [unverified]
- Node runs the TypeScript sources directly, in development, in tests (Vitest, `node` environment) and in the image. There is no build step and no bundle for the backend. [run 4234222]

## PostgreSQL

- Each network has a schema named `midnight_<network id>` (`midnight_preprod`), with identical tables (D04, D18). [read 4234222]
- Tests run against a real PostgreSQL 17 named by `EXPLORER_TEST_DATABASE_URL`. A test file makes a database of its own inside it and drops it at the end. A database test with the variable unset fails: it never skips. [read 4234222]
- `source agent-work/lib/checks.sh; with_postgres` starts one and exports the variable, as the exit checks do. [run 4234222]
- Measured at 4.5 million events and 1.5 million requests: the newest 50 `requests` rows by `first_event_id DESC` with a lateral `jsonb_agg` over `events (request_id, id)` took 0.8 ms, a `LIKE '%fragment%'` over request id or caller with `gin_trgm_ops` indexes 3.9 ms, a count of `requests` 31 ms. A view that groups `events` took 1.4 s. The script is in `../architecture.md` under A5. [run 4234222]

## Conventions

- Bytes are stored as `bytea` and cross the wire as lower case hex without `0x`. Integers that may pass 2^53 (amounts, gas, nonces) cross the wire as decimal strings. Times are ISO 8601 in UTC. [read 4234222]
- The indexer's event `id` is the primary key of `events`: it is unique across contracts and ascends in emission order (see the indexer pack). [run 4234222]
- No log line and no API response carries a URL's query string (D13). [read 4234222]
