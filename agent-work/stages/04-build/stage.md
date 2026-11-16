# Stage 04-build

## Delivers

Every part of the product, each built against the contracts of stage 3 and tested alone: two amendments of those contracts, the indexer source with the transaction inspection, the ingest cycle and its loop, the query service, the configuration and HTTP shell, and a UI that reads only the backend. A review of the ingest, the source and the inspection.

## Assumes

Each line was checked by a command or a read at `68ece48` when this stage was revised.

- Stage 3 delivered `@sig-net/explorer-api` (`ExplorerService`, `createExplorerApiClient`, `explorerApiRoutes`, the wire, and `createInMemoryExplorerService` with `explorerSeed` under `/testing`) and in the backend `src/db` (migration `0001`, `networkDb`, `migrateNetworkSchema`, `wipeNetworkSchema`, `createTestDatabase`, `StoredInspection`) and `src/source` (`MidnightSource`, `createInMemoryMidnightSource`). Its two reviews left no `blocking` finding open (D40).
- The gates of stages 1 and 3 are closed: no margin for late events (D27), `tipMargin` 6 blocks (D28), poll interval 30 s (D29), the request record crosses the wire as its cell and no codec is written (D33).
- Every dependency the stage needs is in a manifest already (`hono`, `@hono/node-server`, `zod`, `kysely`, `pg`, `@midnightntwrk/ledger-v9` and the two workspace packages in `packages/backend/package.json`, `@sig-net/explorer-api` in `packages/ui/package.json`). The one manifest change of the stage is step 04.6's, which removes the ledger from the UI.
- The decisions this stage made while it was revised are D41 to D50. Each requirement the log addressed to its planner is in a step or in one of those rows:

| Requirement (log entry) | Where it landed |
| --- | --- |
| `inspectionForStorage` against D34 (51) | D49, step 04.1 |
| `tipMargin` 6 into the ingest (51) | D50, steps 04.2 and 04.4 |
| Cold read of step 04.2 on fable (stage 4's own assumption) | done: nine defects repaired, and the loop split off as step 04.10 for the step's budget |
| Every caller of a request (65) | D36, steps 04.2 and 04.3 |
| Escape `%`, `_` and backslash (71) | D42, step 04.3 |
| Count on `requests`, never through the view (71) | D43, step 04.3 |
| `totalEvents` and the four counts grow with the table (71, 90) | D43, timed tests of step 04.3 |
| Cursor condition `IS NOT DISTINCT FROM` (71) | D46, step 04.2 |
| Rebuild-and-compare test, a row with no event (71) | D45, step 04.2, review 04.8 |
| One contract in both roles merges by id (71) | step 04.1 |
| `last_error` and `inspection.failed` unfiltered (71) | D47, steps 04.9, 04.2 and 04.4 |
| The service reruns the review's timings (71) | step 04.3, items 5 and 6 |
| The lifecycle event sum has three copies (78, 90) | D48, step 04.5 |
| VACUUM after a backfill (78) | D44 |
| UNION form, and its loss on a wide fragment (90) | D42, step 04.3 |
| A fragment of 1 or 2 characters (90) | D41, steps 04.9 and 04.5 |
| Exclusion counts and distinct callers scan (90) | D43, timed tests of step 04.3 |
| `request_callers` and a removed event (90) | D45, check of step 04.2 |


## Shape

04.9 first, beside 04.1, which needs nothing of it. Then two lanes that never share a path. The backend lane is 04.2, 04.3 and 04.4 side by side, each in its own folder of `packages/backend/src`, with 04.10 (the loop) after 04.2 in the same folder. The UI lane is a chain (04.5, 04.6, 04.7) inside `packages/ui`, which alone touches the lockfile (04.6 removes a dependency). Review 04.8 waits on 04.1, 04.2 and 04.10.

Steps 04.1 and 04.2 meet at one function type (D49): the ingest takes the inspection as a dependency and is tested with a stub. Stage 5 composes them, and its typecheck is where a mismatch would show.

What one step's check starts. Every check but 04.8's starts one PostgreSQL 17 container and the repository's checks (install, lint, typecheck, format check, the tests of all four workspaces with the UI's in a Chromium, the build), then one more run of its workspace's tests: about a minute or two. Beyond that: 04.1 sends a few requests to preprod. 04.3 seeds 200,000 requests and about 540,000 events into its PostgreSQL, several hundred MB of memory for the length of its tests. 04.8 starts nothing in its check, and during its work the reviewer starts a PostgreSQL of its own. The stage check starts one PostgreSQL, runs the repository's checks once and each workspace's tests once more, and sends the requests to preprod.

Step 04.1 writes the inspection into the backend and step 04.6 deletes the UI's original. Between their merges the module exists twice. The stage check requires that it exists once.

## Gates

- **Review 04.8.** A `blocking` finding gets a fix step on fable and then ONE further review of the fixes alone. `advisory` findings go to the user's closing report and are fixed in at most one step with no review after it. At most two reviews. The decision row that closes the gate names `review 04.8`: the stage check looks for it.
- **Do the timed tests of step 04.3 hold?** They hold each statement of the service under 500 ms at 200,000 requests (D43). A statement that cannot be brought under it is a finding for the orchestrator, who then revises D42 or D43 before the step is accepted: the builder never raises a threshold.

## For the closing report

Kept here so that stage 5 finds them: one event the browser cannot decode rejects the whole page (`packages/api/src/wire.ts`, `lifecycleFromWire`). The README's mentions of the modules steps 04.5 to 04.7 delete are listed in those steps' reports and are step 05.3's to rewrite. Stage 5's planner corrects step 05.1 to the names this stage exported: `inspectTransactionForStorage`, the settings of `runIngestCycle`, `createPostgresExplorerService(db, networks)` with each network's `ExplorerNetworkConfig`, `createHttpApp` with `logError`.
