#!/bin/bash
# Exit check of step 06.1. Runs in the step's own worktree.
set -euo pipefail
. "$AGENT_WORK/stages/common.sh"

b=packages/backend/src
for file in audit/audit.ts audit/compare-range.ts audit/audit.test.ts audit/audit.preprod.test.ts; do
  test -f "$b/$file" || { echo "$b/$file is missing" >&2; exit 1; }
done
grep -rq 'compare-range' "$b/ingester" || { echo "the ingester does not use the shared comparison" >&2; exit 1; }
grep -rq "audit" "$b/commands" && grep -rq 'rebuild-sign-requests' "$b/commands" || { echo "the commands audit and rebuild-sign-requests are not registered" >&2; exit 1; }
for planted in 'deleted event|missing event' 'payload' 'extra event' 'no longer' 'hash' 'aggregate|sign request row' 'report-only'; do
  grep -Eiq "$planted" "$b/audit/audit.test.ts" || { echo "no audit test plants: $planted" >&2; exit 1; }
done
if [ -n "${AGENT_WORK_REPORT:-}" ] && [ -f "$AGENT_WORK_REPORT" ]; then
  grep -Eq '^G23: holds' "$AGENT_WORK_REPORT" || { echo "the report does not say G23: holds (a failing G23 stops the task)" >&2; exit 1; }
fi

postgres_up
yarn install --immutable > /dev/null
yarn lint
yarn build
yarn check
MIDNIGHT_PREPROD_INDEXER_URL="https://midnight-preprod.blockfrost.io/api/v0?project_id=$(dev-secrets get MIDNIGHT_PREPROD_BLOCKFROST_PROJECT_ID)" \
  yarn workspace @explorer/backend vitest run src/audit/audit.preprod.test.ts 2>&1 | redact | tee /tmp/check-06.1.$$
tests_at_least 1 /tmp/check-06.1.$$; rm -f /tmp/check-06.1.$$
