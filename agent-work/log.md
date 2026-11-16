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

## 50 PLAN 03-contract
re-planned against the stages before it, and confirmed

## 51 HANDOVER
Stage 03 is revised and confirmed, nothing of it is dispatched. For the planner of stage 04: reconcile step 04.1's inspectionForStorage with D34 (one request cell per sign bidirectional event), and put D28 (tipMargin 6 blocks) into step 04.2. For the closing report to the user: the workflow lines 02.1's report lists (pages-deploy.yml 81 and 84, docker-publish.yml 1, 72 and 108), moving .env.local to packages/ui (D31), the daily Blockfrost quota of about 11,000 requests a network to confirm, 02.1 and 02.2 accepted with --retried for the excluded callers filter defect that 02.4 fixed in the component. Limit is 3 on a machine with 8 processors and about 4.5 GB available: measure again.

## 52 PLAN
at most 2 step(s) side by side: 8 processors, 4475 MB available of 7862, no swap: one step per 2 GB

## 53 RECOVERY
fresh orchestrator after handover: stage 03 confirmed, nothing dispatched, no step running, limit set to 2

## 54 DISPATCH 03.1
model fable, branch bernard-03-1, worktree /home/brbussy/Projects/github.com/sig-net/explorer-bernard-03-1

## 55 REPORT 03.1
DONE, kept in reports/03.1-1.md

## 56 CHECK 03.1
PASS, exit 0 at 8823894, output in evidence/03.1-1.txt

## 57 DECISION
D35: the domain inspection keeps requestCell beside the decoded request

## 58 PACK
backend.md: versions of zod and hono, lib exports, the api package's entries, routes prefix and error ownership, D35, redactUrlQuery (from 03.1's report)

## 59 PLAN
03.2: the path of its exit check written in full

## 60 ACCEPT 03.1
merged bernard-03-1 as 991a8d3

## 61 DISPATCH 03.2
model fable, branch bernard-03-2, worktree /home/brbussy/Projects/github.com/sig-net/explorer-bernard-03-2

## 62 REPORT 03.2
DONE, kept in reports/03.2-1.md

## 63 CHECK 03.2
PASS, exit 0 at 016a9f8, output in evidence/03.2-1.txt

## 64 PACK
backend.md: column types, openDatabase, migrate.ts, the seed and the in-memory source. core.md: yarn check needs a PostgreSQL. A5 holds numbers and no script (from 03.2's report)

## 65 PLAN
open after 03.2: requests.caller holds one caller while the api's in-memory service answers search, exclusion and callers() from every caller of a lifecycle. Left for review 03.3 to judge. If it does not raise it, it goes to the planner of stage 04 as a requirement

## 66 ACCEPT 03.2
merged bernard-03-2 as 6834aad

## 67 DISPATCH 03.3
model fable, branch none, worktree /home/brbussy/Projects/github.com/sig-net/explorer-upgrade-protocol

## 68 REPORT 03.3
DONE, kept in reports/03.3-1.md

## 69 CHECK 03.3
PASS, exit 0 at 6ee98b5, output in evidence/03.3-1.txt

## 70 DECISION
D36 to D39: review 03.3's two blocking findings closed by request_callers and matchingEvents, the stored inspection per notification, the source URL without credentials

## 71 PLAN
added 03.4 (fix of the two blocking findings), 03.5 (advisory fixes: sync state CHECK, D38, D39, sourceUrl doc) and 03.6 (review of 03.4 alone). Each check seen failing on the parent at 6ee98b5. stage.sh runs 03.4 and 03.5. For the planner of stage 04, from review 03.3: escape %, _ and backslash in the served LIKE search. Count on requests and never through the view (1466 ms against 7 ms). totalEvents as an index scan of events grows with the table, 18 ms at 200,000 requests. The cursor condition is written IS NOT DISTINCT FROM since the cursor starts null. The ingest needs a rebuild-and-compare test of requests against events, and a requests row with no event fails the whole page. With signer and responder as one contract the adaptor merges events by id. last_error and inspection.failed reach the browser unfiltered: strip URLs and tokens from them. The service step reruns the review's timings on its own statements. For the user at the end: one event the browser cannot decode rejects the whole page (wire.ts:179)

## 72 PACK
backend.md and core.md: redactUrlQuery, the api entry, raw sql fragments, scratch imports, the report budget (from 03.3's report)

## 73 ACCEPT 03.3
nothing to merge
