#!/bin/bash
# Exit check of step 02.3: the shared modules are in lib, gone from the UI, and free of runtime globals.
set -euo pipefail
source "$AGENT_WORK/lib/checks.sh"
for f in contract-address signet-events sign-bidirectional-lifecycle midnight-networks; do
  test -f "packages/lib/src/midnight/$f.ts" || { echo "packages/lib/src/midnight/$f.ts is missing" >&2; exit 1; }
done
for f in contract-address signet-events; do
  test ! -e "packages/ui/src/lib/midnight/$f.ts" || { echo "packages/ui still holds $f.ts" >&2; exit 1; }
done
! grep -rnE 'import\.meta|window\.|process\.|@/|luxon' packages/lib/src --include='*.ts' | grep -v '\.test\.ts' ||
  { echo "packages/lib reads a runtime global, an alias or luxon" >&2; exit 1; }
! grep -rn 'aggregateSignBidirectionalLifecycles = \|function aggregateSignBidirectionalLifecycles\|function isMidnightNetwork' packages/ui/src ||
  { echo "the UI still defines a function that moved to lib" >&2; exit 1; }
repo_checks
probe=packages/backend/src/zz-lib-probe.ts
trap 'rm -f "$probe"' EXIT
cat > "$probe" <<'TS'
import { aggregateSignBidirectionalLifecycles, decodeSignetContractEvent, isMidnightNetwork, MIDNIGHT_NETWORKS, parseContractAddressHex } from '@sig-net/explorer-lib'
const all = [aggregateSignBidirectionalLifecycles, decodeSignetContractEvent, isMidnightNetwork, parseContractAddressHex].every((f) => typeof f === 'function')
console.log(all && MIDNIGHT_NETWORKS.length === 4 ? 'exports' : 'missing')
TS
test "$(node "$probe")" = exports || { echo "lib does not export what the backend needs" >&2; exit 1; }
