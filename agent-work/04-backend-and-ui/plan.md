# Stage 04: backend and UI, in parallel

## Delivers

Two things that do not yet meet:

- **Backend:** a process that indexes a network from a chain source into Postgres with the
  no-gaps guarantee, and serves the four services over HTTP. Proven against a fake chain source
  and a real database.
- **UI:** the app rebuilt on the `api` services, running against the fake implementations, with
  the direct indexer code gone.

Stage 05 joins them against preprod.

## Assumes

- `api` exports the four services with adaptors, HTTP and fake implementations, and the route
  table (stage 03).
- The schema, the unit of work, the logger and the integration harness exist (stage 03).
- Stage 01 fixed the indexer facts and the ingestion defaults.
- Every backend dependency was added in stage 03, except Fastify and its CORS plugin, which step
  04.4 adds. If another backend step needs a dependency, it reports `BLOCKED` and the
  orchestrator adds it between steps, so that parallel steps never edit a manifest at once.

## Shape

Two streams with no shared files: the UI stream changes only `packages/ui`, the backend streams
only `packages/backend`.

- The UI stream runs in its OWN worktree. It is long, and it must not see a half-built backend.
- The backend steps run in the MAIN worktree. 04.1, 04.2 and 04.4 touch different folders of
  `packages/backend` and run in parallel. Only 04.4 changes a manifest. 04.3 needs 04.1 and
  04.2. 04.5 wires everything and needs 04.3 and 04.4.

```
backend:  ( 04.1 | 04.2 | 04.4 ) -> 04.3 -> 04.5 -> 04.8 review
ui:         04.6 -> 04.7 ----------------------------^
```

The orchestrator commits backend steps one at a time as they are accepted.

## Steps

### Step 04.1: the chain source

- **Stream / model:** `ingest` / `fable`
- **Waits on:** nothing
- **Runs in:** main worktree
- **Packs:** `midnight-indexer.md`, `signet-domain.md`, `backend-conventions.md`
- **Scope:** `packages/backend/src/chain/` (or the folder name stage 03 established for it)
- **Context:** heavy
- **Goal:** `MidnightChainSource` (`architecture.md` section 6) with an indexer implementation
  that is complete or throws, and a fake for tests.
- **Work:**
  1. The interface, exactly as the architecture has it after stage 01's corrections.
  2. The indexer implementation. `eventsInRange` reads both contracts for the range, refuses
     anything outside the range, refuses ids that do not ascend strictly across pages, merges the
     two contracts, and assigns `block_position` by ascending id within each block. It applies
     whatever stage 01's gates G1 and G2 decided.
  3. `headBlock`, `blockAt`, `rawTransaction`, `contractExistsAt`.
  4. Errors never carry the URL. Log fields never carry the URL.
  5. Bounded retry with backoff for transient failures (network, 5xx, 429), and a typed error for
     a response that violates an invariant, which is never retried.
  6. A fake implementation driven by an in-memory chain that tests can script: add blocks, add
     events, replace a block, fail N times, serve a page out of order, serve an event outside the
     range.
  7. Tests against the fake for every refusal. One recorded-response test: capture a real paged
     read from preprod once into a fixture (scrubbed), and replay it through the implementation
     with a stand-in `fetch`.
  8. A small live test against preprod, excluded from `yarn check`, run by its own script.
- **Exit check:** `yarn check` passes. The live test reads a fixed historical range of preprod
  twice and gets identical events both times (quote the count).
- **Report must include:** which of the SDK's functions were reused and which queries were
  written here, and why.

### Step 04.2: repositories

- **Stream / model:** `data` / `opus`
- **Waits on:** nothing
- **Runs in:** main worktree
- **Packs:** `backend-conventions.md`, `signet-domain.md`
- **Scope:** `packages/backend/src/` repository files and their tests, and `integration-tests/`
- **Context:** heavy
- **Goal:** One typed driver per table, with only the methods the ingester and the services call.
- **Work:**
  1. Interfaces and SQL implementations for deployments, checkpoints, events, sign requests,
     Midnight transactions and Ethereum transaction outputs.
  2. Methods are decided by consumers, so read `architecture.md` sections 5, 7 and 9 and list
     each method with the caller that needs it before writing any. Expected: insert a batch of
     events and report conflicts, upsert a sign request, read sign requests by keyset page with
     search and filters, distinct callers, get one request with its events, read and write the
     checkpoint under a lock, delete everything of a network, events of a block range for the
     re-read comparison.
  3. Every method runs on the open transaction.
  4. The keyset page query uses the indexes of `architecture.md` section 4.4. Check each list
     query with `EXPLAIN` on a table loaded with at least 200,000 synthetic rows and quote the
     plans: no sequential scan for the default list, the caller filter or the state filter.
  5. In-memory implementations only where step 04.3's flow tests need them. Ask the orchestrator
     which, or implement the events, sign requests and checkpoint ones.
  6. Integration tests for every method against the compose Postgres.
