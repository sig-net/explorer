# agent-work: index

This folder holds everything an orchestrator needs to run a swarm of agents through ONE task.
It is written for agents. It is removed before the branch is merged.

## The task

Give the explorer a backend. The browser stops reading the Midnight indexer itself. A long-running
Node service reads every Signet event of every configured network into Postgres with no gaps, and
serves it over HTTP. The UI reads the backend and keeps doing all verification itself. The
repository becomes a Yarn workspace monorepo: `packages/ui`, `packages/backend`, `packages/api`,
`packages/lib`.

- Repository: `sig-net/explorer`
- Branch: `upgrade-protocol` (work is committed and pushed here directly)
- Main worktree: `/home/brbussy/Projects/github.com/sig-net/explorer-upgrade-protocol`
- Baseline commit (before any agent work): `e0c1309`

## If you are a new orchestrator, start here

1. Read `orchestrator.md` in full. It is the runbook, and it includes the recovery procedure.
2. Find the current stage in the table below (the first one that is not `done`).
3. Read that stage's `state.md`, then its `plan.md`, then the tail of its `log.md`.
4. Read `decisions.md`. Never reopen a decision recorded there without the user.
5. Follow the recovery procedure in `orchestrator.md` before dispatching anything.

## Stages

Stages run in series. Steps inside a stage may run in parallel, as that stage's plan says.
A stage is `done` only when its exit check passed when the orchestrator ran it, the result is
committed and pushed, and this table is updated in that same commit.

| No. | Folder | What it delivers | Status | Checkpoint commit |
| --- | --- | --- | --- | --- |
| 01 | `01-assumptions/` | Agent machinery proven, every assumption the design rests on tested, gates decided | pending | |
| 02 | `02-workspaces/` | Monorepo with four packages, UI behaviour unchanged | pending | |
| 03 | `03-contracts-and-schema/` | Shared domain in `lib`, the `api` contract with fakes, the database schema and local stack | pending | |
| 04 | `04-backend-and-ui/` | Ingester and HTTP services on real Postgres, UI rebuilt on the `api` fakes | pending | |
| 05 | `05-integration/` | UI on the real backend against preprod, audited and measured | pending | |
| 06 | `06-hardening/` | Audit, resets, start-up guards, remaining networks, backend image | pending | |
| 07 | `07-release-wiring-and-close/` | Docs, repo rules, workflows, final review, hand-back to the user | pending | |

Status values: `pending`, `running`, `done`, `blocked` (waiting on the user, with the reason in
the stage's `state.md`).

## Shared documents

| File | What it is | Who changes it |
| --- | --- | --- |
| `orchestrator.md` | Runbook: recovery, dispatch, reuse, escalation, user gates | Orchestrator, rarely |
| `architecture.md` | The design the user settled | Orchestrator, only after a gate or a user decision |
| `decisions.md` | What was decided and why | Orchestrator, append only |
| `knowledge/` | Packs that seed subagents | Orchestrator, after every step report |
| `templates/` | Shapes of the stage documents and the step report | Nobody during execution |

## To be tested (carried to the end of the task)

Things built but not exercised, because the means to test them do not exist yet. The final stage
hands this list to the user. Add to it whenever a step ships something untested.

- Preview network: no Blockfrost project id, and the SDK publishes no Signet contracts for it.
- Mainnet network: no Blockfrost project id, and the SDK publishes no Signet contracts for it.
- Undeployed (local) network: needs a local Midnight stack with its own indexer and MPC.
