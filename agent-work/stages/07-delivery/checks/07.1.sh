#!/bin/bash
# Exit check of step 07.1. Runs in the step's own worktree. It builds and runs two images.
set -euo pipefail
. "$AGENT_WORK/stages/common.sh"

test -f packages/backend/Dockerfile || { echo "packages/backend/Dockerfile is missing" >&2; exit 1; }
grep -qx 'agent-work' .dockerignore || { echo ".dockerignore lost its agent-work line" >&2; exit 1; }
tag="check-$$"
name="scratch_check_$$"
psql_admin() { docker compose -p explorer exec -T postgres psql -U explorer -d explorer -Atc "$1"; }
cleanup() {
  docker rm -f "explorer-backend-$tag" "explorer-ui-$tag" > /dev/null 2>&1 || true
  docker image rm "explorer-replan-ui:$tag" "explorer-replan-backend:$tag" > /dev/null 2>&1 || true
  psql_admin "drop database if exists $name with (force)" > /dev/null 2>&1 || true
}
trap cleanup EXIT
postgres_up
docker build --quiet -t "explorer-replan-ui:$tag" . > /dev/null
docker build --quiet -f packages/backend/Dockerfile -t "explorer-replan-backend:$tag" . > /dev/null

test "$(docker run --rm --entrypoint id "explorer-replan-backend:$tag" -u)" != 0 || { echo "the backend image runs as root" >&2; exit 1; }
if docker run --rm --entrypoint sh "explorer-replan-backend:$tag" -c 'ls -d packages/ui packages/backend/drills 2> /dev/null; find packages -name "*.test.ts" | head -1' | grep -q .; then
  echo "the backend image holds the UI, the drills or a test" >&2; exit 1
fi
psql_admin "create database $name" > /dev/null
db="postgres://explorer:explorer@host.docker.internal:${EXPLORER_POSTGRES_PORT:-5433}/$name"
port=$((20000 + RANDOM % 20000))
common=(--add-host=host.docker.internal:host-gateway -e "DB_CONNECTION_STRING=$db" -e BACKEND_ROLES=serve -e HTTP_PORT=8080 -e CORS_ALLOWED_ORIGINS=http://localhost:5173 -e LOG_LEVEL=warn)
docker run --rm "${common[@]}" "explorer-replan-backend:$tag" migrate > /dev/null
docker run -d --name "explorer-backend-$tag" -p "127.0.0.1:$port:8080" "${common[@]}" "explorer-replan-backend:$tag" > /dev/null
for _ in $(seq 1 40); do curl -fsS "http://127.0.0.1:$port/healthz" > /dev/null 2>&1 && break; sleep 0.5; done
curl -fsS "http://127.0.0.1:$port/healthz" | jq -e '.ok == true' > /dev/null || { echo "the backend image does not serve /healthz" >&2; docker logs "explorer-backend-$tag" 2>&1 | tail -20 | redact >&2; exit 1; }

uiport=$((20000 + RANDOM % 20000))
docker run -d --name "explorer-ui-$tag" -p "127.0.0.1:$uiport:8080" -e VITE_EXPLORER_BACKEND_URL=http://backend.example "explorer-replan-ui:$tag" > /dev/null
for _ in $(seq 1 40); do curl -fsS "http://127.0.0.1:$uiport/env.js" > /dev/null 2>&1 && break; sleep 0.5; done
curl -fsS "http://127.0.0.1:$uiport/env.js" | grep -q '"VITE_EXPLORER_BACKEND_URL": "http://backend.example"' || { echo "the UI image's env.js does not carry the backend URL" >&2; exit 1; }
