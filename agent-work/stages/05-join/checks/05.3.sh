#!/bin/bash
# Exit check of step 05.3. Runs in the step's own worktree. It runs a catch-up on preprod.
set -euo pipefail
. "$AGENT_WORK/stages/common.sh"

test -f packages/backend/e2e/preprod.e2e.test.ts || { echo "packages/backend/e2e/preprod.e2e.test.ts is missing" >&2; exit 1; }
test -f packages/ui/e2e/backend.e2e.test.ts || { echo "packages/ui/e2e/backend.e2e.test.ts is missing" >&2; exit 1; }
jq -e '.scripts["e2e:preprod"]' package.json > /dev/null || { echo "the root script e2e:preprod is missing" >&2; exit 1; }
grep -q 'signetEventSourceFromIndexer' packages/backend/e2e/preprod.e2e.test.ts || { echo "the comparison does not read through the SDK's own reader" >&2; exit 1; }
grep -q 'deriveSignRequest' packages/backend/e2e/preprod.e2e.test.ts || { echo "the rows are not compared with a rebuild" >&2; exit 1; }
if [ -n "${AGENT_WORK_REPORT:-}" ] && [ -f "$AGENT_WORK_REPORT" ]; then
  grep -Eq '^G20: (holds|fails)' "$AGENT_WORK_REPORT" || { echo "the report has no G20: line" >&2; exit 1; }
  grep -Eq '^G21: (holds|fails)' "$AGENT_WORK_REPORT" || { echo "the report has no G21: line" >&2; exit 1; }
  grep -Eq '^G20: holds' "$AGENT_WORK_REPORT" || { echo "G20 fails: the task stops here (see the stage's gates)" >&2; exit 1; }
fi

postgres_up
yarn install --immutable > /dev/null
yarn lint
yarn build
wasm_ok
yarn check
MIDNIGHT_PREPROD_INDEXER_URL="https://midnight-preprod.blockfrost.io/api/v0?project_id=$(dev-secrets get MIDNIGHT_PREPROD_BLOCKFROST_PROJECT_ID)" \
  yarn e2e:preprod 2>&1 | redact | tee /tmp/check-05.3.$$
tests_at_least 2 /tmp/check-05.3.$$; rm -f /tmp/check-05.3.$$
left="$(docker compose -p explorer exec -T postgres psql -U explorer -d explorer -Atc "select count(*) from pg_database where datname like 'scratch_%'")"
test "$left" = 0 || { echo "$left scratch database(s) were left behind" >&2; exit 1; }
