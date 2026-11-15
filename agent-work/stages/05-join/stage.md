# Stage 05-join

## Delivers

One running system: a backend process that can be started as `ingest`, `serve` or both, serving
the API over HTTP with CORS, and a UI that reads it and holds no code that reads an indexer.
Proof on preprod that what the backend stores is what the chain holds, event for event, from the
start block to the head.

## Assumes

- Stage 04: both halves complete and reviewed, with the blocking findings of G19 fixed.
- G07 (stage 01): how long a catch-up from block 3386746 takes and what it costs. Step 05.3 runs
  that catch-up for real, more than once.
- D16: the UI is served from another origin, so CORS is part of the contract. D21: no URL.
- The secret `MIDNIGHT_PREPROD_BLOCKFROST_PROJECT_ID` still works.

## Shape

05.1 (the backend's process) and 05.2 (the UI's removal of its old data path) run side by side:
one is in `packages/backend`, the other in `packages/ui` and the files that name its variables.
05.3 joins them on preprod and waits on both. 05.4 reviews what is served, last: after this
stage the API is what a deployment exposes.

## Gates

| Gate | Question | Answered by | Outcome and fallback |
| --- | --- | --- | --- |
| G20 | Does the backend, caught up on preprod, hold exactly the events an independent read of the indexer gives, and rows equal to a rebuild? | 05.3, by a test that compares them | Yes: the defaults are confirmed in `decisions.md` with the measured catch-up time. No: the task STOPS here. The difference is a lost or invented event, which is the one thing this task exists to prevent: the orchestrator records it and the planner re-plans from the finding |
| G21 | Does a catch-up from the start block fit the indexer's allowance with the defaults? | 05.3, measured | Yes: as planned. No: `RANGE_SIZE` and the pacing are retuned in 05.3 and the numbers recorded. If no setting fits: BLOCKED with the numbers |
| G22 | Does the review find the API or the process other than the design says? | 05.4 | `blocking` findings get one fix step each and ONE further review of the fixes alone. `advisory` findings are listed for the user and fixed in at most one step, with no review after it |
