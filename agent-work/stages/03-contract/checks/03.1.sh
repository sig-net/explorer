#!/bin/bash
# Exit check of step 03.1. Runs in the step's own worktree.
set -euo pipefail
. "$AGENT_WORK/stages/common.sh"

test "$(jq -r .name packages/lib/package.json)" = "@explorer/lib" || { echo "packages/lib is not named @explorer/lib" >&2; exit 1; }
for file in midnight-networks contract-address value-schemas signet-events index; do
  test -f "packages/lib/src/$file.ts" || { echo "packages/lib/src/$file.ts is missing" >&2; exit 1; }
done
no_match "the UI still defines a function that moved to lib" 'export (function|const) (decodeSignetContractEvent|isMidnightNetwork|normaliseContractAddressHex|parseContractAddressHex|parseContractAddressesHex|MIDNIGHT_NETWORKS)\b' -- packages/ui/src
no_match "lib reaches outside what both runtimes have" "from 'node:|process\.env|import\.meta\.env|from 'react|document\.|window\." -- packages/lib/src
no_match "lib uses syntax Node cannot strip" '^\s*(export )?(declare )?(enum|namespace) ' -- packages/lib/src

postgres_up
yarn install --immutable > /dev/null
yarn lint
yarn build
wasm_ok
yarn check 2>&1 | tee /tmp/check-03.1.$$
tests_at_least 147 /tmp/check-03.1.$$; rm -f /tmp/check-03.1.$$

runner=node
jq -e '.devDependencies.tsx' packages/backend/package.json > /dev/null && runner="yarn tsx"
$runner --input-type=module -e "const lib = await import('./packages/lib/src/index.ts'); if (!lib.isMidnightNetwork('preprod') || lib.isMidnightNetwork('nope')) process.exit(1)" ||
  { echo "Node does not import packages/lib from source, or its network guard is wrong" >&2; exit 1; }
