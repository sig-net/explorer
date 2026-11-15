#!/bin/bash
# Exit check of step 04.3. Runs in the step's own worktree.
set -euo pipefail
. "$AGENT_WORK/stages/common.sh"

d=packages/backend/src/ingester
test -f "$d/ingester.ts" || { echo "$d/ingester.ts is missing" >&2; exit 1; }
for member in 'start\(' 'runOnce\(' 'run\(' maxRangeAttempts tryAcquire toSignetEvent applyEventsToSignRequests; do
  grep -Eq "$member" "$d/ingester.ts" || { echo "ingester.ts has no $member" >&2; exit 1; }
done
# The titles of the tests: the first string of each it( or test( call.
titles="$(grep -hEo "^\s*(it|test)\((['\"\`])[^'\"\`]+" "$d"/*.test.ts | sed -E "s/^\s*(it|test)\(.//")"
for rule in 'start block' 'exists before' 'ascending' 'crash' 'different row' 'changed hash' 'late event' 'keeps failing' 'second ingester' 'changed deployment' 'stays halted'; do
  grep -Fiq "$rule" <<< "$titles" || { echo "no ingester test is titled for the rule: $rule" >&2; exit 1; }
done
no_match "a skipped or unwritten ingester test" '\b(it|test|describe)\.(skip|todo|only)\b' -- "$d"
no_match "a timer in an ingester test" 'setTimeout|setInterval|useFakeTimers' -- "$d/*.test.ts"
grep -q 'deriveSignRequest' "$d"/*.test.ts || { echo "no ingester test compares the rows with deriveSignRequest" >&2; exit 1; }

postgres_up
yarn install --immutable > /dev/null
yarn lint
yarn build
yarn check
