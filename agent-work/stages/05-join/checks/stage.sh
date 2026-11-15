#!/bin/bash
# Exit check of stage 05-join. Runs in the parent branch's worktree, on the merged result.
set -euo pipefail
. "$AGENT_WORK/stages/common.sh"

postgres_up
ci_checks
wasm_ok
test -f packages/backend/src/main.ts || { echo "packages/backend/src/main.ts is missing" >&2; exit 1; }
test ! -e packages/ui/src/lib/midnight/signet-event-store.ts || { echo "the UI's event store is still there" >&2; exit 1; }
no_match "the UI reads an indexer" 'signetEventSourceFromIndexer|contractEvents' -- packages/ui/src
no_match "the UI and the backend import each other" "from '@explorer/backend" -- packages/ui/src
if grep -rlq 'signet-history\|ServiceFake' packages/ui/dist/assets; then echo "the production bundle holds a fake" >&2; exit 1; fi
# The whole system once more, on the merged result.
MIDNIGHT_PREPROD_INDEXER_URL="https://midnight-preprod.blockfrost.io/api/v0?project_id=$(dev-secrets get MIDNIGHT_PREPROD_BLOCKFROST_PROJECT_ID)" \
  yarn e2e:preprod 2>&1 | redact | tee /tmp/stage-05.$$
tests_at_least 2 /tmp/stage-05.$$; rm -f /tmp/stage-05.$$
baseline="$(jq -r .baseline "$AGENT_WORK/task.json")"
test -z "$(git diff --name-only "$baseline"..HEAD -- .github)" || { echo "a workflow file changed before stage 07" >&2; exit 1; }
