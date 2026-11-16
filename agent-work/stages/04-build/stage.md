# Stage 04-build

## Delivers

Every part of the product, each built against the contracts of stage 3 and tested alone: the indexer source with the transaction inspection, the ingest, the query service, the configuration and HTTP shell, and a UI that reads only the backend. A review of the ingest and the source.

## Assumes

- Stage 3 delivered `@sig-net/explorer-api` (service interface, client, routes, in-memory service) and the backend's `src/db` and `src/source/port.ts`, and its review left no `blocking` finding open.
- The default `tipMargin` and poll interval are the ones stage 1's gates recorded in `decisions.md` (`gate A7`, `gate A8`, `gate A10`). A fresh planner writes those values into step 04.2 and 04.4 when it confirms this stage.
- If stage 3's gate chose a field by field codec for the request record, steps 04.1 and 04.6 use it.
- D06, D07, D10 to D13, D21 to D24 of `decisions.md`.
- Step 04.2 has had no cold read on its own model: three attempts on fable ended in a server overload while the plan was written. The planner who confirms this stage does that cold read first and repairs the step from it.

## Shape

Two lanes that never share a path. The backend lane is four steps side by side (04.1, 04.2, 04.3, 04.4), each in its own folder of `packages/backend/src`. The UI lane is a chain (04.5, 04.6, 04.7) inside `packages/ui`, which alone touches the lockfile (04.6 removes a dependency). Review 04.8 waits on 04.1 and 04.2.

What one step's check starts: 04.1 a Node test run and a few requests to preprod. 04.2 and 04.3 a PostgreSQL container each. 04.4 a Node test run. 04.5 to 04.7 the whole repository's checks with a Chromium and a PostgreSQL container.

Step 04.1 copies the inspection module into the backend and step 04.6 deletes the UI's original. Between their merges the module exists twice. The stage check requires that it exists once.

## Gates

- **Review 04.8.** A `blocking` finding gets a fix step on fable and then ONE further review of the fixes alone. `advisory` findings go to the user's closing report and are fixed in at most one step with no review after it. At most two reviews.
