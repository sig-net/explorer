#!/bin/bash
# Exit check of step 04.5: the list reads the service, its eleven tests pass, the old path is gone.
set -euo pipefail
source "$AGENT_WORK/lib/checks.sh"
with_postgres
repo_checks
need_tests @sig-net/explorer-ui \
  'lists the newest lifecycles of the selected network' \
  'load more appends the next page once' \
  'a search asks the service and resets the pages' \
  'a search shorter than three characters says so' \
  'shows the matching and total counts of the service' \
  'excluding a caller asks the service and keeps the URL in step' \
  'a linked request id shows that request alone' \
  'a linked request id that is unknown says so' \
  'refresh reads the first page again' \
  'a failing service shows the error and keeps what was loaded' \
  'without a backend URL the page says none is configured'
for gone in lib/midnight/signet-event-store.ts lib/midnight/signet-events-window.ts lib/midnight/indexer-block-height.ts components/midnight/signet-events-starting-block.tsx components/contexts/MidnightSignetEventsContext.tsx; do
  test ! -e "packages/ui/src/$gone" || { echo "packages/ui/src/$gone still exists" >&2; exit 1; }
done
! grep -rnE 'SignetEventStore|fetchIndexerBlockHeight|streamSignetEvents|useMidnightSignetEvents|signBidirectionalLifecycle(Matches|CalledBy|Callers|EventCount)' packages/ui/src ||
  { echo "the UI still references a deleted name" >&2; exit 1; }
grep -q 'VITE_EXPLORER_API_URL' packages/ui/src/vite-env.d.ts ||
  { echo "vite-env.d.ts does not declare VITE_EXPLORER_API_URL" >&2; exit 1; }