- **Exit check:** `yarn check` passes with the stack down. `yarn test:integration` passes with it
  up. The `EXPLAIN` plans are in the report.
- **Report must include:** the method list with each method's consumer.

### Step 04.3: the ingester

- **Stream / model:** `ingest` / `fable` (continue the 04.1 agent only if it reported
  `comfortable`. Otherwise a fresh one: this is the step where lost detail costs most)
- **Waits on:** 04.1, 04.2
- **Runs in:** main worktree
- **Packs:** `signet-domain.md`, `midnight-indexer.md`, `backend-conventions.md`
- **Scope:** `packages/backend/src/` ingestion files and their tests
- **Context:** heavy
- **Goal:** The loop of `architecture.md` section 5, and the aggregate table kept exactly equal
  to what the events imply.
- **Work:**
  1. The projection first, as a pure function: given a request's current row (or none) and new
     events in emission order, return the new row. Port the rules from the UI's
     `aggregateSignBidirectionalLifecycles` and `signBidirectionalLifecycleDurationMs`. Test it
     against the UI's lifecycle fixtures, including duplicates, a response before a request, a
     response with no request, and events arriving across several ranges.
  2. A rebuild function: recompute every sign request row of a network from its events.
  3. The range write: one unit of work that inserts events, applies the projection and advances
     the checkpoint.
  4. The loop: head, safety margin, checkpoint hash check, ranges, trailing re-read, poll. Halts
     that set `state = halted` with a reason and stop that network only.
  5. Start-up for a network: write or compare the deployment row, refuse on a mismatch, check
     that neither contract exists below `start_block`, take the advisory lock.
  6. Tests with the fake chain source and a real database (integration) or in-memory
     repositories (unit), one per property:
     - a crash after the read and before the commit loses nothing and duplicates nothing,
     - a crash after the commit resumes at the next range,
     - a replay that would write a different row at an existing key halts,
     - a source that fails N times is retried, and one that keeps failing halts without advancing,
     - a replaced block at the checkpoint halts,
     - an event the indexer serves late inside an already-processed range is caught by the
       trailing re-read,
     - two ingesters for one network: exactly one writes,
     - after any sequence of ranges, the sign request table equals the rebuild (a property test
       over generated event sequences split into random ranges),
     - a network that halts does not stop another network.
  7. Structured log lines for each loop, range, halt and resume, with no URL in any field.
- **Exit check:** `yarn check` and `yarn test:integration` pass. The report lists each property
  above with the name of the test that proves it.
- **Report must include:** any property that could not be tested and why.

### Step 04.4: services, HTTP host and configuration

- **Stream / model:** `host` / `opus`
- **Waits on:** nothing
- **Runs in:** main worktree
- **Packs:** `service-pattern.md`, `backend-conventions.md`, `signet-domain.md`
- **Scope:** `packages/backend/src/` service, host and configuration files, and the backend
  manifest (Fastify and its CORS plugin)
