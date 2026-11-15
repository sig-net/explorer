#!/bin/bash
# Exit check of stage 04-build. Runs in the parent branch's worktree, on the merged result.
set -euo pipefail
. "$AGENT_WORK/stages/common.sh"

postgres_up
ci_checks
wasm_ok
# The two halves are complete and not yet joined.
for made in chain-source/indexer repositories/sql sign-requests ingester config services/network services/sign-request \
  services/midnight-transaction services/ethereum-transaction-output evm; do
  test -d "packages/backend/src/$made" || { echo "packages/backend/src/$made is missing" >&2; exit 1; }
done
test ! -e packages/backend/src/main.ts || { echo "packages/backend/src/main.ts exists: stage 05 makes it" >&2; exit 1; }
no_match "the UI and the backend import each other" "from '@explorer/backend" -- packages/ui/src
no_match "the backend imports the UI" "from '@explorer/ui" -- packages/backend/src
no_match "a file that is not a test imports the fakes" "@explorer/api/fakes" -- packages/ui/src ':!*.test.ts' ':!*.test.tsx' ':!*.fixture.ts'
no_match "the explorer page still reads the browser's own events" 'useMidnightSignetEvents' -- packages/ui/src/routes
if grep -rlq 'signet-history\|ServiceFake' packages/ui/dist/assets; then echo "the production bundle holds a fake" >&2; exit 1; fi
left="$(docker compose -p explorer exec -T postgres psql -U explorer -d explorer -Atc "select count(*) from pg_database where datname like 'scratch_%'")"
test "$left" = 0 || { echo "$left scratch database(s) were left behind by the tests" >&2; exit 1; }
baseline="$(jq -r .baseline "$AGENT_WORK/task.json")"
test -z "$(git diff --name-only "$baseline"..HEAD -- .github)" || { echo "a workflow file changed (D35)" >&2; exit 1; }
