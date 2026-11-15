# Stage 06: hardening

## Delivers

The operations the design promises and the failure cases stage 05 listed: the reset commands, the
scheduled audit, behaviour when the indexer or the database is away, protection of the public
endpoints, support for the remaining networks in code, and a backend image.

## Assumes

- The system runs on preprod and its audit is clean (stage 05).
- Stage 05's review produced a list of untested failure cases. The orchestrator copies it into
  step 06.2 before starting the stage.

## Shape

Four independent steps in the main worktree. They touch different files of `packages/backend`
(operations commands, the ingester's failure handling, the host's protection, network
configuration), and 06.5 touches only the root image files. Only 06.3 changes a manifest.
06.2 and 06.4 both touch ingestion and configuration code paths that are near each other, so
06.4 waits on 06.2.

```
( 06.1 | 06.2 -> 06.4 | 06.3 | 06.5 ) -> 06.6 review
```

## Steps

### Step 06.1: reset and audit as operations

- **Stream / model:** `data` / `opus`
- **Waits on:** nothing
- **Runs in:** main worktree
- **Packs:** `backend-conventions.md`, `signet-domain.md`
- **Scope:** `packages/backend` commands and their tests
- **Context:** light
- **Goal:** The explicit commands of `architecture.md` section 9, each proven.
- **Work:**
  1. `reset-network <network>`: deletes that network's rows in every table and its checkpoint, in
     one transaction, refusing while an ingester holds the network's lock. It asks for the
     network name twice or takes a `--yes` flag, and prints what it deleted.
  2. `reset-database`: drops everything and applies the single migration.
  3. `rebuild-sign-requests <network>`: recomputes the aggregate table from the events.
  4. `audit <network>`: stage 05's audit as a command with a non-zero exit on a difference.
  5. A scheduled audit inside the ingester process at a configurable interval, off by default,
     that halts the network on a difference.
  6. Integration tests for each, including: a reset of one network leaves another untouched, and
     a changed deployment (new signer address in configuration) is refused at start-up until the
     reset is run, after which indexing starts from the new start block.
- **Exit check:** `yarn check` and `yarn test:integration` pass. Each command is run once against
  the local database and its output quoted (run the destructive ones on a scratch database).
- **Report must include:** the command lines.

### Step 06.2: failure cases

- **Stream / model:** `ingest` / `fable`
- **Waits on:** nothing
- **Runs in:** main worktree
- **Packs:** `midnight-indexer.md`, `signet-domain.md`, `backend-conventions.md`
- **Scope:** `packages/backend` ingestion and chain source, and their tests
- **Context:** heavy
- **Goal:** Every failure case on the list has a test and a defined behaviour.
- **Work:**
  1. Take the list the orchestrator copied here from stage 05's review. At least: the indexer
     unreachable for a long time, throttling, the database unreachable mid-range, the head going
     backwards, a block with more events than one page, an event with a name or payload at the
     size limits, a halted network being resumed.
  2. For each: decide the behaviour (retry, halt, or continue), make it so, test it with the fake
     chain source.
  3. A halted network resumes by an explicit `resume <network>` command or a restart, never on
     its own for a halt caused by an invariant violation. A halt caused by the source being away
     resumes on its own when it returns. Make the two kinds distinct in `halt_reason` and in the
     Network service's reply.
  4. Log lines for every halt and resume.
- **Exit check:** `yarn check` and `yarn test:integration` pass. The report maps each failure
  case to its test.
- **Report must include:** any case judged not worth handling, with the reason, for the user.

### Step 06.3: protect the public endpoints

- **Stream / model:** `host` / `opus`
- **Waits on:** nothing
- **Runs in:** main worktree
- **Packs:** `service-pattern.md`, `backend-conventions.md`
- **Scope:** `packages/backend` host and services, and the backend manifest
- **Context:** light
- **Goal:** The two endpoints that spend someone else's quota cannot be driven by a stranger.
- **Work:**
  1. Rate limiting on the host, stricter for the Ethereum transaction output service and the
     Midnight transaction service. Use Fastify's own rate-limit plugin.
  2. The Ethereum transaction output service: bound the work per request, cache only successes,
     and coalesce concurrent requests for the same hash into one upstream call.
  3. The Midnight transaction service already serves only hashes present in the events table.
     Test that an unknown hash never reaches the chain source.
  4. Page size has a maximum. A search fragment has a minimum and a maximum length.
  5. Tests through `inject` for each limit.
