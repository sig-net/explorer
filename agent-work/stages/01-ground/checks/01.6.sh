#!/bin/bash
# Exit check of step 01.6. Runs in the step's own worktree.
set -euo pipefail
. "$AGENT_WORK/stages/01-ground/checks/probe-lib.sh"

name=chain-lookups
gates="G06 G08 G09"
findings_ok "$name" "$gates" "block_lookup_p50_ms block_lookup_max_ms raw_oldest_bytes raw_newest_bytes transactions_per_hash signer_deploy_block responder_deploy_block"
repo_checks
again="$(MIDNIGHT_PREPROD_INDEXER_URL="$(indexer_url)" node "agent-work/probes/$name.mjs" --verdicts 2> /dev/null | tail -n 1 | jq -cS .)"
kept="$(verdicts_of "$name" "$gates")"
test "$again" = "$kept" || { echo "a second run gives $again, the findings file says $kept" >&2; exit 1; }
