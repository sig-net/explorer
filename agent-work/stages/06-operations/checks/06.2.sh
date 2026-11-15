#!/bin/bash
# Exit check of step 06.2. Runs in the step's own worktree.
set -euo pipefail
. "$AGENT_WORK/stages/common.sh"

b=packages/backend
for command in wipe reset-network schema-state; do
  grep -rq "$command" "$b/src/commands" || { echo "the command $command is not registered" >&2; exit 1; }
done
postgres_up
yarn install --immutable > /dev/null
yarn lint
yarn build
yarn check

runner=node
jq -e '.devDependencies.tsx' "$b/package.json" > /dev/null && runner="yarn tsx"
name="scratch_check_$$"
psql_admin() { docker compose -p explorer exec -T postgres psql -U explorer -d explorer -Atc "$1"; }
psql_admin "create database $name" > /dev/null
trap 'psql_admin "drop database if exists $name with (force)" > /dev/null || true' EXIT
export DB_CONNECTION_STRING="postgres://explorer:explorer@127.0.0.1:${EXPLORER_POSTGRES_PORT:-5433}/$name" BACKEND_ROLES=serve HTTP_PORT=1 CORS_ALLOWED_ORIGINS=http://localhost:5173 LOG_LEVEL=warn
run() { $runner "$b/src/main.ts" "$@"; }

test "$(run schema-state 2> /dev/null | tail -n 1)" = empty || { echo "schema-state does not say empty on an empty database" >&2; exit 1; }
run migrate > /dev/null
test "$(run schema-state | tail -n 1)" = current || { echo "schema-state does not say current after migrate" >&2; exit 1; }
if run wipe > /dev/null 2>&1; then echo "wipe ran without its flag" >&2; exit 1; fi
if run reset-network preprod > /dev/null 2>&1; then echo "reset-network ran without its flag" >&2; exit 1; fi
psql_admin "select 1" > /dev/null
docker compose -p explorer exec -T postgres psql -U explorer -d "$name" -Atc "alter table midnight_signet_events_v1 add column planted int" > /dev/null
test "$(run schema-state 2> /dev/null | tail -n 1)" = mismatch || { echo "schema-state does not say mismatch after a column was added" >&2; exit 1; }
run wipe --erase-everything > /dev/null
test "$(run schema-state | tail -n 1)" = current || { echo "wipe did not leave the shipped schema" >&2; exit 1; }
