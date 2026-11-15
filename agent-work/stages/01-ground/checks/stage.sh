#!/bin/bash
# Exit check of stage 01-ground. Runs in the parent branch's worktree, on the merged result.
set -euo pipefail
. "$AGENT_WORK/stages/01-ground/checks/probe-lib.sh"

baseline="$(jq -r .baseline "$AGENT_WORK/task.json")"

# No product code: the stage may touch only the probes, the two ignore files and the plan itself.
outside="$(git diff --name-only "$baseline"..HEAD | grep -Ev '^(probes/|agent-work/|\.gitignore$|\.dockerignore$|\.oxfmtrc\.json$)' || true)"
test -z "$outside" || { echo "the stage changed product files:" >&2; echo "$outside" >&2; exit 1; }

test -f probes/README.md || { echo "probes/README.md is missing" >&2; exit 1; }
grep -qx 'probes' .dockerignore || { echo ".dockerignore does not leave probes out" >&2; exit 1; }
git check-ignore -q .env || { echo "git does not ignore .env" >&2; exit 1; }

findings_ok contract-events-paging "G01 G02" "max_limit_honoured"
findings_ok head-consistency "G03 G04 G05" "max_event_lag_blocks replaced_blocks"
findings_ok chain-lookups "G06 G08 G09" "signer_deploy_block responder_deploy_block"
findings_ok rate-limits "G07" "sustained_rps largest_range_blocks catch_up_requests"
findings_ok node-typescript "G10" "image_exit_code"
findings_ok evm-trace "G11" "frame_json_bytes"

# What CI runs, in CI's order, then the repository's own check.
yarn install --immutable > /dev/null
yarn lint
yarn build
yarn check

echo "The gates, for the orchestrator to record in decisions.md (G12 is in the report of step 01.10):"
jq -r '.probe as $p | .gates | to_entries[] | "\(.key)  \(.value.verdict)  [\($p)]  \(.value.evidence)"' probes/findings/*.json | sort
