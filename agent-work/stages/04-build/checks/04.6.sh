#!/bin/bash
# Exit check of step 04.6. Runs in the step's own worktree.
set -euo pipefail
. "$AGENT_WORK/stages/common.sh"

d=packages/backend/src
for file in services/midnight-transaction/midnight-transaction-service-impl.ts \
  services/ethereum-transaction-output/ethereum-transaction-output-service-impl.ts \
  evm/evm-trace-source.ts evm/json-rpc-evm-trace-source.ts; do
  test -f "$d/$file" || { echo "$d/$file is missing" >&2; exit 1; }
done
grep -rEiq 'no stored event|not .*in .*events|open proxy' "$d/services/midnight-transaction"/*.test.ts || { echo "no test of the open proxy refusal" >&2; exit 1; }
grep -rEiq 'miss|not mined|pending' "$d/services/ethereum-transaction-output"/*.test.ts || { echo "no test that a miss is not stored" >&2; exit 1; }
no_match "an error message interpolates a URL" '`[^`]*\$\{[^}]*[uU]rl[^}]*\}' -- "$d/evm" "$d/services/midnight-transaction" "$d/services/ethereum-transaction-output"

postgres_up
yarn install --immutable > /dev/null
yarn lint
yarn build
yarn check
SEPOLIA_FORK_RPC_URL="$(dev-secrets get SEPOLIA_FORK_RPC_URL)" \
  yarn workspace @explorer/backend vitest run src/evm 2>&1 | redact | tee /tmp/check-04.6.$$
tests_at_least 1 /tmp/check-04.6.$$; rm -f /tmp/check-04.6.$$
