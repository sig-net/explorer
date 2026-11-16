#!/bin/bash
# Exit check of step 05.2: the live run's output shows no gap, a clean resume and a UI that
# reads the backend alone.
set -euo pipefail
f=agent-work/probes/live-preprod.out.json
test -f "$f" || { echo "$f is missing: the live run has not ended" >&2; exit 1; }
! grep -q project_id "$f" || { echo "the output carries the token" >&2; exit 1; }
node - "$f" <<'JS'
const s = JSON.parse(require('node:fs').readFileSync(process.argv[2], 'utf8'))
const fail = (m) => { console.error(m); process.exit(1) }
if (!(s.storedEvents > 15000)) fail(`only ${s.storedEvents} events stored: preprod held 15,136 when the plan was written`)
if (s.storedEvents !== s.indexerEvents) fail(`stored ${s.storedEvents} events, the indexer has ${s.indexerEvents} over the same blocks`)
if (!(s.killedAtBlock > s.startBlock) || s.killedBeforeSynced !== true) fail('the backend was not killed between its first commit and the tip')
if (s.logLinesWithToken !== 0) fail('the backend logged the token')
if (s.state !== 'synced') fail(`the network ended ${s.state}`)
if (!(s.uiRows >= 50)) fail(`the UI rendered ${s.uiRows} rows, 50 are expected`)
if (s.uiExpandedRowVerified !== true) fail('the expanded row did not show a verified signature')
if (s.uiRequestsToMidnight !== 0) fail(`the browser sent ${s.uiRequestsToMidnight} requests to a Midnight indexer or node`)
JS
