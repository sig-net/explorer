#!/bin/bash
# Exit check of step 01.5. Runs in the step's own worktree.
set -euo pipefail
. "$AGENT_WORK/stages/01-ground/checks/probe-lib.sh"

name=head-consistency
file="probes/findings/$name.json"
findings_ok "$name" "G03 G04 G05" "observation_seconds heads_seen events_first_seen events_disappeared max_event_lag_blocks replaced_blocks max_replacement_depth walk_pages head_interval_p50_ms head_interval_max_ms"
test -s "probes/$name.mjs" || { echo "probes/$name.mjs is missing or empty" >&2; exit 1; }
rule() { jq -e "$1" "$file" > /dev/null || { echo "$2" >&2; exit 1; }; }
rule '[.numbers[]] | all(. >= 0)' "a number is negative"
rule '.numbers.observation_seconds >= 1200 and .numbers.heads_seen >= 150' "the run was shorter than 1200 seconds or saw fewer than 150 heads"
rule '.gates.G03.verdict != "not-observed"' "G03 must be holds or fails: the signer's history is always there to walk"
rule '.gates.G03.verdict != "holds" or .numbers.walk_pages >= 3' "G03 holds on a walk of fewer than 3 pages"
rule '.gates.G04.verdict != "holds" or (.numbers.events_first_seen >= 20 and .numbers.max_event_lag_blocks == 0 and .numbers.events_disappeared == 0)' "G04 holds against its own numbers"
rule '.gates.G04.verdict != "fails" or .numbers.max_event_lag_blocks > 0 or .numbers.events_disappeared > 0' "G04 fails with no lag and no disappearance recorded"
rule '.gates.G04.verdict != "not-observed" or (.numbers.events_first_seen < 20 and .numbers.max_event_lag_blocks == 0 and .numbers.events_disappeared == 0)' "G04 is not-observed against its own numbers"
rule '.gates.G05.verdict != "holds" or (.numbers.heads_seen >= 200 and .numbers.replaced_blocks == 0)' "G05 holds against its own numbers"
rule '(.gates.G05.verdict == "fails") == (.numbers.replaced_blocks > 0)' "G05 and replaced_blocks disagree"
repo_checks
# The probe runs: a short watch ends and prints a verdict for each gate.
short="$(MIDNIGHT_PREPROD_INDEXER_URL="$(indexer_url)" timeout 300 node "probes/$name.mjs" --verdicts --seconds 90 2> /dev/null | tail -n 1)"
jq -e '[.G03, .G04, .G05] | all(IN("holds", "fails", "not-observed"))' <<< "$short" > /dev/null ||
  { echo "a 90 second run did not print three verdicts" >&2; exit 1; }
