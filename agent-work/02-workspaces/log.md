# Stage 02 log

Append only. Newest at the bottom. Never edit an entry: append a correction.

Entry kinds: `DISPATCH`, `REPORT`, `CHECK`, `COMMIT`, `DECISION`, `PACK`, `PLAN REVISION`,
`GATE`, `USER`, `RECOVERY`, `NOTE`.

Entry shape:

```
## <sequence number> <KIND> <step id if any>
<what happened, in a few lines. For CHECK: the command and its decisive output.
For COMMIT: the hash. For DISPATCH: stream, model, agent id, worktree.
For DECISION: also add it to ../decisions.md and name its number here.>
```

Write `DISPATCH` before sending the message to the agent. Write `REPORT` as soon as the reply
arrives, before acting on it.

---
