# Stage 05: integration on preprod

## Delivers

The real thing, locally: the backend indexes preprod through Blockfrost from the start block into
the local Postgres, the UI reads it over HTTP, and a request can be opened and verified in the
browser. The indexed data is audited against an independent read of the chain, and the list
queries and the rebuild are measured on real data.

## Assumes

- The backend runs in every role and passed its end-to-end test on a fake chain (stage 04).
- The UI passes the smoke test in fake mode (stage 04).
- `MIDNIGHT_PREPROD_BLOCKFROST_PROJECT_ID` and `SEPOLIA_FORK_RPC_URL` exist in the shared secrets.

## Shape

A chain. Each step needs the running system the one before it produced. One worktree, the main
one. Only one process may ingest preprod into the local database at a time, so nothing here
runs in parallel except the review.

```
05.1 -> 05.2 -> 05.3 -> 05.4 -> 05.5 review
```

## Steps

### Step 05.1: first full index of preprod

- **Stream / model:** `ingest` / `fable`
- **Waits on:** nothing
- **Runs in:** main worktree
- **Packs:** `midnight-indexer.md`, `signet-domain.md`, `backend-conventions.md`,
  `checks-and-tooling.md`
- **Scope:** `packages/backend` (fixes only), `.env.local`
- **Context:** heavy
- **Goal:** Preprod indexed from its start block to the head, with the loop then following it.
- **Work:**
  1. Write the backend's variables into the gitignored `.env.local` from the shared secrets,
     never printing a value. Check `git check-ignore`.
  2. `yarn stack:restart`. Start the backend with `BACKEND_ROLES=ingest`.
  3. Watch it to the head. Record: blocks and events indexed, how long the catch-up took (a
     measured fact for the record, not a forecast), requests made to the indexer, any retry, any
     halt.
  4. Leave it running and confirm it follows the head for at least a few hundred blocks, with
     new requests appearing in the table.
  5. Fix what breaks. A halt is a finding first: understand it before changing the code. Record
     the cause.
  6. Stop the backend mid-catch-up once (kill the process), restart, and confirm it resumes at
     the checkpoint and ends with the same data. Do this on a second database or after noting
     counts, so the comparison is real.
- **Exit check:** the checkpoint is within the safety margin of the indexer's head, `state` is
  `running`, and `select count(*)` of events and sign requests is quoted.
- **Report must include:** every defect found and fixed, with its cause.

### Step 05.2: audit against an independent read

- **Stream / model:** `ingest` / `fable` (a fresh agent, so the audit is not written by the mind
  that wrote the ingester)
- **Waits on:** 05.1
- **Runs in:** main worktree
- **Packs:** `midnight-indexer.md`, `signet-domain.md`
- **Scope:** `packages/backend` (an audit command and its tests)
- **Context:** heavy
- **Goal:** Know that what is stored equals what the chain source serves, by a path that shares
  as little code with the ingester as it can.
