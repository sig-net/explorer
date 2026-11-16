#!/bin/bash
# Exit check of step 02.4: the full UI suite passes 25 times in a row, with no retry and no skip
# standing in for a fix.
set -euo pipefail
source "$AGENT_WORK/lib/checks.sh"
t=packages/ui/src/components/midnight/excluded-callers-filter.test.tsx
grep -q "the button excludes the typed address, and marks the box when it is not one" "$t" ||
  { echo "the test is gone from $t" >&2; exit 1; }
if grep -nE '\.(skip|todo|fails)\(|retry' "$t" packages/ui/vitest.config.ts; then
  echo "a skip or a retry stands in for the fix" >&2; exit 1
fi
repo_checks
for run in $(seq 1 25); do
  yarn workspace @sig-net/explorer-ui test >"/tmp/02.4-run-$$.log" 2>&1 ||
    { tail -40 "/tmp/02.4-run-$$.log"; rm -f "/tmp/02.4-run-$$.log"; echo "full suite failed on run $run of 25" >&2; exit 1; }
done
rm -f "/tmp/02.4-run-$$.log"
echo "full suite passed 25 times"
