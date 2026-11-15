# Pack: backend conventions

The reference is `~/Projects/github.com/sig-net/full-stack-demo-rebuild` (called "the demo"
below). Follow its patterns where this pack says so. It is a Next.js app, so its hosting does not
transfer, and it has Kafka and an outbox, which this task does not use (decision D13).

Every `[read]` below was read in the demo during planning. Read the named file before you copy a
pattern from it: the demo is the definition, this pack is the pointer.

## Database

| Pattern | Demo file | Notes for this task |
| --- | --- | --- |
| Drizzle over `pg`, one pool, one `drizzle({ client: pool })` | `src/lib/db/database.ts` | Same. `DatabaseExecutor` is the database or an open transaction |
| Transactions through `UnitOfWork.runInTransaction`, carried on `AsyncLocalStorage` so every repository call on the chain joins | `src/lib/db/unit-of-work.ts` | Same. The ingester's range write is one `runInTransaction` |
| The whole schema in one file | `src/lib/db/schema.ts` | Same, `packages/backend/src/db/schema.ts` or as stage 03 places it |
| Exactly one migration, regenerated from the whole schema | `package.json` `db:generate`: `rm -rf drizzle && drizzle-kit generate --name schema` then SQL the kit cannot derive is appended | Same. The `pg_trgm` extension and trigram indexes are the appended SQL here, if the kit cannot express them |
| Migration applied by a script that imports production dependencies only | `scripts/migrate.ts` | Same |
| `drizzle.config.ts` loads `.env.local` itself and requires `DB_CONNECTION_STRING` | `drizzle.config.ts` | Same |
| Local stack scripts | `package.json`: `stack:up` (`docker compose --env-file .env.local up -d --wait`), `stack:down` (`down --volumes`), `stack:restart` (down, up, `db:migrate`) | Same names |
| Postgres service | `compose.yaml`: `postgres:18`, bound to `127.0.0.1`, volume at `/var/lib/postgresql`, `pg_isready` healthcheck, bounded logs | Same, on a host port other than 5432, with this task's own compose project name, user and database |

Versions the demo uses, as a starting point: `drizzle-orm ^0.45.3`, `drizzle-kit ^0.31.11`,
`pg ^8.23.1`, `zod ^4.6.5`, `pino ^10.3.1`. `[read]` the demo's `package.json`. Yarn holds back
packages published in the last 24 hours (`.yarnrc.yml`), so the newest release may not install.

## Repositories

`[read]` the demo's engineering rules ("Repositories") and `src/lib/repository/repository.ts`:

- A repository is a typed database driver and nothing more: no application logic, no naming, no
  authorisation. It runs on the transaction open on its call chain.
- Row mappers convert values (bytea, numeric, enum text) and never rename, derive or default.
- Nothing above a repository inspects a database error.
- An in-memory implementation exists for flow tests (`repository-memory-impl.ts`).

Difference here (decision D14): the demo's generic `Repository<Resource extends { name: string }>`
is keyed by a `name` string. This task's resources have natural chain keys, so each repository is
its own small interface over its own key, with only the methods its consumers call. Keep the
demo's discipline, not its generic type.

File pattern per resource, as in the demo: `<resource>.ts`, `<resource>-repository.ts`,
`<resource>-repository-sql-impl.ts`, and where a flow test needs it
`<resource>-repository-memory-impl.ts`.

## Read models

The demo's rule is that a read model is a Postgres view. This task deliberately does NOT follow
it for the request list (decision D03): the list is an aggregate table the ingester writes.

## Configuration

`[read]` the demo's `src/lib/config/server-config.ts` and siblings: environment variables are
parsed once with zod into an immutable object, server-only values are kept apart from anything a
browser sees, and an invalid value stops the start with an error naming the variable.
`agent-work/architecture.md` section 10 lists this task's variables.

## Logging

`[read]` the demo's `src/lib/logging/logger.ts` and `logger-pino-impl.ts`: a `Logger` interface
(`debug`, `info`, `warn`, `error`, `child`) with a pino implementation. The message is a constant
lower-case fact and identities go in fields. A secret or a URL with a key never reaches a field.
A `recording-logger.ts` in `src/lib/testing` serves tests.

## Tests

- Unit tests: Vitest, Node environment, beside the code as `*.test.ts`.
- Integration tests against the compose Postgres: the demo keeps them in `integration-tests/`
  with their own Vitest config, `fileParallelism: false` because the files share one database,
  and a setup file that loads `.env.local`. `[read]` `vitest.integration.config.ts`,
  `integration-tests/setup.ts`. Each test file deletes its own rows.
- `yarn check` must not need Docker. Integration tests are a separate script.

## Composition

`[read]` the demo's `src/server/backend.ts` is the composition root: it builds every
implementation and wires them. This task's backend has one too. Nothing else calls `new` on an
implementation.

## What does not transfer from the demo

`'server-only'` imports (a Next.js guard), server actions, `next.config.ts`, the caller and login
credential model (the explorer's API is public and read-only), Kafka, the outbox, the vault
resources.
