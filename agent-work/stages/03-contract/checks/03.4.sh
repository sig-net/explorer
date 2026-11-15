#!/bin/bash
# Exit check of step 03.4. Runs in the step's own worktree.
set -euo pipefail
. "$AGENT_WORK/stages/common.sh"

api=packages/api/src
for resource in network sign-request midnight-transaction ethereum-transaction-output; do
  test -f "$api/fakes/$resource-service-fake.ts" || { echo "$api/fakes/$resource-service-fake.ts is missing" >&2; exit 1; }
  test -f "$api/fakes/$resource-service-fake.test.ts" || { echo "$api/fakes/$resource-service-fake.test.ts is missing" >&2; exit 1; }
done
test -f "$api/fakes.ts" && test -f "$api/fakes/signet-history.ts" || { echo "the fakes entry or the fixture history is missing" >&2; exit 1; }
grep -q 'deriveSignRequest' "$api/fakes/sign-request-service-fake.ts" || { echo "the sign request fake does not use deriveSignRequest" >&2; exit 1; }
no_match "the fakes import from the UI" "from '(@explorer/ui|.*packages/ui)" -- packages/api/src
no_match "api imports what it must not" "from '(fastify|@fastify/|drizzle-orm|pg|react|node:)" -- packages/api/src

postgres_up
yarn install --immutable > /dev/null
yarn lint
yarn build
wasm_ok
yarn check
runner=node
jq -e '.devDependencies.tsx' packages/backend/package.json > /dev/null && runner="yarn tsx"
$runner --input-type=module -e "const fakes = await import('./packages/api/src/fakes.ts'); if (Object.keys(fakes).length < 5) process.exit(1)" ||
  { echo "Node does not import the fakes entry from source" >&2; exit 1; }
