#!/bin/bash
# Exit check of step 01.3: the soak ran its full length and its summary is complete.
set -euo pipefail
f=agent-work/probes/indexer-soak.out.json
test -f "$f" || { echo "$f is missing: the soak has not run to its end" >&2; exit 1; }
! grep -q project_id "$f" || { echo "the summary carries the token" >&2; exit 1; }
node - "$f" <<'JS'
const s = JSON.parse(require('node:fs').readFileSync(process.argv[2], 'utf8'))
const fail = (m) => { console.error(m); process.exit(1) }
for (const k of ['elapsedMinutes', 'fromBlock', 'toBlock', 'polls', 'failedPolls', 'lateEvents', 'lateEventMaxBlocksBelowTip', 'vanishedEvents', 'tipAheadOfFinalityPolls', 'tipAheadOfFinalityMaxBlocks', 'tipHashMismatches', 'calls', 'eventsFirstRead', 'eventsSecondRead'])
  if (typeof s[k] !== 'number' || Number.isNaN(s[k])) fail(`the summary lacks ${k}`)
if (s.error !== null) fail(`the second read failed: ${s.error}`)
if (typeof s.statuses !== 'object' || s.statuses === null || Object.keys(s.statuses).length === 0) fail('the summary lacks statuses')
if (s.elapsedMinutes < 30) fail(`the soak ran ${s.elapsedMinutes} minutes, 30 are asked`)
if (s.polls + s.failedPolls < 200) fail(`only ${s.polls + s.failedPolls} polls were made: too few to judge`)
if (s.toBlock - s.fromBlock < 200) fail('fewer than 200 blocks were covered')
JS
