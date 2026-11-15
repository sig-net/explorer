#!/bin/bash
# Exit check of step 04.3. Runs in the step's own worktree.
set -euo pipefail
. "$AGENT_WORK/stages/common.sh"

d=packages/backend/src/ingester
test -f "$d/ingester.ts" || { echo "$d/ingester.ts is missing" >&2; exit 1; }
for member in 'start\(' 'runOnce\(' 'run\(' 'stop\(' IngesterRefusal sameChainEvent isHeld maxRangeAttempts tryAcquire toSignetEvent applyEventsToSignRequests; do
  grep -Eq "$member" "$d/ingester.ts" || { echo "ingester.ts has no $member" >&2; exit 1; }
done
# The lines that open a test: it(, test( or the call after an each table.
titles="$(grep -hE '\b(it|test)\(|\]\)\(' "$d"/*.test.ts || true)"
for rule in 'begins at the start block' 'exists before' 'ascending' 'crash' 'different row' 'changed hash' 'late event' 'keeps failing' 'second ingester' 'changed deployment' 'stays halted'; do
  grep -Fiq "$rule" <<< "$titles" || { echo "no ingester test is titled for the rule: $rule" >&2; exit 1; }
done
no_match "a skipped or unwritten ingester test" '\b(it|test|describe)\.(skip|skipIf|todo|only|fails)\b|\bxit\(' -- "$d"
no_match "a timer in an ingester test" 'setTimeout|setInterval|useFakeTimers' -- "$d/*.test.ts"
test "$(cat "$d"/*.test.ts | grep -c 'expect(')" -ge 30 || { echo "fewer than 30 assertions in the ingester's tests" >&2; exit 1; }
grep -q 'deriveSignRequest' "$d"/*.test.ts || { echo "no ingester test compares the rows with deriveSignRequest" >&2; exit 1; }

postgres_up
yarn install --immutable > /dev/null
yarn lint
yarn build
yarn check
