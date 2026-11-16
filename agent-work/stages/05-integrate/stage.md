# Stage 05-integrate

## Delivers

The backend as one process and one Docker image, proven against preprod with the UI in front of it, the documentation people need once `agent-work/` is gone, and a verdict on every outcome.

## Assumes

Each line was checked by a command or a read at `c9d0e97` when this stage was revised.

- Stage 4 delivered and merged what step 05.1 composes: `parseBackendEnv`, `openDatabase`, `migrateNetworkSchema`, `wipeNetworkSchema`, `createIndexerSource`, `inspectTransactionForStorage`, `runIngestCycle` behind `startIngestLoop`, `createPostgresExplorerService(db, networks)` and `createHttpApp` with `logError`. No file composes them yet: `packages/backend/src/main.ts` does not exist and `packages/backend/src/index.ts` is an empty module.
- The UI reads `VITE_EXPLORER_API_URL` and nothing of an indexer, and its image forwards the variable.
- The gates of stage 4 are closed (D54). Step 04.14 had no review after it, so review 05.4 reads its merge.
- The full preprod history indexes in well under 30 minutes: reading it through the indexer took 36 s in stage 1 (A4), plus one request per request's raw transaction. If the live run shows otherwise, the waiting time of `probes/live-preprod.sh` changes.
- No step changes a file under `.github/workflows/` (D25): the stage check fails if the branch does.
- The decisions this stage made while it was revised are D56 to D61. Each requirement the log addressed to this stage or its planner is in a step or in one of those rows:

