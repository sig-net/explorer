# Stage 01: assumptions

## Delivers

Proof that the agent machinery works as the runbook assumes, and a tested answer to every
assumption the design rests on. Each answer is recorded as a decision, and the packs and later
plans are corrected to match. No product code is written.

## Assumes

- `.env.local` at the main worktree root holds a working `VITE_MIDNIGHT_PREPROD_BLOCKFROST_PROJECT_ID`.
- The baseline passes at commit `e0c1309` plus the planning commit.
- The reference checkouts named in `knowledge/core.md` exist.

## Shape

Step 01.1 runs first and alone: nothing else is worth dispatching until agents are known to
behave. Then 01.2 to 01.5 run in parallel in the main worktree. They write no product code and
touch no common file: each writes only to its own subfolder of `01-assumptions/evidence/`.
Step 01.6 is the orchestrator's own and runs last.

```
01.1 -> ( 01.2 | 01.3 | 01.4 | 01.5 ) -> 01.6
```

## Steps

### Step 01.1: prove the agent machinery

- **Stream / model:** orchestrator, using one `opus` and one `fable` subagent
- **Waits on:** nothing
- **Runs in:** main worktree
- **Packs:** none beyond `core.md`
- **Scope:** nothing in the repository
- **Context:** light
- **Goal:** Know that a subagent sees the user's rules, obeys the contract in `core.md`, returns
  the report shape, and can be continued with its context intact.
- **Work:**
  1. Run the baseline (`orchestrator.md` section 6). Record the result.
  2. Dispatch an `opus` subagent with only `core.md` and this instruction: "Without writing any
     file, answer: (a) quote the rule you were given about the em dash and about semicolons,
     (b) say where a project dependency may be installed, (c) say what you may do with git,
     (d) run `yarn typecheck` in the worktree and quote its last line. Reply in the step report."
  3. Check the reply: it quotes rules that are NOT in `core.md` word for word (which shows the
     global rules loaded), it used the report shape, it ran the command.
  4. Continue the same agent with SendMessage: "What was the last line of the command you ran?"
     A correct answer without re-running shows context survived.
  5. Repeat 2 and 3 with a `fable` subagent.
  6. Ask one of them to do something the contract forbids ("commit your work") and confirm it
     declines and reports.
- **Exit check:** all six observations recorded in the log, each with the quoted reply.
- **Report must include:** not applicable (orchestrator step).

If a subagent does not see the global rules, that is a user gate: the packs would have to carry
every rule, and the user decides whether to proceed.

### Step 01.2: how the indexer behaves

- **Stream / model:** `probe` / `fable`
- **Waits on:** 01.1
- **Runs in:** main worktree
- **Packs:** `checks-and-tooling.md`, `midnight-indexer.md`, `signet-domain.md`
- **Scope:** `agent-work/01-assumptions/evidence/indexer/` only (scripts and captured output)
- **Context:** heavy
- **Goal:** Answer the ten open questions at the end of `midnight-indexer.md` by experiment
  against preprod, with scripts that can be run again.
- **Work:**
  1. Write Node scripts (plain `.mjs`, no new dependency) that read the project id from
     `.env.local` with `process.loadEnvFile` and never print the URL.
  2. For each question, design an experiment that could FAIL. Examples: page a range of several
     thousand events with a small `limit` and compare with one walk using a large `limit`. Read
     the same closed range twice some minutes apart and diff. Read `[a, b]` and `[a, b + 1]` to
     see inclusivity. Poll the head and at once read the events of the head block, repeatedly, to
     catch a block that appears before its events. Fetch `block(offset: { height })` for the head
     minus k on successive polls and compare hashes to look for replaced blocks.
  3. Measure, do not guess: the largest `limit` honoured, the time one page takes, what happens
     on rapid requests (status, headers).
  4. Record raw output beside each script, scrubbed.
- **Exit check:** `evidence/indexer/` holds one script per question and its output, and the
  report answers each question as `confirmed`, `refuted` or `undetermined`, with the experiment
  that says so.
- **Report must include:** for each of gates G1 to G4 below, which outcome the evidence supports.

### Step 01.3: the Node runtime for the backend

- **Stream / model:** `probe` / `opus`
- **Waits on:** 01.1
- **Runs in:** main worktree for reading, a throwaway directory under the session scratchpad for
  the experiment
- **Packs:** `checks-and-tooling.md`
- **Scope:** `agent-work/01-assumptions/evidence/node-runtime/` only
- **Context:** light
- **Goal:** Decide how backend TypeScript runs and how workspace packages import each other.
- **Work:**
  1. In a scratch directory, make a minimal Yarn 4 workspace with `nodeLinker: node-modules` and
     three packages mirroring `lib`, `api`, `backend`, each exporting TypeScript source through
     its `package.json` `exports`.
  2. Test: does `node packages/backend/src/main.ts` run under Node 26 when it imports the other
     two packages' `.ts` source through `node_modules` symlinks? Does `tsc` (TypeScript 7, the
     version in the repository) typecheck the same imports with the settings the repository uses?
     Does Vitest in Node mode resolve them? Does Vite resolve them for a browser bundle?
  3. Test that `@sig-net/midnight` decodes one real event in Node: take a fixture from
     `src/lib/midnight/*.fixture.ts` and run `tryDecodeSignetEvent` on it.
  4. Copy the working configuration files into the evidence folder.
- **Exit check:** the report states one of the two outcomes of gate G5, with the commands and
  their output.
- **Report must include:** the exact `package.json` `exports`, `tsconfig` settings and Node flags
  that worked, ready to be used in stage 02.

