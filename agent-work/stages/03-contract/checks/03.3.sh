#!/bin/bash
# Exit check of step 03.3. Runs in the step's own worktree.
set -euo pipefail
. "$AGENT_WORK/stages/common.sh"

api=packages/api/src
for resource in network sign-request midnight-transaction ethereum-transaction-output; do
  for suffix in service-adaptor http-client; do
    test -f "$api/http/$resource-$suffix.ts" || { echo "$api/http/$resource-$suffix.ts is missing" >&2; exit 1; }
  done
done
for file in http.ts http/routes.ts http/mount.ts http/loopback.test.ts; do
  test -f "$api/$file" || { echo "$api/$file is missing" >&2; exit 1; }
done
for method in listNetworks listSignRequests getSignRequest listCallers getMidnightTransaction getEthereumTransactionOutput; do
  grep -q "\b$method\b" "$api/http/routes.ts" || { echo "the route table has no $method" >&2; exit 1; }
  grep -q "\b$method\b" "$api/http/loopback.test.ts" || { echo "the loopback test does not exercise $method" >&2; exit 1; }
done
no_match "api imports what it must not" "from '(fastify|@fastify/|drizzle-orm|pg|react|node:)" -- packages/api/src

postgres_up
yarn install --immutable > /dev/null
yarn lint
yarn build
wasm_ok
yarn check
runner=node
jq -e '.devDependencies.tsx' packages/backend/package.json > /dev/null && runner="yarn tsx"
$runner --input-type=module -e "const http = await import('./packages/api/src/http.ts'); if (typeof http.mountRoutes !== 'function') process.exit(1)" ||
  { echo "Node does not import the http entry from source" >&2; exit 1; }
