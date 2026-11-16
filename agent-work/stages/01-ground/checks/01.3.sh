#!/bin/bash
# Exit check of step 01.3: the soak ran its full length and its summary is complete.
set -euo pipefail
f=agent-work/probes/indexer-soak.out.json
test -f "$f" || { echo "$f is missing: the soak has not run to its end" >&2; exit 1; }
node - "$f" <<'JS'
const s = JSON.parse(require('node:fs').readFileSync(process.argv[2], 'utf8'))
const fail = (m) => { console.error(m); process.exit(1) }
for (const k of ['polls', 'failedPolls', 'lateEvents', 'vanishedEvents', 'tipAheadOfFinalityMaxBlocks', 'tipHashMismatches', 'calls', 'eventsFirstRead', 'eventsSecondRead'])
  if (typeof s[k] !== 'number') fail(`the summary lacks ${k}`)
if (s.durationMinutes < 30) fail(`the soak ran ${s.durationMinutes} minutes, 30 are asked`)
if (s.polls < 200) fail(`only ${s.polls} polls answered: too few to judge`)
if (s.toBlock - s.fromBlock < 200) fail('fewer than 200 blocks were covered')
JS
