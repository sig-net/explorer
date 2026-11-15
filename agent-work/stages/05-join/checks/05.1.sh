#!/bin/bash
# Exit check of step 05.1. Runs in the step's own worktree.
set -euo pipefail
. "$AGENT_WORK/stages/common.sh"

b=packages/backend
for file in src/main.ts src/composition/create-backend.ts src/http/http-host.ts src/http/http-host.test.ts; do
  test -f "$b/$file" || { echo "$b/$file is missing" >&2; exit 1; }
done
no_match "the composition or the host reads the environment" 'process\.env' -- "$b/src/composition" "$b/src/http"

postgres_up
yarn install --immutable > /dev/null
yarn lint
yarn build
yarn check

runner=node
jq -e '.devDependencies.tsx' "$b/package.json" > /dev/null && runner="yarn tsx"
port_pg="${EXPLORER_POSTGRES_PORT:-5433}"
name="scratch_check_$$"
psql_admin() { docker compose -p explorer exec -T postgres psql -U explorer -d explorer -Atc "$1"; }
psql_admin "create database $name" > /dev/null
pid=""
cleanup() { test -z "$pid" || kill "$pid" 2> /dev/null || true; psql_admin "drop database if exists $name with (force)" > /dev/null || true; }
trap cleanup EXIT
export DB_CONNECTION_STRING="postgres://explorer:explorer@127.0.0.1:$port_pg/$name" BACKEND_ROLES=serve HTTP_PORT=$((20000 + RANDOM % 20000)) CORS_ALLOWED_ORIGINS=http://localhost:5173 LOG_LEVEL=warn

# An empty database is refused, and nothing is created in it.
if timeout 20 $runner "$b/src/main.ts" start > /tmp/start-$$.log 2>&1; then echo "the backend started on an empty database" >&2; exit 1; fi
test "$(psql_admin "select count(*) from pg_database where datname = '$name'")" = 1
$runner "$b/src/main.ts" migrate > /dev/null
$runner "$b/src/main.ts" start > /tmp/start-$$.log 2>&1 &
pid=$!
for _ in $(seq 1 40); do curl -fsS "http://127.0.0.1:$HTTP_PORT/healthz" > /dev/null 2>&1 && break; sleep 0.5; done
curl -fsS "http://127.0.0.1:$HTTP_PORT/healthz" | jq -e '.ok == true' > /dev/null || { echo "/healthz did not answer" >&2; redact < /tmp/start-$$.log >&2; exit 1; }
curl -fsS -H 'content-type: application/json' -d '{}' "http://127.0.0.1:$HTTP_PORT/network/listNetworks" > /tmp/networks-$$.json
jq -e '.ok == true and ([.. | objects | select(has("configured")) | .configured] | length == 4 and all(. == false))' /tmp/networks-$$.json > /dev/null ||
  { echo "listNetworks did not answer four networks that are not configured" >&2; exit 1; }
kill -TERM "$pid"; wait "$pid" 2> /dev/null || true; pid=""
rm -f /tmp/start-$$.log /tmp/networks-$$.json
