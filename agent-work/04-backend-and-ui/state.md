# Stage 04 state

Rewritten by the orchestrator at every dispatch and every report. Always true right now.

- **Stage status:** pending
- **Last good commit:** none yet
- **Waiting on the user:** nothing

## Steps

| Step | Status | Agent (stream, model, id) | Worktree and branch | Notes |
| --- | --- | --- | --- | --- |
| 04.1 the chain source | waiting | | | |
| 04.2 repositories | waiting | | | |
| 04.3 the ingester | waiting | | | |
| 04.4 services, HTTP host and configuration | waiting | | | |
| 04.5 composition and the backend running end to end on a fake chain | waiting | | | |
| 04.6 the UI's data layer on the services | waiting | | | |
| 04.7 the UI's components | waiting | | | |
| 04.8 independent review | waiting | | | |

Status values: `waiting`, `running`, `reported` (reply received, exit check not yet run by the
orchestrator), `done`, `redo`.

## Roster

| Stream | Model | Agent id | Steps done | Status |
| --- | --- | --- | --- | --- |

Status values: `alive`, `retired (<reason>)`.

## Open worktrees

| Path | Branch | For step | Merged |
| --- | --- | --- | --- |
