# Pack: backend-patterns

Read this before writing a resource, a service, an adaptor, a repository or the database setup.
D13 says these follow `full-stack-demo`, branch `bernard/rebuild`. That branch is checked out on
this machine at `~/Projects/github.com/sig-net/full-stack-demo-rebuild` (commit 16f2eea). Every
path below is in THAT checkout. Read it, never edit it, and copy the shape, not the files.

## What the demo is, and what it is not

- The demo is ONE Next.js package with no workspaces, no Fastify, no HTTP client, no CORS and no health endpoint: its transport is Next server actions. The workspace layout, the Fastify host and the HTTP client of this task have no model there and are designed here. [read 6ee55f6]
- Every backend file of the demo starts with `import 'server-only'` and imports through the `@/` alias with no file extension. Neither runs under plain Node: this task uses relative imports ending in `.ts` and package names. [read 6ee55f6]
- Leave out everything about events and lifecycles: `src/lib/event/`, `src/lib/kafka/`, the `event_outbox_entries_v1` table, `outbox-notify.sql`, every `*-state-controller*`, `*-state-machine*` and `*-event-consumer*` file, and the loops in `src/server/backend.ts:492-560`. [read 6ee55f6]

## One resource, end to end

The model is `src/lib/midnight/ethereum-erc20-vault/approval-v1/`.

- Resource: `approval.ts:74-98`. One `z.object` schema, the type inferred from it, and the closed sets as `as const` arrays above it. The demo keys by a `name` string. This task keys by chain keys instead (D14). [read 6ee55f6]
- Service interface and args schemas: `approval-service.ts:23-75`. The interface first, then one zod schema per method's arguments, in the same file. This task's methods take no `caller`: nothing here is authenticated. [read 6ee55f6]
- Adaptor: `approval-service-adaptor.ts:31-60`. A class over the service. Each method takes `args: unknown`, runs `schema.safeParse`, answers `{ ok: false, error: z.prettifyError(error) }` on bad input and `{ ok: true, <field> }` otherwise. Not found is `ok: false`, never an exception. [read 6ee55f6]
- Repository interface: `src/lib/repository/repository.ts:6-39`. `create`, `get`, `update` and `search` with criteria, order, limit and lock. It is generic over a `name` key, so this task writes its own interfaces with the same vocabulary over its own keys. [read 6ee55f6]
- Drizzle repository: `src/lib/repository/repository-sql-impl.ts:15` and `repository-sql-read-impl.ts:16`. Every row read is parsed with the resource's zod schema (`:77`), and the executor is `currentTransaction() ?? database` (`:54`). [read 6ee55f6]
- Unit of work: `src/lib/db/unit-of-work.ts:11-50`. `runInTransaction(work)` keeps the open transaction in an `AsyncLocalStorage`. No signature carries a transaction, a nested call joins the open one, and a promise that is not awaited runs OUTSIDE it. [read 6ee55f6]
- Service implementation: `approval-service-impl.ts:49`. Dependencies come through the constructor. Reads go straight to the repository. Writes do the slow work first and open the transaction last. Services open transactions, adaptors never do, whatever the demo's own rules file says. [read 6ee55f6]

## Database

- Schema: one file, `src/lib/db/schema.ts`. Table names end in `_v1`. Column properties are camelCase, named exactly as the resource's fields, each with an explicit snake_case SQL name (`:261-275`). Closed sets are `text(name, { enum: SET })`. [read 6ee55f6]
- Custom column types to copy: `bytea` as `Uint8Array` (`schema.ts:513-517`) and a wide integer as `bigint` (`:509-511`). [read 6ee55f6]
- Pool and database: `src/lib/db/database.ts:7-13`, `new Pool({ connectionString })` and `drizzle({ client: pool })`. `DatabaseExecutor` (`:19`) is the type a repository runs on: the database or a transaction. [read 6ee55f6]
- One migration, regenerated: the script `db:generate` (`package.json:20`) deletes `drizzle/` and runs `drizzle-kit generate --name schema`, which writes `drizzle/0000_schema.sql`. `db:migrate` applies it locally, `scripts/migrate.ts` (drizzle-orm's migrator, run by plain `node`) applies it in production. [read 6ee55f6]
- drizzle-kit loads the schema file through a CommonJS loader: a module the schema imports must not import an ESM-only package such as the SDK. Keep closed sets the schema needs in files with no SDK import. [read 6ee55f6]
- The demo does nothing about a schema mismatch at start-up. This task's refusal to start (architecture, section 9) has no model there. [read 6ee55f6]

## Configuration, composition, logging

- Configuration: `src/lib/config/server-config.ts:55-105`. One zod schema over `process.env`, `safeParse`, an error built with `z.prettifyError` that names variables and never values, then per-area functions that turn the parsed env into immutable objects. [read 6ee55f6]
- Composition root: `src/server/backend.ts:427`. One function builds everything in dependency order and hands each part `logger.child({ component })`. [read 6ee55f6]
- Logging: a small port (`src/lib/logging/logger.ts:5-77`) with a pino implementation (`logger-pino-impl.ts:54`). The repository's lint forbids `console`. [read 6ee55f6]

## Tests

- Unit tests are vitest, table-driven with `test.each`. Doubles: `mock<T>(name, methods)`, which throws on a call nobody scripted (`src/lib/testing/mock.ts:5`), an in-memory repository (`src/lib/repository/repository-memory-impl.ts:8`), and a unit of work that just runs the work (`approval-service-impl.test.ts:119`). [read 6ee55f6]
- Repository tests run against a real Postgres from Compose, not a fake: `integration-tests/repository-sql.test.ts`. The demo's Postgres is `postgres:18` on `127.0.0.1:5432` with its data under `/var/lib/postgresql` (`compose.yaml:12-29`). [read 6ee55f6]

## Versions the demo pins

- drizzle-orm 0.45.3, drizzle-kit 0.31.11, pg 8.23.1, @types/pg 8.23.1, zod 4.6.5, pino 10.3.1, pino-pretty 13.2.0, vitest 5.0.3, typescript 7.0.2. Start from these. fastify and @fastify/cors are not in the demo: take their newest releases older than a day. [read 6ee55f6]
