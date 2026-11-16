#!/bin/bash
# Exit check of step 05.7: the backend's image builds, runs as a user other than root, indexes
# preprod, logs JSON lines without the token, stops cleanly and wipes a network, and the local
# database and its scripts exist. One thing runs at a time: the repository's checks, then the image.
set -euo pipefail
source "$AGENT_WORK/lib/checks.sh"
node -e "
const scripts = require('./package.json').scripts
for (const name of ['dev:ui', 'dev:backend', 'db:up', 'db:down']) if (!scripts[name]) { console.error('the root package.json has no script ' + name); process.exit(1) }
if (scripts.dev) { console.error('the root package.json still has a bare dev script beside dev:backend'); process.exit(1) }
if (!require('./packages/backend/package.json').scripts.dev) { console.error('the backend has no dev script'); process.exit(1) }
"
test -f packages/backend/Dockerfile || { echo "packages/backend/Dockerfile is missing" >&2; exit 1; }
docker compose -f packages/backend/compose.yaml config -q || { echo "packages/backend/compose.yaml is missing or invalid" >&2; exit 1; }
docker compose -f packages/backend/compose.yaml config | grep -q '127\.0\.0\.1' || { echo "the local PostgreSQL is not published on 127.0.0.1 alone" >&2; exit 1; }
git check-ignore -q packages/backend/.env.local || { echo "packages/backend/.env.local is not ignored by git" >&2; exit 1; }
with_postgres
repo_checks

# The image, beside a PostgreSQL of its own on a network of its own. It chains onto the clean-up
# with_postgres registered, which a second trap would replace.
run="explorer-check-image-$$"
before="$(trap -p EXIT | sed -e "s/^trap -- '//" -e "s/' EXIT\$//")"
# shellcheck disable=SC2064
trap "docker rm -f -v $run-backend $run-pg >/dev/null 2>&1; docker network rm $run >/dev/null 2>&1; docker rmi $run >/dev/null 2>&1; $before" EXIT
docker build -q -f packages/backend/Dockerfile -t "$run" . >/dev/null
docker network create "$run" >/dev/null
docker run -d --name "$run-pg" --network "$run" --tmpfs /var/lib/postgresql/data -e POSTGRES_PASSWORD=check postgres:17 >/dev/null
tries=0
until docker exec "$run-pg" psql -U postgres -h 127.0.0.1 -c 'select 1' >/dev/null 2>&1; do
  tries=$((tries + 1))
  test "$tries" -lt 120 || { echo "the image's PostgreSQL did not start" >&2; exit 1; }
  sleep 0.5
done
test "$(docker run --rm --entrypoint id "$run" -u)" -ne 0 || { echo "the image runs as root" >&2; exit 1; }
with_preprod
backend_env=(--network "$run"
  -e "EXPLORER_DATABASE_URL=postgres://postgres:check@$run-pg:5432/postgres"
  -e EXPLORER_PORT=18080 -e 'EXPLORER_CORS_ORIGINS=*' -e EXPLORER_MIDNIGHT_NETWORKS=preprod
  -e "EXPLORER_MIDNIGHT_PREPROD_INDEXER_URL=$EXPLORER_TEST_PREPROD_INDEXER_URL")
docker run -d --name "$run-backend" "${backend_env[@]}" "$run" >/dev/null
get() { docker exec "$run-backend" node -e "fetch('http://127.0.0.1:18080$1').then(async r=>{console.log(r.status, (await r.text()).slice(0,400))}).catch(()=>console.log('down'))"; }
for _ in $(seq 60); do get /readyz | grep -q '^200' && break; sleep 1; done
get /healthz | grep -q '^200' || { echo "/healthz does not answer 200" >&2; exit 1; }
get /readyz | grep -q '^200' || { echo "/readyz does not answer 200" >&2; exit 1; }
get /v1/networks | grep -q '"preprod"' || { echo "/v1/networks does not list preprod" >&2; exit 1; }
# A first range of preprod is stored, so the logs below hold a cycle's line.
sql() { docker exec "$run-pg" psql -U postgres -h 127.0.0.1 -At -c "$1" 2>/dev/null || true; }
for _ in $(seq 120); do test -n "$(sql 'select cursor_height from midnight_preprod.ingest_state')" && break; sleep 1; done
test -n "$(sql 'select cursor_height from midnight_preprod.ingest_state')" || { echo "the container stored no range of preprod in two minutes" >&2; exit 1; }
docker stop -t 15 "$run-backend" >/dev/null
test "$(docker inspect -f '{{.State.ExitCode}}' "$run-backend")" -eq 0 || { echo "the container did not exit 0 on SIGTERM" >&2; exit 1; }
logs="$(docker logs "$run-backend" 2>&1)"
! grep -q 'project_id' <<< "$logs" || { echo "the logs carry the token's query string" >&2; exit 1; }
node -e "
const lines = require('node:fs').readFileSync(0, 'utf8').split('\n').filter((line) => line !== '')
if (lines.length === 0) { console.error('the container logged nothing'); process.exit(1) }
for (const line of lines) {
  let entry
  try { entry = JSON.parse(line) } catch { console.error('a log line is not JSON: ' + line.slice(0, 200)); process.exit(1) }
  for (const key of ['time', 'level', 'message']) if (typeof entry[key] !== 'string') { console.error('a log line has no ' + key); process.exit(1) }
}
if (!lines.some((line) => JSON.parse(line).network === 'preprod')) { console.error('no log line names the network preprod'); process.exit(1) }
" <<< "$logs"
docker run --rm "${backend_env[@]}" "$run" node packages/backend/src/main.ts wipe-network preprod >/dev/null ||
  { echo "wipe-network preprod did not exit 0" >&2; exit 1; }
test -z "$(sql 'select cursor_height from midnight_preprod.ingest_state')" || { echo "wipe-network left preprod's cursor in place" >&2; exit 1; }
test "$(sql "select count(*) from information_schema.tables where table_schema = 'midnight_preprod' and table_name = 'events'")" = 1 ||
  { echo "wipe-network did not migrate the schema again" >&2; exit 1; }
if docker run --rm "${backend_env[@]}" "$run" node packages/backend/src/main.ts wipe-network nosuchnetwork >/dev/null 2>&1; then
  echo "wipe-network of an unknown network exited 0" >&2; exit 1
fi
