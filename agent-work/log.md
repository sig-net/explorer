# Log

Append only, written by `agent-work`. Newest at the bottom.

## 1 PLAN
at most 2 step(s) side by side: 4764 MB available of 7862, no swap, 8 processors: one step per 2 GB

## 2 RECOVERY
Fresh start: no step dispatched yet, log empty, limit set to 2

## 3 PLAN
at most 3 step(s) side by side: 4764 MB available, and stage 01 says 01.1 and 01.2 start no process while 01.3 runs one Node process: three fit

## 4 GATE
D26 (keep each request's raw transaction bytes in the database, about 6 GB a year per network) is still planner (unconfirmed): lint refuses every dispatch until the user confirms or rejects it

## 5 DECISION
D26 confirmed by the user in the session: raw transaction bytes are kept in the database

## 6 DISPATCH 01.1
model fable, branch bernard-01-1, worktree /home/brbussy/Projects/github.com/sig-net/explorer-bernard-01-1

## 7 DISPATCH 01.2
model opus, branch bernard-01-2, worktree /home/brbussy/Projects/github.com/sig-net/explorer-bernard-01-2

## 8 DISPATCH 01.3
model opus, branch bernard-01-3, worktree /home/brbussy/Projects/github.com/sig-net/explorer-bernard-01-3

## 9 REPORT 01.2
DONE, kept in reports/01.2-1.md

## 10 CHECK 01.2
PASS, exit 0 at b9474cd, output in evidence/01.2-1.txt

## 11 REPORT 01.1
DONE, kept in reports/01.1-1.md

## 12 ACCEPT 01.2
merged bernard-01-2 as 3ce3f20

## 13 CHECK 01.1
PASS, exit 0 at d7c9bef, output in evidence/01.1-1.txt

## 14 ACCEPT 01.1
merged bernard-01-1 as 8a83e95

## 15 REPORT 01.3
DONE, kept in reports/01.3-1.md

## 16 CHECK 01.3
PASS, exit 0 at 28402a5, output in evidence/01.3-1.txt

## 17 ACCEPT 01.3
merged bernard-01-3 as 8580093

## 18 DECISION
D27 gate A7: no margin for late events (0 late, 0 vanished)

## 19 DECISION
D28 gate A8: tipMargin defaults to 6 blocks (tip ahead of finality by 1, no hash mismatch)

## 20 DECISION
D29 gate A10: 30 second poll stands (1911 calls, all 200)

## 21 CHECK 01-ground
PASS, exit 0 at 8580093, output in evidence/01-ground-1.txt

## 22 CHECKPOINT 01-ground
stage done at 8580093

## 23 PLAN 02-workspace
re-planned against the stages before it, and confirmed

## 24 DISPATCH 02.1
model opus, branch bernard-02-1, worktree /home/brbussy/Projects/github.com/sig-net/explorer-bernard-02-1

## 25 REPORT 02.1
DONE, kept in reports/02.1-1.md

## 26 CHECK 02.1
PASS, exit 0 at e959f01, output in evidence/02.1-1.txt

## 27 ACCEPT 02.1
merged bernard-02-1 as 0c17b75

## 28 PLAN
Added step 02.4 (find and fix the cause of the excluded callers filter test timing out about 1 in 10 full runs, present on base fc68397), 02.3 now waits on it

## 29 DISPATCH 02.2
model opus, branch bernard-02-2, worktree /home/brbussy/Projects/github.com/sig-net/explorer-bernard-02-2

## 30 DISPATCH 02.4
model opus, branch bernard-02-4, worktree /home/brbussy/Projects/github.com/sig-net/explorer-bernard-02-4

## 31 PACK
core.md: paths moved to packages/ui, the 1 in 10 test timeout, any-depth .dockerignore patterns, silent yarn lint (from 02.1's report, verified by a subagent)

## 32 REPORT 02.2
DONE, kept in reports/02.2-1.md

## 33 CHECK 02.2
FAIL, exit 1 at e67655a, output in evidence/02.2-1.txt

## 34 REPORT 02.4
DONE, kept in reports/02.4-1.md

## 35 CHECK 02.4
PASS, exit 0 at 0b6d0a8, output in evidence/02.4-1.txt

## 36 PLAN
02.4 check and scope named packages/ui/vitest.config.ts, which does not exist: now packages/ui/vite.config.ts. The retry guard run by hand against the step branch finds nothing

## 37 ACCEPT 02.4
merged bernard-02-4 as 53ef0ad

## 38 PACK
ui.md: where the Vitest config is, waiting for a Base UI popup to unmount, the combobox input-clear reason. core.md: yarn install in a new worktree, vite beside vitest (from the reports of 02.2 and 02.4)

## 39 REPORT 02.2
DONE, kept in reports/02.2-2.md

## 40 CHECK 02.2
PASS, exit 0 at e28b444, output in evidence/02.2-2.txt

## 41 ACCEPT 02.2
merged bernard-02-2 as e924a47

## 42 DISPATCH 02.3
model opus, branch bernard-02-3, worktree /home/brbussy/Projects/github.com/sig-net/explorer-bernard-02-3

## 43 REPORT 02.3
DONE, kept in reports/02.3-1.md

## 44 CHECK 02.3
PASS, exit 0 at d339a38, output in evidence/02.3-1.txt

## 45 CHECK 02.3
PASS, exit 0 at 7160429, output in evidence/02.3-2.txt

## 46 PACK
ui.md and core.md: what lib holds after 02.3 and the two UI types that take StoredSignetMiscEvent (from 02.3's report)

## 47 ACCEPT 02.3
merged bernard-02-3 as 3923d6a

## 48 CHECK 02-workspace
PASS, exit 0 at 3923d6a, output in evidence/02-workspace-1.txt

## 49 CHECKPOINT 02-workspace
stage done at 3923d6a
