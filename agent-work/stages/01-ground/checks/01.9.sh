#!/bin/bash
# Exit check of step 01.9. Runs in the step's own worktree.
set -euo pipefail
. "$AGENT_WORK/stages/01-ground/checks/probe-lib.sh"

name=evm-trace
findings_ok "$name" "G11" "frame_json_bytes output_json_bytes trace_ms reverted_seen"
jq -e '.gates.G11.verdict != "not-observed"' "probes/findings/$name.json" > /dev/null ||
  { echo "G11 must be holds or fails: the probe runs it directly" >&2; exit 1; }
repo_checks
again="$(SEPOLIA_FORK_RPC_URL="$(dev-secrets get SEPOLIA_FORK_RPC_URL)" node "probes/$name.mjs" --verdicts 2> /dev/null | tail -n 1 | jq -cS .)"
kept="$(verdicts_of "$name" "G11")"
test "$again" = "$kept" || { echo "a second run gives $again, the findings file says $kept" >&2; exit 1; }
