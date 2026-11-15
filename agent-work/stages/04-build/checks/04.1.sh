#!/bin/bash
# Exit check of step 04.1. Runs in the step's own worktree.
set -euo pipefail
. "$AGENT_WORK/stages/common.sh"

d=packages/backend/src/chain-source/indexer
for file in indexer-chain-source.ts graphql.ts indexer-chain-source.test.ts indexer-chain-source.preprod.test.ts; do
  test -f "$d/$file" || { echo "$d/$file is missing" >&2; exit 1; }
done
grep -q 'implements MidnightChainSource' "$d/indexer-chain-source.ts" || { echo "the class does not implement MidnightChainSource" >&2; exit 1; }
for refusal in 'ascend|descend|fall' 'repeat|duplicate' 'outside' '429' 'not JSON|malformed'; do
  grep -Eiq "$refusal" "$d/indexer-chain-source.test.ts" || { echo "no test names the refusal: $refusal" >&2; exit 1; }
done
no_match "a recorded fixture or a source file holds an indexer key" 'project_id=[A-Za-z0-9]' -- "$d"
if [ -n "${AGENT_WORK_REPORT:-}" ] && [ -f "$AGENT_WORK_REPORT" ]; then
  grep -Eq '^G18: .+' "$AGENT_WORK_REPORT" || { echo "the report has no G18: line" >&2; exit 1; }
fi

postgres_up
yarn install --immutable > /dev/null
yarn lint
yarn build
yarn check
MIDNIGHT_PREPROD_INDEXER_URL="https://midnight-preprod.blockfrost.io/api/v0?project_id=$(dev-secrets get MIDNIGHT_PREPROD_BLOCKFROST_PROJECT_ID)" \
  yarn workspace @explorer/backend vitest run src/chain-source/indexer/indexer-chain-source.preprod.test.ts 2>&1 | redact | tee /tmp/check-04.1.$$
tests_at_least 1 /tmp/check-04.1.$$; rm -f /tmp/check-04.1.$$
