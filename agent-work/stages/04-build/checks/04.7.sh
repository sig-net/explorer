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
! grep -rnE 'indexerUrl|indexerWsUrl|nodeUrl|signetEventsFromBlock|BLOCKFROST|blockfrost|SIGNET_EVENTS_EARLIEST_BLOCKS' packages/ui/src packages/ui/docker ||
  { echo "the UI still holds a setting of the indexer or the node" >&2; exit 1; }
