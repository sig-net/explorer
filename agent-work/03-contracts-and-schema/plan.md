# Stage 03: contracts and schema

## Delivers

The three things everything else is built against, so stage 04 can run its streams in parallel:

1. `packages/lib` holds the domain code that both the UI and the backend need.
2. `packages/api` holds the full contract: resources, services, adaptors, HTTP client, route
   table, and fake implementations over fixtures.
3. `packages/backend` holds the database: schema, the single migration, the local Postgres
   stack, the unit of work, and an integration test harness.

## Assumes

- Stage 02's packages and dependency-direction check exist.
- Stage 01 decided the shape of the trace output (gate G6) and the indexer facts.
- `architecture.md` sections 4 and 7 are the starting point for tables and services. This stage
  makes them exact and the orchestrator writes the result back into `architecture.md`.

## Shape

03.1 is first and alone: it fixes exact shapes, and both builders need them. Then 03.2 (lib and
api) and 03.3 (database) run in parallel. Both add dependencies, so each has its own worktree.
03.2 is itself a chain inside one agent (lib before api). A review closes the stage.

```
03.1 -> ( 03.2 | 03.3 ) -> 03.4 review
```

## Steps

### Step 03.1: fix the exact shapes

- **Stream / model:** `domain` / `fable`
- **Waits on:** nothing
- **Runs in:** main worktree, read only
- **Packs:** `signet-domain.md`, `ui-codebase.md`, `service-pattern.md`, `backend-conventions.md`,
  `midnight-indexer.md`
- **Scope:** none. The output is the report. The orchestrator writes it into `architecture.md`.
- **Context:** heavy
- **Goal:** Turn `architecture.md` sections 4 and 7 into exact field lists that the api builder
  and the schema builder can each implement without talking to the other.
- **Work:**
  1. Census what the UI renders and filters. Read
     `sign-bidirectional-lifecycle-table.tsx`, `explorer.tsx`, `signet-events-section.tsx`,
     `excluded-callers-filter.tsx`, `midnight-configuration.tsx`,
     `signet-event-record-details.tsx` and the verification hook. For every value shown in the
     LIST, name the aggregate column it comes from. For every value shown in the EXPANDED row,
     name the event field or service it comes from.
  2. Census what `lib` must hold: list each candidate module, its consumers after this task
     (browser, backend, tests) and whether it reaches any WebAssembly. Only modules with two
     real consumers move.
  3. Write, for each resource: field name, TypeScript type, wire type, column type, nullability.
     For each service method: args, result, errors.
  4. Decide the page token format, the search semantics (fragment match as today), the exact
     `state` set, and how the UI learns that a row it holds has changed.
  5. Flag every place where `architecture.md` is wrong or underspecified.
- **Exit check:** the report holds complete tables for six tables and four services, and every
  column of today's list maps to a field.
- **Report must include:** the tables, ready to paste into `architecture.md`.

The orchestrator updates `architecture.md` and commits before dispatching 03.2 and 03.3.

### Step 03.2: `lib` and `api`

- **Stream / model:** `domain` / `fable` (continue the 03.1 agent unless it reported `tight`)
- **Waits on:** 03.1
- **Runs in:** own worktree `bernard/03-lib-api`
- **Packs:** `signet-domain.md`, `ui-codebase.md`, `service-pattern.md`
- **Scope:** `packages/lib`, `packages/api`, and in `packages/ui` only the import paths of what
  moved
- **Context:** heavy
- **Goal:** The shared domain and the whole contract, with fakes good enough to build the UI on.
- **Work:**
  1. Move into `lib` exactly what 03.1 listed. Update the UI's imports. The mover pays: grep for
     every moved name.
  2. In `api`, for each of the four services: resource schema, service interface with args
     schemas, adaptor, HTTP implementation, fake implementation, as `service-pattern.md` lays out.
  3. The route table, exported once and used by the HTTP implementations.
  4. Fixtures for the fakes, built from the UI's existing `*.fixture.ts` files, enough to
     exercise: several pages, every `state`, a request with duplicate events, a response with no
     request, an undecodable event, two callers, and a network that is not configured.
  5. The fake of the Sign request service honours paging, search, excluded callers and state
     filters over its fixtures.
  6. Tests: every schema round-trips its fixture through JSON. Every adaptor rejects a malformed
     body with `{ ok: false }`. Each HTTP implementation is tested against its adaptor through an
     in-process `fetch` stand-in, so client and adaptor are proven to agree without a server.
  7. Remove the stage 02 proving constant and its two consumers.
  8. `yarn build` and check the `.wasm` set: `lib` and `api` must add nothing to the first load.