- **Work:**
  1. An audit command for one network: walk the whole history from `start_block` to the
     checkpoint with its own plain query loop (not the ingester's range reader), and compare
     event by event with the table: same keys, same payloads, same order. Report missing, extra
     and differing rows.
  2. Compare the aggregate table with a rebuild from the events.
  3. Compare the first two days of requests with what the OLD UI would show: check out the
     baseline (`e0c1309`) in a throwaway worktree made with `git wt`, run its
     `aggregateSignBidirectionalLifecycles` over events read by the SDK for a fixed block range,
     and compare request ids, order, callers and durations with the backend's rows for the same
     range.
  4. Prove the audit can fail: delete one event row and change one payload in a copy of the
     database (or inside a transaction that is rolled back), and quote the audit's report.
- **Exit check:** the audit reports no difference on the real data, and reports both planted
  differences.
- **Report must include:** counts compared, and the planted-fault output.

### Step 05.3: the UI on the real backend

- **Stream / model:** `ui` / `opus`
- **Waits on:** 05.1
- **Runs in:** main worktree
- **Packs:** `ui-codebase.md`, `service-pattern.md`, `checks-and-tooling.md`
- **Scope:** `packages/ui` and `packages/backend` (fixes only)
- **Context:** heavy
- **Goal:** The app, pointed at the local backend, does everything it did on the indexer.
- **Work:**
  1. Start the backend with `BACKEND_ROLES=ingest,serve`, with CORS allowing the dev server's
     origin. Start the UI with `VITE_EXPLORER_BACKEND_URL`.
  2. Run the smoke test in real mode on preprod.
  3. Drive by hand through Playwright and check each behaviour: paging to old requests, search
     by request id fragment and by caller fragment, excluding a caller, the state filter, a
     `requestId` link to an old request, the expanded row (three event sections, signature check
     valid, EVM status, attestation check), the transaction inspection (the ledger WebAssembly
     loads only then), the read-only popover, the status line, switching to a network that is not
     configured and back.
  4. Force the trace fallback: pick a request whose output is not in the MPC cache, or block the
     cache host in the Playwright context, and confirm the output arrives through the backend and
     the attestation check passes over it.
  5. Confirm from the browser's network log that no request goes to a Midnight indexer or node,
     and that no reply contains the project id.
  6. Fix what breaks in either package, and extend the smoke test with any check that would have
     caught it.
- **Exit check:** the smoke test passes in real mode. The report lists each behaviour of item 3
  with how it was observed.
- **Report must include:** any behaviour that differs from the baseline app, intended or not.

### Step 05.4: measure

- **Stream / model:** `data` / `opus`
- **Waits on:** 05.1
- **Runs in:** main worktree
- **Packs:** `backend-conventions.md`, `checks-and-tooling.md`
- **Scope:** `packages/backend` (index changes only, if needed), `agent-work/05-integration/evidence/`
- **Context:** light
- **Goal:** Numbers on real data for the queries the UI makes and for a rebuild.
- **Work:**
  1. `EXPLAIN (ANALYZE, BUFFERS)` for: the default first page, a deep page, search by request id
     fragment, search by caller fragment, each state filter, excluded callers, distinct callers,
     one request with its events. Save the plans.
  2. Repeat on the real data multiplied to at least a year's volume (insert copies with shifted
     keys in a scratch database).
  3. Time a full rebuild of the aggregate table and a full reset and re-index of preprod, as
     measured facts.
  4. Propose index changes only where a plan shows a need, and re-measure.
- **Exit check:** the plans and timings are in the evidence folder, and no list query scans the
  whole table at a year's volume.
- **Report must include:** a table of query, rows, plan summary and time.

Steps 05.2, 05.3 and 05.4 all need only a database that 05.1 filled and do not write to the same
files. If the orchestrator judges the machine can take it, 05.2 and 05.4 may run in parallel in
the main worktree against the same database, since both only read it (05.2's planted faults and
05.4's multiplied data go in scratch databases). 05.3 runs alone because it restarts the backend.

### Step 05.5: independent review

- **Stream / model:** `review` / `fable`, fresh
- **Waits on:** 05.2, 05.3, 05.4
- **Runs in:** main worktree, read only
- **Packs:** all
- **Scope:** none
- **Context:** heavy
- **Goal:** A whole-system read: does the running thing match `architecture.md` and
  `decisions.md`, and is there a failure the stage did not exercise?
- **Work:**
  1. Read the diff of the stage. Check each decision D01 to D22 against the code.
  2. List failure cases not exercised so far (the indexer down for a long time, the database
     down, the head going backwards, a burst of events larger than a page in one block, clock
     skew between block times) and say for each whether a test covers it.
  3. Run the stage exit check.
- **Exit check:** findings, and a list of untested failure cases for stage 06.
- **Report must include:** both lists.

## Gates

| Gate | Question | Fallback |
| --- | --- | --- |
| G12 | Does the audit find any difference on real data? | Any difference is a defect in the ingester or a refuted indexer assumption. Stop, find the cause, fix, wipe, re-index, audit again. If the cause is the indexer serving different data on different reads, user gate |
| G13 | Does a full re-index of preprod complete without exhausting the Blockfrost quota or being throttled to a crawl? | Lower the request rate and make it configuration. If a rebuild is impractical at the allowed rate, user gate: decision D06 depends on rebuilds being practical |

## Stage exit check

1. `yarn install --immutable && yarn check && yarn build`, stack down.
2. `yarn stack:restart`, backend started, preprod indexed to the head.
3. The audit command reports no difference.
4. The smoke test passes in real mode and in fake mode.
5. The two `.wasm` files and no third.
6. No reply and no log line contains the project id: grep the backend's log of the whole run for
   the id read from the environment, printing only the count of matches.

## Checkpoint

Commit and push. Mark stage 05 `done`. Record the measured defaults and timings in
`architecture.md`. Add the untested failure cases to stage 06's plan. Update the packs with
everything that was learned about running the system.
