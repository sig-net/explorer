# Stage 01 state

Rewritten by the orchestrator at every dispatch and every report. Always true right now.

- **Stage status:** pending
- **Last good commit:** none yet
- **Waiting on the user:** nothing

## Steps

| Step | Status | Agent (stream, model, id) | Worktree and branch | Notes |
| --- | --- | --- | --- | --- |
| 01.1 prove the agent machinery | waiting | | | |
| 01.2 how the indexer behaves | waiting | | | |
| 01.3 the Node runtime for the backend | waiting | | | |
| 01.4 the EVM trace fallback and the MPC output cache from Node | waiting | | | |
| 01.5 can this machine push a workflow change | waiting | | | |
| 01.6 decide the gates and correct the plan | waiting | | | |

Status values: `waiting`, `running`, `reported` (reply received, exit check not yet run by the
orchestrator), `done`, `redo`.

## Roster

| Stream | Model | Agent id | Steps done | Status |
| --- | --- | --- | --- | --- |

Status values: `alive`, `retired (<reason>)`.

## Open worktrees

| Path | Branch | For step | Merged |
| --- | --- | --- | --- |
