#!/bin/bash
# Exit check of step 01.7. Runs in the step's own worktree.
set -euo pipefail
. "$AGENT_WORK/stages/01-ground/checks/probe-lib.sh"

name=rate-limits
file="agent-work/probes/findings/$name.json"
findings_ok "$name" "G07" "sustained_rps first_refusal_status recovery_seconds range_1000_ms range_10000_ms range_100000_ms largest_range_blocks documented_requests_per_day catch_up_requests"
test -f "agent-work/probes/$name.mjs" || { echo "agent-work/probes/$name.mjs is missing" >&2; exit 1; }
jq -e '.gates.G07.verdict != "holds" or (.numbers.sustained_rps >= 5 and .numbers.largest_range_blocks >= 1000)' "$file" > /dev/null ||
  { echo "G07 holds against its own numbers" >&2; exit 1; }
jq -e '.gates.G07.verdict != "not-observed"' "$file" > /dev/null ||
  { echo "G07 must be holds or fails: the probe measures it directly" >&2; exit 1; }
jq -e '.numbers.catch_up_requests > 0' "$file" > /dev/null ||
  { echo "catch_up_requests was not computed" >&2; exit 1; }
repo_checks
