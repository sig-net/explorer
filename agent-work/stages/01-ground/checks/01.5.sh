#!/bin/bash
# Exit check of step 01.5. Runs in the step's own worktree.
set -euo pipefail
. "$AGENT_WORK/stages/01-ground/checks/probe-lib.sh"

name=head-consistency
file="probes/findings/$name.json"
findings_ok "$name" "G03 G04 G05" "observation_seconds heads_seen events_first_seen max_event_lag_blocks replaced_blocks max_replacement_depth walk_pages head_interval_p50_ms head_interval_max_ms"
test -f "probes/$name.mjs" || { echo "probes/$name.mjs is missing" >&2; exit 1; }
jq -e '.numbers.observation_seconds >= 1200 and .numbers.heads_seen >= 150' "$file" > /dev/null ||
  { echo "the run was shorter than 1200 seconds or saw fewer than 150 heads" >&2; exit 1; }
jq -e '.gates.G03.verdict != "holds" or .numbers.walk_pages >= 3' "$file" > /dev/null ||
  { echo "G03 holds on fewer than 3 pages" >&2; exit 1; }
jq -e '.gates.G04.verdict != "holds" or (.numbers.events_first_seen >= 20 and .numbers.max_event_lag_blocks == 0)' "$file" > /dev/null ||
  { echo "G04 holds against its own numbers" >&2; exit 1; }
jq -e '.gates.G04.verdict != "fails" or .numbers.max_event_lag_blocks > 0' "$file" > /dev/null ||
  { echo "G04 fails with no lag recorded" >&2; exit 1; }
jq -e '.gates.G05.verdict != "holds" or (.numbers.heads_seen >= 200 and .numbers.replaced_blocks == 0)' "$file" > /dev/null ||
  { echo "G05 holds against its own numbers" >&2; exit 1; }
jq -e '.gates.G05.verdict != "fails" or .numbers.replaced_blocks > 0' "$file" > /dev/null ||
  { echo "G05 fails with no replaced block recorded" >&2; exit 1; }
repo_checks
