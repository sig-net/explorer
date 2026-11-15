#!/bin/bash
# Exit check of stage 02-workspace. Runs in the parent branch's worktree, on the merged result.
set -euo pipefail
. "$AGENT_WORK/stages/common.sh"

postgres_up
ci_checks
wasm_ok
test ! -e packages/lib && test ! -e packages/api || { echo "packages/lib or packages/api exists: stage 03 makes them" >&2; exit 1; }
# No workflow file changes before stage 07 (D20).
baseline="$(jq -r .baseline "$AGENT_WORK/task.json")"
test -z "$(git diff --name-only "$baseline"..HEAD -- .github)" || { echo "a workflow file changed before stage 07" >&2; exit 1; }
# G14: the image still builds from the workspace.
docker build --quiet --tag explorer-replan-ui:stage-02 . > /dev/null
docker image rm explorer-replan-ui:stage-02 > /dev/null
