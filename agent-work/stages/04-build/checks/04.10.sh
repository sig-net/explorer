#!/bin/bash
# Exit check of step 04.10. Runs in the step's own worktree.
set -euo pipefail
. "$AGENT_WORK/stages/common.sh"

ui=packages/ui/src/components/midnight
for file in use-midnight-network-status.ts indexing-status.tsx indexing-status.test.tsx midnight-configuration.test.tsx; do
  test -f "$ui/$file" || { echo "$ui/$file is missing" >&2; exit 1; }
done
no_match "the popover still edits the configuration" '<Input|setConfig|resetDefaults|Reset Defaults' -- "$ui/midnight-configuration.tsx"
no_match "the popover or the status line can show an indexer URL" 'indexerUrl|indexerWsUrl|nodeUrl' -- "$ui/midnight-configuration.tsx" "$ui/indexing-status.tsx"
no_match "a cursor class on a control" 'cursor-pointer' -- "$ui/midnight-configuration.tsx" "$ui/indexing-status.tsx"
grep -q 'IndexingStatus' "$ui/midnight-app-bar.tsx" || { echo "the status line is not mounted in the bar" >&2; exit 1; }
grep -q 'indexerHost' "$ui/midnight-configuration.tsx" || { echo "the popover does not show the indexer's host" >&2; exit 1; }

postgres_up
yarn install --immutable > /dev/null
yarn lint
yarn build
wasm_ok
yarn check