- **Context:** heavy
- **Goal:** The four services implemented over repository INTERFACES, hosted on HTTP.
- **Work:**
  1. Configuration: parse the variables of `architecture.md` section 10 with zod into an
     immutable object. Per network, complete configuration or `not configured`. Preprod's
     defaults come from the SDK and the built-in start block. An error names the variable and
     never the value.
  2. Service implementations against the repository interfaces (the SQL implementations land in
     04.2: code against the interfaces and test with small in-memory stand-ins).
     - Network: configuration plus checkpoint, and the indexer's host only.
     - Sign request: list, get, callers.
     - Midnight transaction: read-through cache, only for a hash present in the events table.
     - Ethereum transaction output: read-through cache over the trace call, in the shape gate G6
       fixed, caching only a mined, successfully read trace.
  3. The host: Fastify, one route per entry of the `api` route table, each handing the body to
     the adaptor. CORS from `CORS_ALLOWED_ORIGINS`. A body size limit. `GET /healthz`. A 500
     carries no detail. Graceful shutdown.
  4. Tests: each service against stand-ins. The host through Fastify's `inject`: every route
     answers, a malformed body is `{ ok: false }`, a disallowed origin gets no CORS header, an
     allowed one does, an oversized body is refused.
  5. A test that no reply of any route contains the configured indexer URL, project id or RPC URL
     (configure recognisable dummy values and search every reply for them).
- **Exit check:** `yarn check` passes.
- **Report must include:** the Fastify and plugin versions added.

### Step 04.5: composition and the backend running end to end on a fake chain

- **Stream / model:** `host` / `fable`
- **Waits on:** 04.3, 04.4
- **Runs in:** main worktree
- **Packs:** `backend-conventions.md`, `service-pattern.md`, `checks-and-tooling.md`
- **Scope:** `packages/backend` entry point, composition root, scripts, `.env.local.example`
- **Context:** light
- **Goal:** One process, started as `ingest`, `serve` or both, wired in one place.
- **Work:**
  1. The composition root builds every implementation. Nothing else constructs one.
  2. The entry point reads `BACKEND_ROLES`, checks the schema fingerprint and refuses to start on
     a mismatch, starts one ingester per configured network and the host.
  3. Shutdown stops the loops between ranges and closes the pool.
  4. Scripts: `dev` for the backend, and the root `dev` runs the UI and backend together or
     documents the two commands.
  5. An end-to-end test with the fake chain source: start the process pieces in-process against
     the compose Postgres, feed blocks, and read them back through the `api` HTTP implementation
     over a real socket. This proves client, routes, adaptors, services, repositories and
     ingester agree.
- **Exit check:** `yarn check` and `yarn test:integration` pass, including the end-to-end test.
  Starting the backend with a database on an older schema exits non-zero with a message that
  names the reset command.
- **Report must include:** the commands to start the backend locally in each role.

### Step 04.6: the UI's data layer on the services

- **Stream / model:** `ui` / `fable`
- **Waits on:** nothing
- **Runs in:** own worktree `bernard/04-ui`
- **Packs:** `ui-codebase.md`, `service-pattern.md`, `signet-domain.md`, `checks-and-tooling.md`
- **Scope:** `packages/ui`
- **Context:** heavy
- **Goal:** Everything below the components reads the `api` services. Nothing reads an indexer.
- **Work:**
  1. Census every consumer of `MidnightContext`, `MidnightSignetEventsContext`,
     `SignetEventStore`, the indexer services and `network.ts` before changing any of them.
  2. A single place that builds the service implementations: the HTTP ones from
     `VITE_EXPLORER_BACKEND_URL`, the fakes when a development switch asks for them. The switch
     must not ship the fixtures in the production bundle (check the build output).
  3. `MidnightContext`: the selected network, its configuration from the Network service
     (read-only), the browser-side endpoints from the build. No edit or reset actions.
  4. A store for the list: pages by keyset, holds search, excluded callers and state filter,
     refetches what is shown on an interval, and exposes the indexing status. It follows the
     existing store shape (`subscribe`, `getSnapshot`).
  5. A loader for one request with its events, for the expanded row and for a `requestId` link.
  6. The raw transaction loader and the trace fallback call their services.
  7. Search, excluded callers and state filter live in the URL beside `networkId` (decision D19).
  8. Environment: remove the variables that moved to the backend from `explorer-env.ts`,
     `vite-env.d.ts`, `public/env.js` and `docker/30-explorer-env.sh`. Add the backend URL. The
     mover pays for every removed name, documentation included.
  9. Delete `signet-event-store.ts`, `signet-events-window.ts`, `indexer-services.ts`,
     `indexer-block-height.ts`, `MidnightSignetEventsContext.tsx` and their tests once nothing
     imports them. Replace the tests with tests of the new store against the fakes.
- **Exit check:** `yarn workspace <ui> typecheck` may still fail in components that 04.7 owns:
  list those files. Every new module's tests pass. `git grep` in `packages/ui` for
  `signetEventSourceFromIndexer`, `indexerUrl`, `BLOCKFROST` returns nothing.
