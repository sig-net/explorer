#!/bin/bash
# Exit check of step 02.3: the shared modules are in lib, gone from the UI, and free of runtime globals.
set -euo pipefail
source "$AGENT_WORK/lib/checks.sh"
for f in contract-address signet-events sign-bidirectional-lifecycle midnight-networks sign-bidirectional-lifecycle.fixture; do
  test -f "packages/lib/src/midnight/$f.ts" || { echo "packages/lib/src/midnight/$f.ts is missing" >&2; exit 1; }
done
for f in contract-address contract-address.test signet-events signet-events.test sign-bidirectional-lifecycle.fixture; do
  test ! -e "packages/ui/src/lib/midnight/$f.ts" || { echo "packages/ui still holds $f.ts" >&2; exit 1; }
done
! grep -rnE "import\.meta|from '@/|luxon" packages/lib/src --include='*.ts' ||
  { echo "packages/lib reads import.meta, an alias or luxon" >&2; exit 1; }
! grep -rnE '\bwindow\.|\bprocess\.' packages/lib/src --include='*.ts' | grep -v '\.test\.ts' ||
  { echo "packages/lib reads a runtime global" >&2; exit 1; }
! grep -rnE "from '\.{1,2}/[^']*[^s]'|from '\.{1,2}/[^']*[^t]s'" packages/lib/src --include='*.ts' ||
  { echo "a relative import in packages/lib lacks its .ts extension" >&2; exit 1; }
! grep -rn 'aggregateSignBidirectionalLifecycles = \|function aggregateSignBidirectionalLifecycles\|function isMidnightNetwork\|MIDNIGHT_NETWORKS:' packages/ui/src ||
  { echo "the UI still defines something that moved to lib" >&2; exit 1; }
! grep -rnE "lib/midnight/(contract-address|signet-events|sign-bidirectional-lifecycle\.fixture)'|\./(contract-address|signet-events|sign-bidirectional-lifecycle\.fixture)'" packages/ui/src ||
  { echo "the UI still imports a module that moved to lib by its old path" >&2; exit 1; }
repo_checks
need_tests @sig-net/explorer-lib \
  'a contract address parses from hex in any case, with or without the prefix' \
  'anything but 32 bytes of hex is not a contract address' \
  'a comma-separated list yields its distinct addresses in canonical form, dropping the rest' \
  'a sign bidirectional event decodes to its request id and notification' \
  'a signature responded event decodes to its request id and signature' \
  'a respond bidirectional event decodes to everything its attestation declares' \
  'a respond bidirectional event with an unknown output kind is kept as undecodable' \
  'an unknown event name is kept as unrecognised' \
  'a notification with an unsupported version is kept as undecodable' \
  'a notification with a zero path depth is kept as undecodable' \
  'events group by declared request id, newest lifecycle first' \
  'repeated emissions under one request id are all kept, in emission order' \
  'a response with no request still forms a lifecycle' \
  'events that did not decode join no lifecycle'
need_tests @sig-net/explorer-ui \
  'duration runs from the first request to the first attestation' \
  'search matches a fragment of the request id or of a caller address' \
  'the callers are the distinct addresses named, and a lifecycle is called by any it names'
probe=packages/backend/src/zz-lib-probe.ts
trap 'rm -f "$probe"' EXIT
cat > "$probe" <<'TS'
import {
  aggregateSignBidirectionalLifecycles,
  decodeSignetContractEvent,
  isMidnightNetwork,
  MIDNIGHT_NETWORKS,
  parseContractAddressHex,
  type SignBidirectionalLifecycle,
  type StoredSignetMiscEvent,
} from '@sig-net/explorer-lib'
import { notificationEvent, responseEvent } from '@sig-net/explorer-lib/testing'

type Dropped = Extract<keyof StoredSignetMiscEvent, 'maxId' | 'transactionId'>
type Kept = 'id' | 'name' | 'payload' | 'transactionHash' | 'blockHeight' | 'blockHash' | 'blockTimestamp'
const shape: [Dropped] extends [never] ? (Kept extends keyof StoredSignetMiscEvent ? true : never) : never = true
const lifecycles: SignBidirectionalLifecycle[] = aggregateSignBidirectionalLifecycles([
  notificationEvent(1, new Uint8Array(32).fill(0xaa), new Uint8Array(32).fill(0x11), 0),
])
const all = [decodeSignetContractEvent, isMidnightNetwork, parseContractAddressHex, responseEvent].every(
  (f) => typeof f === 'function',
)
console.log(shape && all && lifecycles.length === 1 && MIDNIGHT_NETWORKS.length === 4 ? 'exports' : 'missing')
TS
yarn workspace @sig-net/explorer-backend typecheck || { echo "the backend does not typecheck against lib's exports and StoredSignetMiscEvent" >&2; exit 1; }
test "$(node "$probe")" = exports || { echo "lib does not export what the backend needs" >&2; exit 1; }
