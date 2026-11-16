# Stage 05-integrate

## Delivers

The backend as one process and one Docker image, proven against preprod with the UI in front of it, the documentation people need once `agent-work/` is gone, and a verdict on every outcome.

## Assumes

- Stage 4 delivered and merged: `createIndexerSource`, the inspection, `runIngestCycle` and `startIngestLoop`, `createPostgresExplorerService`, `parseBackendEnv`, `createHttpApp`, and a UI that reads `VITE_EXPLORER_API_URL`. A fresh planner corrects the names below to the ones stage 4 exported.
- Review 04.8 left no `blocking` finding open.
- The full preprod history indexes in under 30 minutes. If stage 4 found otherwise, step 05.2's waiting time changes.
- D09, D12, D14, D25 and D26 of `decisions.md`.

## Shape

05.1 first. Then 05.2 and 05.3 side by side: 05.2 changes only `agent-work/probes/`, 05.3 only documentation. 05.4, the review of the whole branch, waits on all three.

What a check starts: 05.1 a PostgreSQL container and a Docker build. 05.2 a PostgreSQL container, the backend container, a Vite preview and a Chromium, for up to 45 minutes, with requests to preprod throughout. 05.3 nothing but the repository's checks.

## Gates

- **Review 05.4, of the whole branch against the outcomes.** An outcome `not met` is `blocking`. A `blocking` finding gets a fix step on fable and then ONE further review of the fixes alone. `advisory` findings are listed for the user in the closing report and fixed in at most one step with no review after it.
- **Does the live run's event count equal the indexer's?** Step 05.2 reports both. Unequal: a `blocking` defect of O4. The orchestrator opens a fix step on fable with the two counts and the first differing block, and step 05.2 runs again after it.

## The closing report

When the stage is closed the orchestrator tells the user, from the reports of 02.1, 04.7 and 05.3: what each workflow under `.github/workflows/` needs changed (moved paths, the UI's `VITE_EXPLORER_API_URL`, a build of `packages/backend/Dockerfile`), that the Blockfrost plan must allow about 11,000 requests a day per network, the outcome of each gate of stage 1, and every `advisory` finding.
