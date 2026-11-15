# Stage 03 state

Rewritten by the orchestrator at every dispatch and every report. Always true right now.

- **Stage status:** pending
- **Last good commit:** none yet
- **Waiting on the user:** nothing

## Steps

| Step | Status | Agent (stream, model, id) | Worktree and branch | Notes |
| --- | --- | --- | --- | --- |
| 03.1 fix the exact shapes | waiting | | | |
| 03.2 `lib` and `api` | waiting | | | |
| 03.3 the database | waiting | | | |
| 03.4 independent review | waiting | | | |

Status values: `waiting`, `running`, `reported` (reply received, exit check not yet run by the
orchestrator), `done`, `redo`.

## Roster

| Stream | Model | Agent id | Steps done | Status |
| --- | --- | --- | --- | --- |

Status values: `alive`, `retired (<reason>)`.

## Open worktrees

| Path | Branch | For step | Merged |
| --- | --- | --- | --- |