- **Exit check:** `yarn check` passes. Each limit has a test that exceeds it.
- **Report must include:** the limits chosen and the dependency added.

### Step 06.4: the remaining networks

- **Stream / model:** `ingest` / `opus`
- **Waits on:** 06.2
- **Runs in:** main worktree
- **Packs:** `signet-domain.md`, `midnight-indexer.md`, `backend-conventions.md`,
  `ui-codebase.md`
- **Scope:** `packages/backend` configuration, `packages/ui` network handling, tests
- **Context:** light
- **Goal:** Undeployed, preview and mainnet work in code and are tested as far as they can be
  without the real thing.
- **Work:**
  1. Configuration tests for each network: complete configuration starts an ingester, incomplete
     configuration lists the network as not configured, a Blockfrost project id builds the right
     URL per network, an explicit indexer URL overrides it.
  2. `undeployed`: an explicit indexer URL, `start_block` 0 by default, addresses and root key
     required from configuration. Run the backend against the fake chain source configured as
     `undeployed` end to end.
  3. Two networks at once: an integration test with two fake sources, checking isolation of
     data, checkpoints and halts, and that the UI's network switch shows each.
  4. Look for a local Midnight stack on this machine (`docker ps`, the demo's documentation). If
     one can be started without changing how the machine runs, ask the orchestrator before
     starting it. Otherwise leave `undeployed` in "To be tested".
- **Exit check:** `yarn check` and `yarn test:integration` pass.
- **Report must include:** exactly what remains untested for each of the three networks, worded
  for the user.

### Step 06.5: the backend image and the local stack as a whole

- **Stream / model:** `workspace` / `opus`
- **Waits on:** nothing
- **Runs in:** main worktree
- **Packs:** `checks-and-tooling.md`, `backend-conventions.md`
- **Scope:** root `Dockerfile` (or a second Dockerfile), `docker/`, `.dockerignore`,
  `compose.yaml`
- **Context:** light
- **Goal:** Two images from one repository, and a compose profile that runs the whole thing.
- **Work:**
  1. Adding a second image reopens the first one's names: the existing `Dockerfile`, image name
     and README section describe "the explorer" as the UI alone. Name both by what they are.
  2. The backend image: installs from the lockfile, carries production dependencies and the
     `drizzle` folder, runs the migration command and the server as separate commands, runs as a
     non-root user.
  3. A compose profile that runs Postgres, the backend and the UI image together, off by
     default, so `stack:up` still starts Postgres alone.
  4. Build both images. Run the profile. Smoke test the UI it serves, in real mode.
- **Exit check:** both images build, the profile comes up healthy, the smoke test passes against
  it, `docker ps` afterwards shows nothing left running that this step started.
- **Report must include:** image names, and the lines of the publish workflow stage 07 must change.

### Step 06.6: independent review

- **Stream / model:** `review` / `fable`, fresh
- **Waits on:** 06.1 to 06.5
- **Runs in:** main worktree, read only
- **Packs:** all
- **Scope:** none
- **Context:** heavy
- **Goal:** Try to break it as an operator and as a stranger on the internet.
- **Work:**
  1. Operator: can a reset run against the wrong network or with an ingester running? Can a
     start-up erase data? Is every halt visible?
  2. Stranger: can any endpoint be used to spend quota, read a secret, or make the database do
     unbounded work?
  3. Run the stage exit check.
- **Exit check:** findings with a concrete scenario each, or "none".
- **Report must include:** findings ranked by severity.

## Gates

| Gate | Question | Fallback |
| --- | --- | --- |
| G14 | Is there a local Midnight stack this machine can run for `undeployed`? | It stays in "To be tested" |

## Stage exit check

1. `yarn install --immutable && yarn check && yarn build`, stack down.
2. `yarn stack:restart && yarn test:integration`.
3. Backend started on preprod, caught up, `audit preprod` clean.
4. Smoke in real mode against the dev server and against the compose profile.
5. `reset-network preprod` on a scratch copy, then re-index, then `audit` clean.

## Checkpoint

Commit and push. Mark stage 06 `done`. Update `index.md` "To be tested" from step 06.4's report.
Update the packs with the commands. Check stage 07.
