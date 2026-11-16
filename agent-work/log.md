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
