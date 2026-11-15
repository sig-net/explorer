#!/bin/bash
# Exit check of step 04.4. Runs in the step's own worktree.
set -euo pipefail
. "$AGENT_WORK/stages/common.sh"

d=packages/backend/src/config
test -f "$d/backend-config.ts" && test -f "$d/backend-config.test.ts" || { echo "the loader or its test is missing" >&2; exit 1; }
no_match "the configuration reads process.env itself" 'process\.env' -- "$d/backend-config.ts"
grep -q 'indexerHost' "$d/backend-config.ts" || { echo "indexerHost is missing" >&2; exit 1; }
grep -Eiq 'not (contain|include|hold)|never shows|hides' "$d/backend-config.test.ts" || { echo "no test asserts an error hides the value" >&2; exit 1; }
for variable in DB_CONNECTION_STRING BACKEND_ROLES HTTP_PORT CORS_ALLOWED_ORIGINS LOG_LEVEL \
  MIDNIGHT_PREPROD_BLOCKFROST_PROJECT_ID MIDNIGHT_PREPROD_INDEXER_URL MIDNIGHT_PREPROD_SIGNER_CONTRACT_ADDRESS \
  MIDNIGHT_PREPROD_RESPONDER_CONTRACT_ADDRESS MIDNIGHT_PREPROD_MPC_ROOT_PUBLIC_KEY MIDNIGHT_PREPROD_SIGNET_EVENTS_START_BLOCK \
  ETHEREUM_SEPOLIA_RPC_URL ETHEREUM_MAINNET_RPC_URL INGEST_SAFETY_MARGIN INGEST_RANGE_SIZE INGEST_REREAD_BLOCKS INGEST_POLL_INTERVAL_MS; do
  grep -q "^#\? \?$variable=" packages/backend/.env.example || { echo ".env.example does not list $variable" >&2; exit 1; }
done
if grep -Eq '^(MIDNIGHT_[A-Z]+_BLOCKFROST_PROJECT_ID|ETHEREUM_[A-Z]+_RPC_URL)=.+' packages/backend/.env.example; then
  echo ".env.example holds a value for a secret" >&2; exit 1
fi

postgres_up
yarn install --immutable > /dev/null
yarn lint
yarn build
yarn check
