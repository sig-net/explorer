#!/bin/bash
# Exit check of step 03.2. Runs in the step's own worktree.
set -euo pipefail
. "$AGENT_WORK/stages/common.sh"

api=packages/api/src
test "$(jq -r .name packages/api/package.json)" = "@explorer/api" || { echo "packages/api is not named @explorer/api" >&2; exit 1; }
jq -e '.exports | has(".") and has("./http") and has("./fakes")' packages/api/package.json > /dev/null || { echo "@explorer/api does not declare its three entries" >&2; exit 1; }
for file in network/network.ts network/network-service.ts sign-request/sign-request.ts sign-request/sign-request-service.ts \
  sign-request/signet-event.ts sign-request/derive-sign-request.ts midnight-transaction/midnight-transaction.ts \
  midnight-transaction/midnight-transaction-service.ts ethereum-transaction-output/ethereum-transaction-output.ts \
  ethereum-transaction-output/ethereum-transaction-output-service.ts index.ts; do
  test -f "$api/$file" || { echo "$api/$file is missing" >&2; exit 1; }
done
for field in networkId blockHeight blockPosition blockHash blockTime transactionHash contractAddress emitterRoles indexerEventId eventName payload kind undecodableReason requestId; do
  grep -q "\b$field\b" "$api/sign-request/signet-event.ts" || { echo "SignetEvent lacks the field $field" >&2; exit 1; }
done
for field in networkId requestId firstEventBlockHeight firstEventBlockPosition state callerAddress requestTime signatureTime responseTime durationMs \
  signBidirectionalEventCount signatureRespondedEventCount respondBidirectionalEventCount lastEventBlockHeight lastEventBlockPosition; do
  grep -q "\b$field\b" "$api/sign-request/sign-request.ts" || { echo "SignRequest lacks the field $field" >&2; exit 1; }
done
for method in listNetworks listSignRequests getSignRequest listCallers getMidnightTransaction getEthereumTransactionOutput; do
  grep -rq "\b$method\b" "$api" --include='*-service.ts' || { echo "no service interface declares $method" >&2; exit 1; }
done
no_match "api imports what it must not" "from '(fastify|@fastify/|drizzle-orm|pg|react|node:)" -- packages/api/src
no_match "api uses syntax Node cannot strip" '^\s*(export )?(declare )?(enum|namespace) ' -- packages/api/src
if [ -n "${AGENT_WORK_REPORT:-}" ] && [ -f "$AGENT_WORK_REPORT" ]; then
  for line in '^CENSUS:' '^COLUMNS ADDED: .+' '^TRACE COLUMN: .+'; do
    grep -Eq "$line" "$AGENT_WORK_REPORT" || { echo "the report has no line matching $line" >&2; exit 1; }
  done
fi

postgres_up
yarn install --immutable > /dev/null
yarn lint
yarn build
wasm_ok
yarn check