### Step 01.4: the EVM trace fallback and the MPC output cache from Node

- **Stream / model:** `probe` / `opus`
- **Waits on:** 01.1
- **Runs in:** main worktree
- **Packs:** `checks-and-tooling.md`, `signet-domain.md`
- **Scope:** `agent-work/01-assumptions/evidence/evm/` only
- **Context:** light
- **Goal:** Know that the backend can serve the trace fallback, and what shape it should cache.
- **Work:**
  1. Read `src/lib/midnight/evm-transaction-output.ts`, `evm-json-rpc.ts` and the SDK's
     `evmTraceOutputFromCallFrame` to learn the exact request and the value the UI needs.
  2. With `dev-secrets get SEPOLIA_FORK_RPC_URL` used inside a script (never printed), call
     `debug_traceTransaction` with the tracer the UI uses, for a Sepolia transaction hash taken
     from a recent preprod request (get one by running the app or from the indexer evidence of
     01.2, or ask the orchestrator).
  3. Confirm the result passes through `evmTraceOutputFromCallFrame` in Node.
  4. Confirm the MPC output cache can be read from Node with the SDK's `MpcOutputCacheReader`
     for a request that has an attested output.
- **Exit check:** a script and its scrubbed output showing a trace read and decoded in Node.
- **Report must include:** the recommended shape of the `trace` column and of the service's
  reply, and whether the endpoint needs archive access.

### Step 01.5: can this machine push a workflow change

- **Stream / model:** orchestrator
- **Waits on:** 01.1
- **Runs in:** a throwaway worktree
- **Packs:** none
- **Scope:** a throwaway branch
- **Context:** light
- **Goal:** Know before stage 07 whether a push that changes `.github/workflows/**` is accepted.
- **Work:**
  1. `git wt bernard/workflow-push-probe` from the main worktree.
  2. Add one blank line to a comment in `.github/workflows/pages-deploy.yml`, commit, and
     `git push -u origin bernard/workflow-push-probe`.
  3. Whatever the outcome, delete the remote branch if it was created
     (`git push origin --delete bernard/workflow-push-probe`), remove the worktree and the
     local branch.
- **Exit check:** the push result is in the log.
- **Report must include:** not applicable (orchestrator step).

Neither workflow runs on a branch push (`knowledge/checks-and-tooling.md`), so the probe triggers
nothing.

### Step 01.6: decide the gates and correct the plan

- **Stream / model:** orchestrator
- **Waits on:** 01.2, 01.3, 01.4, 01.5
- **Runs in:** main worktree
- **Packs:** all
- **Scope:** `agent-work/` only
- **Context:** heavy
- **Goal:** Turn the evidence into decisions and make every later document true.
- **Work:**
  1. For each gate below, record the outcome in `decisions.md`.
  2. Rewrite `knowledge/midnight-indexer.md`: every `[unverified]` becomes `[run]` with its
     script, or stays `[unverified]` with what was tried.
  3. Set the defaults of `SAFETY_MARGIN`, `RANGE_SIZE`, `REREAD_BLOCKS` and `POLL_INTERVAL` in
     `architecture.md` section 5 from the measurements.
  4. Revise stages 02 to 06 where an outcome changes them. Log each revision.
- **Exit check:** no `[unverified]` remains in a pack without a note of what was tried, and every
  gate has a decision entry.

## Gates

| Gate | Question | Pass means | Fallback when it fails |
| --- | --- | --- | --- |
| G1 | Are `contractEvents` rows ordered by ascending `id` across pages, and are offsets stable for a closed range? | Page by offset as the SDK does | Read each range with one query whose `limit` exceeds any possible row count for the range and shrink `RANGE_SIZE` until that holds. If ordering itself is not by id, sort by id after a complete read and treat a range as complete only when two consecutive reads agree |
| G2 | Are all events of a block served by the time the indexer reports that block as its head? | `SAFETY_MARGIN` can be small | Set `SAFETY_MARGIN` to the largest lag observed times a factor, and make the trailing re-read cover it |
| G3 | Can a block at or below the indexer's head be replaced? | The hash check is a rare safeguard | Set `SAFETY_MARGIN` beyond the deepest replacement observed. If blocks are replaced often and deeply, user gate |
| G4 | Does `block(offset: { height })` return the hash of a past height? | Checkpoint hash check as designed | Take the hash from an event row of that block when one exists, and otherwise skip the hash check for that loop and log it |
| G5 | Does Node run the backend's TypeScript and its workspace imports directly? | The backend runs from source, no build step | Each package builds to `dist` with `tsc`, `exports` point at `dist`, and stage 02 adds the build ordering |
| G6 | Does `debug_traceTransaction` work from the development endpoint and decode in Node? | Build the service as designed | If the endpoint refuses the method, user gate for another endpoint. The rest of the task does not wait on it |
| G7 | Is a workflow change pushed from this machine accepted? | Stage 07 pushes its workflow commit | Stage 07 keeps the workflow change as the LAST commit, unpushed, and hands it to the user |

A result no row covers is a user gate (`orchestrator.md` section 8).

## Stage exit check

1. Baseline passes on the main worktree.
2. `git status --short` shows only `agent-work/` changes.
3. `decisions.md` has an entry for each of G1 to G7.
4. `grep -rn 'unverified' agent-work/knowledge/` shows only entries that say what was tried.

## Checkpoint

Commit `agent-work/` (evidence, log, state, decisions, revised packs and plans) and push. Mark
stage 01 `done` in `index.md` with the commit. Retire the `probe` stream.
