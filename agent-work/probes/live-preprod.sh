#!/bin/bash
# The live run of step 05.2: the backend image against preprod from the contracts' deployment to
# the tip, killed once on the way, then the built UI against it. Writes live-preprod.out.json and
# live-preprod.png beside this file. Run from the repository root. Takes up to 45 minutes.
set -euo pipefail
here=agent-work/probes
id="$(dev-secrets get MIDNIGHT_PREPROD_BLOCKFROST_PROJECT_ID)"
IDX="https://midnight-preprod.blockfrost.io/api/v0?project_id=$id"
run="explorer-live-$$"
ui_port=$((20000 + RANDOM % 10000))
preview_pid=''
cleanup() {
  test -z "$preview_pid" || kill "$preview_pid" 2>/dev/null || true
  docker rm -f "$run-backend" "$run-pg" >/dev/null 2>&1 || true
  docker network rm "$run" >/dev/null 2>&1 || true
  docker rmi "$run-image" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker network create "$run" >/dev/null
docker run -d --name "$run-pg" --network "$run" -e POSTGRES_PASSWORD=live postgres:17 >/dev/null
until docker exec "$run-pg" psql -U postgres -h 127.0.0.1 -c 'select 1' >/dev/null 2>&1; do sleep 0.5; done
docker build -q -f packages/backend/Dockerfile -t "$run-image" . >/dev/null
sql() { docker exec "$run-pg" psql -U postgres -h 127.0.0.1 -At -c "$1"; }
start_backend() {
  docker run -d --name "$run-backend" --network "$run" -p 127.0.0.1::8080 \
    -e EXPLORER_DATABASE_URL="postgres://postgres:live@$run-pg:5432/postgres" \
    -e EXPLORER_CORS_ORIGINS="http://127.0.0.1:$ui_port" -e EXPLORER_MIDNIGHT_NETWORKS=preprod \
    -e EXPLORER_MIDNIGHT_PREPROD_INDEXER_URL="$IDX" -e EXPLORER_POLL_INTERVAL_SECONDS=5 "$run-image" >/dev/null
  api="http://127.0.0.1:$(docker port "$run-backend" 8080/tcp | head -1 | sed 's/.*://')"
}
sync_field() { curl -s "$api/v1/networks" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).networks.find(n=>n.network==='preprod').sync.$1 ?? '')}catch{console.log('')}})"; }

started=$(date +%s)
start_backend
# Kill it without warning once it has committed a first range and is still far from the tip.
start_block="$(until sql 'select start_block from midnight_preprod.ingest_state' 2>/dev/null | grep -E '^[0-9]+$'; do sleep 1; done | head -1)"
until test "$(sql 'select cursor_height from midnight_preprod.ingest_state')" -gt "$start_block"; do sleep 0.2; done
docker kill -s KILL "$run-backend" >/dev/null
killed_at="$(sql 'select cursor_height from midnight_preprod.ingest_state')"
killed_before_synced=false
test "$(sql "select coalesce(tip_height, 0) - cursor_height > 1000 from midnight_preprod.ingest_state")" = t && killed_before_synced=true
docker rm "$run-backend" >/dev/null
start_backend
for _ in $(seq 500); do test "$(sync_field state)" = synced && break; sleep 5; done
state="$(sync_field state)"
seconds=$(( $(date +%s) - started ))

VITE_EXPLORER_API_URL="$api" yarn workspace @sig-net/explorer-ui build >/dev/null
yarn workspace @sig-net/explorer-ui vite preview --host 127.0.0.1 --port "$ui_port" --strictPort >/dev/null 2>&1 &
preview_pid=$!
sleep 3
ui="$(UI_URL="http://127.0.0.1:$ui_port/" SHOT="$here/live-preprod.png" node "$here/live-ui.mjs")"

docker stop -t 15 "$run-backend" >/dev/null
processed="$(sql 'select cursor_height from midnight_preprod.ingest_state')"
stored="$(sql 'select count(*) from midnight_preprod.events')"
requests="$(sql 'select count(*) from midnight_preprod.requests')"
indexer="$(IDX="$IDX" FROM="$start_block" TO="$processed" node "$here/count-events.mjs")"
leaked="$(docker logs "$run-backend" 2>&1 | grep -c project_id || true)"

node -e "
const ui = JSON.parse(process.argv[1])
console.log(JSON.stringify({ state: process.argv[2], startBlock: +process.argv[3], processedBlock: +process.argv[4],
  killedAtBlock: +process.argv[5], killedBeforeSynced: process.argv[6] === 'true', storedEvents: +process.argv[7],
  indexerEvents: +process.argv[8], storedRequests: +process.argv[9], secondsToSynced: +process.argv[10],
  logLinesWithToken: +process.argv[11], ...ui }, null, 2))
" "$ui" "$state" "$start_block" "$processed" "$killed_at" "$killed_before_synced" "$stored" "$indexer" "$requests" "$seconds" "$leaked" | tee "$here/live-preprod.out.json"
