#!/bin/bash
# Exit check of step 04.3. Runs in the step's own worktree.
set -euo pipefail
. "$AGENT_WORK/stages/common.sh"

d=packages/backend/src/ingester
test -f "$d/ingester.ts" || { echo "$d/ingester.ts is missing" >&2; exit 1; }
tests="$(cat "$d"/*.test.ts)"
for rule in 'start block' 'exists before' 'ascending' 'crash' 'different row|conflict' 'changed hash|hash' 'late event|re-read' 'keeps failing|never stepped' 'lock' 'deployment' 'rebuild'; do
  grep -Eiq "$rule" <<< "$tests" || { echo "no ingester test names the rule: $rule" >&2; exit 1; }
done
grep -q 'pg_advisory\|advisory' "$d"/*.ts || { echo "the ingester takes no advisory lock" >&2; exit 1; }
no_match "a timer in an ingester test" 'setTimeout|setInterval|useFakeTimers' -- "$d/*.test.ts"

postgres_up
yarn install --immutable > /dev/null
yarn lint
yarn build
yarn check
left="$(docker compose -p explorer exec -T postgres psql -U explorer -d explorer -Atc "select count(*) from pg_database where datname like 'scratch_%'")"
test "$left" = 0 || { echo "$left scratch database(s) were left behind by the tests" >&2; exit 1; }
