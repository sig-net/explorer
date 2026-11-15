#!/bin/bash
# Exit check of step 04.8. Runs in the step's own worktree.
set -euo pipefail
. "$AGENT_WORK/stages/common.sh"

ui=packages/ui/src
for file in components/midnight/sign-request-table.tsx components/midnight/sign-request-table.test.tsx \
  components/midnight/sign-request-state-filter.tsx lib/midnight/sign-request-search.ts; do
  test -f "$ui/$file" || { echo "$ui/$file is missing" >&2; exit 1; }
done
test ! -e "$ui/components/midnight/sign-bidirectional-lifecycle-table.tsx" || { echo "the old table file is still there" >&2; exit 1; }
no_match "the page still reads the browser's own events" 'useMidnightSignetEvents|SignetEventsStartingBlock|stepStartingBlockBack' -- "$ui/routes/midnight/explorer.tsx" "$ui/components/midnight/sign-request-table.tsx"
no_match "a cursor class on a control" 'cursor-pointer' -- "$ui/components/midnight" "$ui/routes"
no_match "a root-absolute URL to the app's own routes" "(href|to)=\"/midnight" -- "$ui/components/midnight/sign-request-table.tsx"
grep -q 'listSignRequests' "$ui/routes/midnight/explorer.tsx" || { echo "the page does not call listSignRequests" >&2; exit 1; }
grep -q 'listCallers' "$ui/routes/midnight/explorer.tsx" || { echo "the page does not call listCallers" >&2; exit 1; }

postgres_up
yarn install --immutable > /dev/null
yarn lint
yarn build
wasm_ok
yarn check
EXPLORER_BASE_PATH=/explorer/ yarn build > /dev/null
grep -q '"/explorer/assets/' packages/ui/dist/index.html || { echo "the /explorer/ build lost its base path" >&2; exit 1; }
