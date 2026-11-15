#!/bin/bash
# Exit check of stage 06-operations. Runs in the parent branch's worktree, on the merged result.
set -euo pipefail
. "$AGENT_WORK/stages/common.sh"

postgres_up
ci_checks
wasm_ok
for command in start migrate audit rebuild-sign-requests wipe reset-network schema-state; do
  grep -rq "$command" packages/backend/src/commands || { echo "the command $command is not registered" >&2; exit 1; }
done
no_match "product code imports a drill tool" "drills/" -- packages/backend/src
yarn drills 2>&1 | tee /tmp/stage-06.$$
tests_at_least 8 /tmp/stage-06.$$; rm -f /tmp/stage-06.$$
left="$(docker compose -p explorer exec -T postgres psql -U explorer -d explorer -Atc "select count(*) from pg_database where datname like 'scratch_%'")"
test "$left" = 0 || { echo "$left scratch database(s) were left behind" >&2; exit 1; }
baseline="$(jq -r .baseline "$AGENT_WORK/task.json")"
test -z "$(git diff --name-only "$baseline"..HEAD -- .github)" || { echo "a workflow file changed (D35)" >&2; exit 1; }
