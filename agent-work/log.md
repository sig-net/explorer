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

## 74 DISPATCH 03.4
model fable, branch bernard-03-4, worktree /home/brbussy/Projects/github.com/sig-net/explorer-bernard-03-4

## 75 REPORT 03.4
DONE, kept in reports/03.4-1.md

## 76 CHECK 03.4
PASS, exit 0 at b2ada30, output in evidence/03.4-1.txt

## 77 PACK
backend.md: VACUUM before a GIN plan, EXPLAIN tests at 20,000 rows, the view follows requests, request_callers, matchingEvents (from 03.4's report)

## 78 PLAN
for the planner of stage 04, from 03.4: the lifecycle event count is written twice (api testing.ts and the UI's signBidirectionalLifecycleEventCount) and belongs in packages/lib once the service is the third user. A backfilled database needs VACUUM before caller search uses its index

## 79 ACCEPT 03.4
merged bernard-03-4 as 47ac04e

## 80 DISPATCH 03.5
model fable, branch bernard-03-5, worktree /home/brbussy/Projects/github.com/sig-net/explorer-bernard-03-5

## 81 DISPATCH 03.6
model fable, branch none, worktree /home/brbussy/Projects/github.com/sig-net/explorer-upgrade-protocol

## 82 REPORT 03.5
DONE, kept in reports/03.5-1.md

## 83 CHECK 03.5
PASS, exit 0 at b885362, output in evidence/03.5-1.txt

## 84 PACK
split backend.md, over its budget: the facts about the api package and the schema as built are the new pack contract.md, added to every step of stages 04 and 05 that reads backend

## 85 ACCEPT 03.5
merged bernard-03-5 as 24b9136

## 86 REPORT 03.6
DONE, kept in reports/03.6-1.md

## 87 REPORT 03.6
DONE, kept in reports/03.6-2.md

## 88 CHECK 03.6
PASS, exit 0 at 84bd834, output in evidence/03.6-1.txt

## 89 DECISION
D40: the gate of stage 3 is closed, review 03.6 found nothing blocking

## 90 PLAN
for the planner of stage 04, from review 03.6 at 200,000 requests: the UNION form of the search (pages 1.4 to 7.3 ms, counts under 3 ms) against the OR form (55 to 103 ms), and the UNION form loses on a fragment matching 80,000 requests (129 ms). A fragment of 1 or 2 characters has no trigram: counts took up to 1006 ms, so decide a minimum length or a bounded count. Every page carries four counts that read a growing table in full (matchingRequests, matchingEvents, totalRequests 5 to 9 ms, totalEvents 25 ms): keep totals in a maintained row or accept. Exclusion counts scan requests (18 to 45 ms). Distinct callers scan request_callers (23 ms at 260,000 rows). request_callers does not say which event named a caller and its foreign key has no ON DELETE: matters only if the ingest ever removes an event. The lifecycle event sum has three copies (api testing.ts, contract.test.ts eventsOf, the UI). architecture.md now lists request_callers

## 91 PACK
contract.md: the UNION search form, LIKE escaping, with_postgres and its trap (from 03.6's report)

## 92 ACCEPT 03.6
nothing to merge

## 93 CHECK 03-contract
PASS, exit 0 at 84bd834, output in evidence/03-contract-1.txt

## 94 CHECKPOINT 03-contract
stage done at 84bd834

## 95 PLAN 04-build
re-planned against the stages before it, and confirmed

## 96 PLAN
04-build re-planned by a fresh planner and confirmed: 04.9 (contract amendments) and 04.10 (the ingest loop, split from 04.2) added, D41 to D50. For the closing report: D41, a search under 3 characters is no search

## 97 DISPATCH 04.1
model opus, branch bernard-04-1, worktree /home/brbussy/Projects/github.com/sig-net/explorer-bernard-04-1

## 98 DISPATCH 04.9
model fable, branch bernard-04-9, worktree /home/brbussy/Projects/github.com/sig-net/explorer-bernard-04-9

## 99 REPORT 04.9
DONE, kept in reports/04.9-1.md

## 100 CHECK 04.9
PASS, exit 0 at e467605, output in evidence/04.9-1.txt

## 101 PACK
contract.md: starting a PostgreSQL for a step, where the D47 cut applies, oxfmt's last line (from 04.9's report)

## 102 ACCEPT 04.9
merged bernard-04-9 as c84be07

## 103 DISPATCH 04.2
model fable, branch bernard-04-2, worktree /home/brbussy/Projects/github.com/sig-net/explorer-bernard-04-2

## 104 REPORT 04.1
DONE, kept in reports/04.1-1.md

## 105 CHECK 04.1
PASS, exit 0 at 9d09a85, output in evidence/04.1-1.txt

## 106 PACK
indexer.md: the SDK's fetch takes no AbortSignal, the adaptor's module and timeout constant. core.md: three lint rules on tests (from 04.1's report)

## 107 PLAN
from 04.1, for the configuration step and review 04.8: INDEXER_REQUEST_TIMEOUT_MS lives in indexer-source.ts while D50 puts defaults in the configuration, and the cell to RequestCellWire conversion has two copies (backend inspection, api wire.ts)

## 108 ACCEPT 04.1
merged bernard-04-1 as 06dca97

## 109 DISPATCH 04.3
model opus, branch bernard-04-3, worktree /home/brbussy/Projects/github.com/sig-net/explorer-bernard-04-3

## 110 REPORT 04.2
DONE, kept in reports/04.2-1.md

## 111 CHECK 04.2
PASS, exit 0 at eae6769, output in evidence/04.2-1.txt

## 112 DECISION
D51: a stopped network resumes when its identity matches its configuration again. For the closing report: it reads D12 by its reason, the user may want a stop to hold until a wipe

## 113 PACK
contract.md: runIngestCycle's shapes and outcomes, Kysely facts, failNextCall (from 04.2's report)

## 114 PLAN
the open steps of stage 04 name their checks by full path. For review 04.8, from 04.2: the cursor update is conditional on the cursor alone, the caught-up and stop updates run outside a transaction, and an event from a block outside the asked range is stored as served

## 115 ACCEPT 04.2
merged bernard-04-2 as 443843b

## 116 DISPATCH 04.4
model opus, branch bernard-04-4, worktree /home/brbussy/Projects/github.com/sig-net/explorer-bernard-04-4

## 117 REPORT 04.3
DONE, kept in reports/04.3-1.md

## 118 CHECK 04.3
PASS, exit 0 at 676453f, output in evidence/04.3-1.txt

## 119 REPORT 04.4
DONE, kept in reports/04.4-1.md

## 120 PACK
core.md: valid-expect, the verbose reporter, decodable synthetic payloads (from 04.3's report)

## 121 DECISION
gate of stage 04, the timed tests of 04.3: they hold, 18 to 31 ms a statement at 200,000 requests against the bound of 500 ms. D42 and D43 stand

## 122 ACCEPT 04.3
merged bernard-04-3 as 49d07aa

## 123 CHECK 04.4
PASS, exit 0 at 872fbe8, output in evidence/04.4-1.txt

## 124 PACK
backend.md: the SDK's address getters, hono cors on preflights, parseBackendEnv and the health endpoints (from 04.4's report)

## 125 PLAN
for steps 04.5 to 04.7 and review 04.8, from 04.4: the Blockfrost indexer URL and the preprod start block are in the backend's configuration and in the UI's network.ts, and the UI's copies go when the UI stops reading the indexer

## 126 ACCEPT 04.4
merged bernard-04-4 as ec45953

## 127 DISPATCH 04.5
model opus, branch bernard-04-5, worktree /home/brbussy/Projects/github.com/sig-net/explorer-bernard-04-5

## 128 DISPATCH 04.10
model fable, branch bernard-04-10, worktree /home/brbussy/Projects/github.com/sig-net/explorer-bernard-04-10

## 129 REPORT 04.10
DONE, kept in reports/04.10-1.md

## 130 CHECK 04.10
PASS, exit 0 at 92e0d10, output in evidence/04.10-1.txt

## 131 PACK
backend.md: the ingest loop's onOutcome, the cycle's catch, the ingest test helpers, ingest_state_check (from 04.10's report)

## 132 PLAN
for the planner of stage 05, from 04.10: pass startIngestLoop a synchronous logger as onOutcome. The backoff after the n-th failure in a row is 60, 120, 240, 300 s at the default interval

## 133 ACCEPT 04.10
merged bernard-04-10 as 3295751

## 134 DISPATCH 04.8
model fable, branch none, worktree /home/brbussy/Projects/github.com/sig-net/explorer-upgrade-protocol

## 135 REPORT 04.5
DONE, kept in reports/04.5-1.md

## 136 CHECK 04.5
PASS, exit 0 at af013c4, output in evidence/04.5-1.txt

## 137 PACK
ui.md: two lint rules, router.load in tests, where the page's tests and the api client are (from 04.5's report)

## 138 PLAN
04.7 gains the docker env script: it must forward VITE_EXPLORER_API_URL (from 04.5's report). For 05.3: the README lines 321, 325, 344, 383, 397 and 443 name things 04.5 deleted. For the closing report: a failed callers() read leaves the filter's list empty with no error shown, and the filter's empty text is No known caller matches

## 139 ACCEPT 04.5
merged bernard-04-5 as 8d493d7

## 140 DISPATCH 04.6
model opus, branch bernard-04-6, worktree /home/brbussy/Projects/github.com/sig-net/explorer-bernard-04-6

## 141 REPORT 04.8
DONE, kept in reports/04.8-1.md

## 142 REPORT 04.8
DONE, kept in reports/04.8-2.md

## 143 CHECK 04.8
PASS, exit 0 at 99fa02c, output in evidence/04.8-1.txt

## 144 DECISION
D52 and D53: review 04.8's blocking finding (a NUL in an inspection stops the network) gets fix step 04.11 and review 04.13, its advisory findings on the cursor's identity, token masking and the URL cut get step 04.12

## 145 PLAN
added 04.11, 04.12, 04.13, each check seen failing on the parent at 8d493d7. 04.7 gains the cold Vite cache fix and its check clears the cache: the UI's tests failed 2 runs of 4 on the merged parent (mid-run dependency optimisation, and timeouts under load). For the closing report, from review 04.8: the SDK's event stream ends on a short page and drops ids above the first row's maxId, so an indexer that caps pages under 100 loses events silently and only tipMargin guards a row moving between pages. A process still running with an old configuration records its identity in a wiped schema. After a lost commit answer last_error stays until the next cycle. No test covers a database that is down or a lost commit

## 146 PACK
indexer path corrected, backend.md: U+0000, ui.md: the cold Vite cache (from review 04.8 and my own runs)

## 147 ACCEPT 04.8
nothing to merge