| Requirement (log entry) | Where it landed |
| --- | --- |
| Pass `startIngestLoop` a synchronous logger as `onOutcome`, and its backoff of 60, 120, 240, 300 s (132) | step 05.1, items 3 and 5, the server pack, D59 |
| README lines 321, 325, 344, 383, 397 and 443 name things 04.5 deleted (138) | the docs pack, step 05.3, and the path and module guards of its check |
| README lines 291, 301, 456, 458 and 489 name what 04.6 removed (report of 04.6) | the docs pack, step 05.3 |
| README lines 123, 198, 199, 224 to 256, and the image forwards `VITE_EXPLORER_API_URL` (173) | the docs pack, step 05.3 |
| `graphqlResponseSchema` requires `data`: make it optional, with a test (168) | step 05.5, items 1 and 2 |
| The comments of `backend-env.ts:92-103` name copies 04.7 deleted (173) | step 05.5, item 3 |
| Correct step 05.1 to the names stage 4 exported (stage 4's `stage.md`) | the server pack, which step 05.1 reads, and step 05.1 items 3 to 6 |
| The review of the whole branch reads step 04.14 (D54) | step 05.4, item 4, and its check asks for `covered: step 04.14` |
| The UI's tests time out under load, one ingest test asserts 100 ms (145, 173, 187) | "Shape" below: one heavy thing at a time |
| Workflow lines of step 02.1's report (51) | the docs pack, step 05.3 item 7, "For the closing report" below |
| Cold read of the heaviest step on its own model (the skill, section 8) | done for 05.1 on fable: fifteen answers, repaired in the step (the seams `migrate`, `started`, `TestDatabase.url`, the log entry's shape, the recipe of four tests) and in the server pack |
| Comments that cite a decision by number dangle once `agent-work/` goes (found while revising) | D61, step 05.5 item 4, `no_plan_references` in the checks of 05.5 and 05.1 |

## Shape

05.5 and 05.6 first, side by side: 05.5 changes five source files, 05.6 writes `DECISIONS.md` alone. Then 05.1 (the composition, all of `packages/backend/src`), then 05.7 (the image, the compose file and the manifests). Then 05.2 and 05.3 side by side: 05.2 changes only two files under `agent-work/probes/`, 05.3 only documentation. 05.4, the review of the whole branch, waits on all six.

What a check starts. The checks of 05.5 and 05.1 start one PostgreSQL 17 container and the repository's checks (install, lint, typecheck, format check, the tests of all four workspaces with the UI's in a Chromium, the build), then the backend's tests once more: a few minutes. 05.7's does the same, then builds the backend image and runs it beside a second PostgreSQL on a Docker network of its own, with requests to preprod for under two minutes. The checks of 05.3 and 05.6 run install, lint and the format check and start nothing. 05.2's check reads one file. 05.4's reads the report. Every check removes what it started.

What a step's work starts beyond its check. 05.2 runs the live probe: a PostgreSQL container, the backend image, a build and a preview of the UI and a Chromium, for up to 45 minutes, with requests to preprod throughout. 05.3 runs every command it documents, which includes both image builds and the test suites. 05.4 starts a PostgreSQL of its own and runs the documented commands.

One heavy thing at a time. The UI's browser tests timed out under load in 2 runs of 4 on the merged parent, and one test of the ingest asserts 100 ms of wall time. So no check of this stage starts two suites at once, the stage check runs each suite once and in sequence, and the orchestrator runs one `agent-work check` at a time in this stage and none while the live probe of 05.2 is indexing. A browser test that times out in a check that otherwise passes is run again alone before the step is sent back.

## Gates

- **Review 05.4, of the whole branch against the outcomes.** An outcome `not met` is `blocking`. A `blocking` finding gets a fix step on fable and then ONE further review of the fixes alone. `advisory` findings are listed for the user in the closing report and fixed in at most one step with no review after it. At most two reviews. The decision row that closes the gate names `review 05.4`: the stage check looks for it.
- **Does the live run's event count equal the indexer's?** Step 05.2 reports both. Unequal: a `blocking` defect of O4. The orchestrator opens a fix step on fable with the two counts and the first differing block, and step 05.2 runs again after it.
- **Was the backend killed before it was synced?** `killedBeforeSynced` false means the run proved no resume: step 05.2 runs the probe once more. False twice: the orchestrator lowers `EXPLORER_MAX_RANGE_BLOCKS` in `probes/live-preprod.sh` and sends the step back.

## For the closing report

When the stage is closed the orchestrator tells the user what follows, with the `FOR THE USER` section of step 05.3's report and every `advisory` finding of review 05.4.

Left for the user to do by hand:

- The workflows, which this machine cannot push (D25). `pages-deploy.yml:81` and `:84` name `dist`, which is `packages/ui/dist`, and its build needs `VITE_EXPLORER_API_URL` set to the backend's public URL. `docker-publish.yml:1`, `:72` and `:108` build a root `Dockerfile`, which is `packages/ui/Dockerfile`, and nothing publishes `packages/backend/Dockerfile`. Until they change, a release tag fails to deploy the pages and to publish the image.
- The Blockfrost plan must allow about 11,000 requests a day per network at the default poll interval (D29): the quota of the plan is not known.
- Kubernetes manifests, the PostgreSQL 17 and the backend's public URL are the cluster owner's (D09, D14).
- A developer's `.env.local` moved to `packages/ui/` (D31), the backend's is `packages/backend/.env.local`, and `yarn dev` is `yarn dev:ui` (D60).
- `agent-work/` is removed when the pull request opens, on the user's word.

The gates of stage 1: no margin for late events (D27), `tipMargin` 6 blocks (D28), poll interval 30 s (D29).

Choices made during execution that the user may want otherwise:

- A stopped network resumes when its identity matches its configuration again, without a wipe (D51): it reads D12 by its reason, and the user may want a stop to hold until a wipe.
- A search under 3 characters is no search and matches everything (D41).
- `/readyz` does not probe the database on each call (D56), and a shutdown abandons a cycle still reading after 8 seconds (D57).
- Step 04.11 went wider than its step: it treats an unpaired surrogate like U+0000 and bounds `decode_failure` to 2000 characters without URL credentials.
- Steps 02.1 and 02.2 were accepted with `--retried` for the excluded callers filter defect that step 02.4 fixed in the component.

Known limits, none fixed:

- One event the browser cannot decode rejects the whole page (`packages/api/src/wire.ts`, `lifecycleFromWire`).
- A failed read of the callers leaves the filter's list empty with no error shown, and the filter's empty text is "No known caller matches".
- An unavailable network is marked in the configuration popover's select, since the network switcher switches chains.
- From review 04.8: the SDK's event stream ends on a short page and drops ids above the first row's `maxId`, so an indexer that caps pages under 100 loses events silently and only `tipMargin` guards a row moving between pages. A process still running with an old configuration records its identity in a wiped schema. After a lost commit answer `last_error` stays until the next cycle. No test covers a database that is down or a lost commit.
- From review 04.13: nothing bounds the size of a stored inspection (20 MB is stored and served, 300 MB fails every retry), and `bytesOfHex` cuts silently at the first non-hex character, which the adaptor's `hashSchema` keeps from happening.
- From step 04.12: `textWithoutUrlCredentials` leaves a secret's own trailing punctuation, cuts text glued to a query with no white space, and does not read a password holding a raw slash, question mark or hash.
- From step 04.14: an event whose name held a NUL is stored under the cleaned name with no request id, so the lifecycle view skips it. The timing test asserts 100 ms of wall time on a shared machine (measured 1 to 31 ms).
- One browser test timed out once in six cold runs at load 7 with no Vite reload, and `excluded-callers-filter.test.tsx` failed 1 run in 10 on the untouched base (report of 02.1).
