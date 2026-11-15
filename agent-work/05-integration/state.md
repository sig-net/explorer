# Stage 05 state

Rewritten by the orchestrator at every dispatch and every report. Always true right now.

- **Stage status:** pending
- **Last good commit:** none yet
- **Waiting on the user:** nothing

## Steps

| Step | Status | Agent (stream, model, id) | Worktree and branch | Notes |
| --- | --- | --- | --- | --- |
| 05.1 first full index of preprod | waiting | | | |
| 05.2 audit against an independent read | waiting | | | |
| 05.3 the UI on the real backend | waiting | | | |
| 05.4 measure | waiting | | | |
| 05.5 independent review | waiting | | | |

Status values: `waiting`, `running`, `reported` (reply received, exit check not yet run by the
orchestrator), `done`, `redo`.

## Roster

| Stream | Model | Agent id | Steps done | Status |
| --- | --- | --- | --- | --- |

Status values: `alive`, `retired (<reason>)`.

## Open worktrees

| Path | Branch | For step | Merged |
| --- | --- | --- | --- |
