#!/bin/bash
# Exit check of step 01.4. Runs in the step's own worktree.
set -euo pipefail
. "$AGENT_WORK/stages/01-ground/checks/probe-lib.sh"

name=contract-events-paging
gates="G01 G02"
findings_ok "$name" "$gates" "rows_signer rows_responder rows_not_misc default_limit max_limit_honoured max_rows_in_one_block blocks_with_several_rows"
repo_checks
again="$(MIDNIGHT_PREPROD_INDEXER_URL="$(indexer_url)" node "agent-work/probes/$name.mjs" --verdicts 2> /dev/null | tail -n 1 | jq -cS .)"
kept="$(verdicts_of "$name" "$gates")"
test "$again" = "$kept" || { echo "a second run gives $again, the findings file says $kept" >&2; exit 1; }
