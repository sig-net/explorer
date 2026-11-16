# Decisions

Append only. An agent that disagrees with an entry reports it and never acts against it.

`Decided by` is `user`, `planner` for how the thing is built, `planner (unconfirmed)` for what changes what the user gets until they have confirmed it, then `planner (confirmed)`, or `orchestrator` during execution.

| No. | Decision | Why | Decided by |
| --- | --- | --- | --- |
