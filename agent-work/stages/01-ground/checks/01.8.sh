#!/bin/bash
# Exit check of step 01.8. Runs in the step's own worktree.
set -euo pipefail
. "$AGENT_WORK/stages/01-ground/checks/probe-lib.sh"

name=node-typescript
findings_ok "$name" "G10" "local_node_major image_node_major local_exit_code image_exit_code warnings_printed"
test -x "probes/$name/run.sh" || { echo "probes/$name/run.sh is missing or not executable" >&2; exit 1; }
jq -e '.gates.G10.verdict != "not-observed"' "probes/findings/$name.json" > /dev/null ||
  { echo "G10 must be holds or fails: the probe runs it directly" >&2; exit 1; }
repo_checks
again="$("probes/$name/run.sh" --verdicts 2> /dev/null | tail -n 1 | jq -cS .)"
kept="$(verdicts_of "$name" "G10")"
test "$again" = "$kept" || { echo "a second run gives $again, the findings file says $kept" >&2; exit 1; }
# The run links the toy's packages under node_modules, which git ignores: nothing else may be left.
test -z "$(git status --porcelain)" || { echo "the run left files behind:" >&2; git status --short >&2; exit 1; }
