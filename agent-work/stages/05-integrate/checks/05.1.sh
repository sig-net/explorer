#!/bin/bash
# Exit check of step 05.1: the composed backend passes its tests, and its image runs and stops cleanly.
set -euo pipefail
source "$AGENT_WORK/lib/checks.sh"
with_postgres
repo_checks
need_tests @sig-net/explorer-backend \
  'indexes the in-memory chain and serves it through the api client' \
  'serves what was stored before a restart and continues from the cursor' \
  'one network that stops leaves the other indexing' \
  'readyz turns 200 after the migrations' \
  'wipe-network drops one schema and the loop indexes it again' \
  'wipe-network of an unknown network drops nothing' \
  'SIGTERM ends the process cleanly'
tag="explorer-check-backend-$$"
docker build -q -f packages/backend/Dockerfile -t "$tag" . >/dev/null
pg="$(docker ps --format '{{.Names}}' | grep "explorer-check-pg-$$-" | head -1)"
with_preprod
docker run -d --name "$tag" --network "container:$pg" \
  -e EXPLORER_DATABASE_URL=postgres://postgres:check@127.0.0.1:5432/postgres \
  -e EXPLORER_PORT=18080 -e EXPLORER_CORS_ORIGINS='*' -e EXPLORER_MIDNIGHT_NETWORKS=preprod \
  -e EXPLORER_MIDNIGHT_PREPROD_INDEXER_URL="$EXPLORER_TEST_PREPROD_INDEXER_URL" "$tag" >/dev/null
trap "docker rm -f $tag >/dev/null 2>&1; docker rmi $tag >/dev/null 2>&1; docker rm -f $pg >/dev/null 2>&1 || true" EXIT
get() { docker exec "$tag" node -e "fetch('http://127.0.0.1:18080$1').then(async r=>{console.log(r.status, (await r.text()).slice(0,400))}).catch(()=>console.log('down'))"; }
for _ in $(seq 60); do get /readyz | grep -q '^200' && break; sleep 1; done
get /healthz | grep -q '^200' || { echo "/healthz does not answer 200" >&2; exit 1; }
get /readyz | grep -q '^200' || { echo "/readyz does not answer 200" >&2; exit 1; }
get /v1/networks | grep -q '"preprod"' || { echo "/v1/networks does not list preprod" >&2; exit 1; }
! docker logs "$tag" 2>&1 | grep -q 'project_id' || { echo "the logs carry the token's query string" >&2; exit 1; }
docker stop -t 15 "$tag" >/dev/null
test "$(docker inspect -f '{{.State.ExitCode}}' "$tag")" -eq 0 || { echo "the container did not exit 0 on SIGTERM" >&2; exit 1; }