- **Report must include:** the list of components 04.7 must change, with what each needs.

### Step 04.7: the UI's components

- **Stream / model:** `ui` / `opus` (a fresh agent: 04.6 is heavy)
- **Waits on:** 04.6
- **Runs in:** worktree `bernard/04-ui`
- **Packs:** `ui-codebase.md`, `service-pattern.md`, `checks-and-tooling.md`
- **Scope:** `packages/ui`
- **Context:** heavy
- **Goal:** The page as `architecture.md` section 8 describes it, working against the fakes.
- **Work:**
  1. The list: paged, newest first, with a control to load more (a shadcn component). New rows
     and changed rows appear on the polling interval without losing the scroll position.
  2. The header line: indexing status in place of the reading progress, and a clear state for a
     halted network and for a network that is not configured.
  3. Remove the "Starting Block" control and its component.
  4. The configuration popover: read-only, the selected network's values.
  5. The excluded-callers filter takes its list from the service.
  6. The expanded row and all verification components keep working, fed by the request loader.
  7. A `requestId` link opens that request directly, whatever its age.
  8. Update or replace every test the change touches. The test count may change. No test is
     deleted without a replacement that covers the same behaviour, unless the behaviour is gone.
  9. Run the smoke test in fake mode.
- **Exit check:** `yarn check` and `yarn build` pass in the UI worktree. The two `.wasm` files and
  no third. The smoke test passes against the dev server in fake mode. The production build
  contains no fixture data (grep the build output for a fixture's request id).
- **Report must include:** screenshots are not needed. A list of every visible behaviour that
  changed is.

### Step 04.8: independent review

- **Stream / model:** `review` / two fresh `fable` agents in parallel, one for the backend and one
  for the UI
- **Waits on:** 04.5, and 04.7 merged
- **Runs in:** main worktree, read only
- **Packs:** backend reviewer: `signet-domain.md`, `midnight-indexer.md`,
  `backend-conventions.md`, `service-pattern.md`. UI reviewer: `ui-codebase.md`,
  `service-pattern.md`, `signet-domain.md`.
- **Scope:** none
- **Context:** heavy
- **Goal:** Backend: find a way to lose, duplicate or misorder an event, or to make the aggregate
  table disagree with the events. UI: find a behaviour that regressed or a rule that was broken.
- **Work:**
  1. Backend: read the ingester and the chain source as an adversary. For each property in step
     04.3, try to construct a sequence the tests do not cover. Check secrets cannot leave through
     a reply or a log line.
  2. UI: compare against the baseline behaviour (`git show e0c1309:<path>` for the old code),
     the shadcn rule, the cursor rule, the base path rule, the WebAssembly rule.
  3. Both run the stage exit check.
- **Exit check:** findings with file and line and a concrete failing scenario, or "none".
- **Report must include:** findings ranked by severity.

## Gates

| Gate | Question | Fallback |
| --- | --- | --- |
| G10 | Do the list queries stay on indexes at 200,000 rows (step 04.2)? | Add or change indexes. If fragment search cannot be made to use an index, restrict it as in gate G9 |
| G11 | Can the fakes be kept out of the production bundle? | Move the fakes to a separate entry point of `api` that only tests and the development switch import |

## Stage exit check

After the UI worktree is merged and review findings fixed:

1. `yarn install --immutable && yarn check && yarn build`, stack down.
2. The two `.wasm` files and no third.
3. `yarn stack:restart && yarn test:integration`.
4. Smoke in fake mode against the dev server, and against a preview built with
   `EXPLORER_BASE_PATH=/explorer/`.
5. `git grep -n "signetEventSourceFromIndexer\|BLOCKFROST" -- packages/ui` returns nothing.
6. The backend starts with `BACKEND_ROLES=serve` against the migrated empty database and
   `curl` of `/healthz` and of `network/listNetworks` answer.

## Checkpoint

Commit and push. Mark stage 04 `done`. Update the packs: `ui-codebase.md` (the data path table is
now history: replace it with the new modules), `backend-conventions.md` (real folders, commands to
run the backend), `checks-and-tooling.md` (smoke modes, integration tests). Check stage 05.
