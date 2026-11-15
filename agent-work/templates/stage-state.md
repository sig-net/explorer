# Stage NN state

Rewritten by the orchestrator at every dispatch and every report. Always true right now.

- **Stage status:** pending | running | done | blocked
- **Last good commit:** <hash on upgrade-protocol at which the baseline passed>
- **Waiting on the user:** <the question, or "nothing">

## Steps

| Step | Status | Agent (stream, model, id) | Worktree and branch | Notes |
| --- | --- | --- | --- | --- |

Status values: `waiting`, `running`, `reported` (reply received, exit check not yet run by the
orchestrator), `done`, `redo`.

## Roster

Every agent used in this stage.

| Stream | Model | Agent id | Steps done | Status |
| --- | --- | --- | --- | --- |

Status values: `alive`, `retired (<reason>)`.

## Open worktrees

| Path | Branch | For step | Merged |
| --- | --- | --- | --- |
