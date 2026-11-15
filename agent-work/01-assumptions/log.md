# Stage 01 log

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

## 0 NOTE
Planning finished. This entry records the state the planning session left behind.

- The folder `agent-work/` was written in the planning session and committed on `upgrade-protocol`
  on top of `e0c1309`. That commit is the starting point for stage 01.
- Changes outside `agent-work/` in that commit: `agent-work` added to the formatter's ignore list
  in `.oxfmtrc.json` (decision D22) and to `.dockerignore`.
- Baseline at `e0c1309`, run in planning: `yarn install --immutable` clean, `yarn check` passed
  (27 test files, 143 tests), `yarn build` passed with two `.wasm` files.
- Installed on this machine in planning: Chromium build 1243 for Playwright 1.63.0, through
  `yarn playwright install chromium`. The user has been told.
- `.env.local` at the worktree root holds `VITE_MIDNIGHT_PREPROD_BLOCKFROST_PROJECT_ID` (gitignored).
- Reference checkouts made in planning: `~/Projects/github.com/sig-net/mpc` (branch `develop`) and
  `~/Projects/github.com/sig-net/full-stack-demo-rebuild` (worktree of `bernard/rebuild`).
- No dev server, container or background process of the planning session is running.
- No subagent has been dispatched yet. Stage 01 starts at step 01.1.
