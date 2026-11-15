#!/bin/bash
# Exit check of step 04.9. Runs in the step's own worktree.
set -euo pipefail
. "$AGENT_WORK/stages/common.sh"

ui=packages/ui/src
for file in lib/midnight/stored-signet-event.ts lib/midnight/stored-signet-event.test.ts components/midnight/sign-bidirectional-lifecycle-details.test.tsx; do
  test -f "$ui/$file" || { echo "$ui/$file is missing" >&2; exit 1; }
done
scope=("$ui/components/midnight/sign-bidirectional-lifecycle-details.tsx" "$ui/components/midnight/use-lifecycle-verification.ts"
  "$ui/components/midnight/use-sign-bidirectional-transaction-inspection.ts" "$ui/components/midnight/signet-events-section.tsx"
  "$ui/components/midnight/signature-check.tsx" "$ui/components/midnight/attestation-check.tsx"
  "$ui/lib/midnight/sign-bidirectional-transaction-loader.ts" "$ui/lib/midnight/evm-transaction-output.ts" "$ui/lib/midnight/sign-bidirectional-lifecycle.ts")
no_match "the indexer's event id is still a key" 'source\.id\b' -- "${scope[@]}"
no_match "the browser still asks an indexer or traces a transaction itself" 'indexerUrl|debug_traceTransaction|transactions\(offset' -- "${scope[@]}"
grep -q "import('@/lib/midnight/sign-bidirectional-transaction-inspection')" "$ui/lib/midnight/sign-bidirectional-transaction-loader.ts" ||
  { echo "the dynamic import of the inspection module moved" >&2; exit 1; }
grep -q 'getMidnightTransaction' "$ui/lib/midnight/sign-bidirectional-transaction-loader.ts" || { echo "the loader does not call getMidnightTransaction" >&2; exit 1; }
grep -q 'getEthereumTransactionOutput' "$ui/components/midnight/use-lifecycle-verification.ts" "$ui/lib/midnight/evm-transaction-output.ts" || { echo "nothing calls getEthereumTransactionOutput" >&2; exit 1; }

postgres_up
yarn install --immutable > /dev/null
yarn lint
yarn build
wasm_ok
yarn check