- **Exit check:** `yarn check` and `yarn build` pass at the root. The two `.wasm` files and no
  third. The dependency-direction check passes. The UI test count has not dropped.
- **Report must include:** the public exports of `lib` and `api`, as a list.

### Step 03.3: the database

- **Stream / model:** `data` / `opus`
- **Waits on:** 03.1
- **Runs in:** own worktree `bernard/03-database`
- **Packs:** `backend-conventions.md`, `checks-and-tooling.md`, `signet-domain.md`
- **Scope:** `packages/backend`, root `compose.yaml`, root scripts for the stack, `.gitignore`
- **Context:** heavy
- **Goal:** A database that comes up from nothing with one command and matches the fixed shapes.
- **Work:**
  1. `compose.yaml` at the root: Postgres only, following the demo's service, with this task's
     own project name, credentials and database, on host port 5433 unless it is taken
     (`ss -ltn`). Run `docker ps` first.
  2. Scripts: `stack:up`, `stack:down`, `stack:restart`, `db:generate`, `db:migrate`, as in the
     demo. `.env.local.example` naming every backend variable with a placeholder.
  3. `schema.ts` with the six tables exactly as `architecture.md` now lists them, text enums built
     from the constant arrays (take them from `api` if 03.2 has landed them, otherwise define
     them in `backend` and the orchestrator reconciles at merge).
  4. The single migration, regenerated. The `pg_trgm` extension and trigram indexes appended as
     SQL if the kit cannot express them.
  5. `database.ts`, `unit-of-work.ts`, the migrate script, the `Logger` interface with its pino
     implementation and a recording logger for tests.
  6. A schema fingerprint check: a function that compares the migration the backend ships with
     the one applied to the database and reports a mismatch (decision D07). Investigate whether
     Drizzle's own migrations table gives this before adding a table for it.
  7. An integration test harness: its own Vitest config, files run one at a time, a setup that
     loads `.env.local`, and one test per table that writes a row and reads it back, plus a
     unit-of-work test that a failed transaction leaves no row.
  8. `yarn check` must pass WITHOUT Docker. Integration tests are `yarn test:integration`.
- **Exit check:** from a state with no stack: `yarn stack:restart` succeeds,
  `yarn test:integration` passes, `yarn check` passes with the stack down. `\d` of each table in
  `psql` matches `architecture.md` (paste the output).
- **Report must include:** the host port chosen, and every backend dependency added with its
  version.

### Step 03.4: independent review

- **Stream / model:** `review` / `fable`, fresh
- **Waits on:** 03.2 and 03.3 merged
- **Runs in:** main worktree, read only
- **Packs:** `service-pattern.md`, `backend-conventions.md`, `signet-domain.md`
- **Scope:** none
- **Context:** heavy
- **Goal:** Find where the contract and the schema disagree with each other or with the design.
- **Work:**
  1. Compare every resource in `api` with its table: names, types, nullability, enum sets.
  2. Check the contract against `architecture.md` and `decisions.md`: no verdicts returned, no
     URL with a key returned, results as values, wire format.
  3. Look for a query the list needs that no index serves.
  4. Check `lib` moves against the "second consumer" rule and the WebAssembly rule.
  5. Run the stage exit check.
- **Exit check:** findings with file and line, or "none".
- **Report must include:** findings ranked by severity.

## Gates

| Gate | Question | Fallback |
| --- | --- | --- |
| G8 | Does the schema fingerprint come from Drizzle's migrations table, or does it need its own table? | Its own one-row table |
| G9 | Can `pg_trgm` be created in the migration with the local image and the credentials used? | Prefix search on `request_id` and `caller_address` with ordinary indexes, and the search semantics in the contract change to "starts with". That changes UI behaviour, so it is recorded as a decision and added to "To be tested" for the user's attention |

## Stage exit check

After both worktrees are merged and review findings fixed:

1. `yarn install --immutable && yarn check && yarn build`, with the stack DOWN.
2. The two `.wasm` files and no third.
3. `yarn stack:restart && yarn test:integration`.
4. Smoke against the dev server on preprod still passes: the UI still reads the indexer directly
   at this point, and must be unbroken.

## Checkpoint

Commit and push. Mark stage 03 `done`. Update `architecture.md` with anything the build changed.
Update `service-pattern.md` and `backend-conventions.md` with the real paths, the exports of
`lib` and `api`, the stack commands and the port. Check stage 04's `Assumes`.
