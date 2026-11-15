#!/bin/bash
# Exit check of step 05.2. Runs in the step's own worktree.
set -euo pipefail
. "$AGENT_WORK/stages/common.sh"

ui=packages/ui/src
for gone in lib/midnight/signet-event-store.ts lib/midnight/indexer-services.ts lib/midnight/indexer-block-height.ts \
  lib/midnight/signet-events-window.ts components/midnight/signet-events-starting-block.tsx components/contexts/MidnightSignetEventsContext.tsx; do
  test ! -e "$ui/$gone" || { echo "$ui/$gone is still there" >&2; exit 1; }
done
everywhere=(-- . ':!agent-work' ':!probes' ':!yarn.lock' ':!packages/backend')
no_match "a removed name is still referenced" 'SignetEventStore|MidnightSignetEvents|useMidnightSignetEvents|MidnightIndexerServices|fetchIndexerBlockHeight|signetEventsFromBlock|SIGNET_EVENTS_FROM_BLOCK|indexerWsUrl|resetDefaults|isDefaultConfig' "${everywhere[@]}"
no_match "a removed variable is still referenced" 'VITE_MIDNIGHT_(PREPROD_BLOCKFROST_PROJECT_ID|[A-Z]+_SIGNER_CONTRACT_ADDRESS|[A-Z]+_RESPONDER_CONTRACT_ADDRESS|[A-Z]+_MPC_ROOT_PUBLIC_KEY)' "${everywhere[@]}"
no_match "the UI reads an indexer" 'signetEventSourceFromIndexer|blockfrost|contractEvents' -- "$ui"
grep -q 'VITE_EXPLORER_BACKEND_URL' docker/30-explorer-env.sh || { echo "the image's env.js does not carry VITE_EXPLORER_BACKEND_URL" >&2; exit 1; }

postgres_up
yarn install --immutable > /dev/null
yarn lint
yarn build
wasm_ok
if grep -rliq 'blockfrost' packages/ui/dist/assets/*.js; then echo "the bundle still names Blockfrost" >&2; exit 1; fi
yarn check
EXPLORER_BASE_PATH=/explorer/ yarn build > /dev/null
grep -q '"/explorer/assets/' packages/ui/dist/index.html || { echo "the /explorer/ build lost its base path" >&2; exit 1; }
