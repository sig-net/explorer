#!/bin/bash
# Exit check of step 04.7: the UI shows server configuration read only and holds no indexer setting.
set -euo pipefail
source "$AGENT_WORK/lib/checks.sh"
with_postgres
repo_checks
need_tests @sig-net/explorer-ui \
  'shows the server configuration read only' \
  'offers only the editable fields for editing' \
  'marks a network the backend does not serve' \
  'shows the indexed block and its time' \
  'shows a stopped network with the backend'"'"'s reason' \
  'reads the MPC output cache with the server'"'"'s signer address'
grep -q 'VITE_EXPLORER_' packages/ui/docker/30-explorer-env.sh ||
  { echo "the UI image's entrypoint does not write the VITE_EXPLORER_* variables" >&2; exit 1; }
! grep -rnE 'indexerUrl|indexerWsUrl|nodeUrl|signetEventsFromBlock|BLOCKFROST|blockfrost|SIGNET_EVENTS_EARLIEST_BLOCKS' packages/ui/src packages/ui/docker ||
  { echo "the UI still holds a setting of the indexer or the node" >&2; exit 1; }
# A cold Vite cache: no dependency may be optimised in the middle of the UI's test run.
rm -rf packages/ui/node_modules/.vite packages/ui/node_modules/.vite-temp packages/ui/.vitest
cold="$(mktemp)"
yarn workspace @sig-net/explorer-ui vitest run >"$cold" 2>&1 ||
  { tail -40 "$cold" >&2; echo "the UI's tests fail from a cold Vite cache" >&2; exit 1; }
! grep -q 'unexpectedly reloaded' "$cold" ||
  { echo "Vite optimised a dependency in the middle of the UI's test run: name it in optimizeDeps.include" >&2; exit 1; }
