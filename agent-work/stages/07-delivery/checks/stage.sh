#!/bin/bash
# Exit check of stage 07-delivery. Runs in the parent branch's worktree, on the merged result.
set -euo pipefail
. "$AGENT_WORK/stages/common.sh"

postgres_up
ci_checks
wasm_ok
for file in docs/architecture.md docs/decisions.md packages/backend/Dockerfile; do
  test -s "$file" || { echo "$file is missing" >&2; exit 1; }
done
no_match "a document for people points at an agent file" 'agent-work|AGENTS\.md|CLAUDE\.md' -- README.md docs
no_match "the wrong name for Night Mode" -i 'dark mode' -- . ':!agent-work'
# No workflow file changes in this task (D35).
baseline="$(jq -r .baseline "$AGENT_WORK/task.json")"
test -z "$(git diff --name-only "$baseline"..HEAD -- .github)" || { echo "a workflow file changed (D35)" >&2; exit 1; }
# Both images build from the merged result.
docker build --quiet -t explorer-replan-ui:stage-07 . > /dev/null
docker build --quiet -f packages/backend/Dockerfile -t explorer-replan-backend:stage-07 . > /dev/null
docker image rm explorer-replan-ui:stage-07 explorer-replan-backend:stage-07 > /dev/null
# The only mentions of agent-work left outside it are the two ignore entries, which go with the folder.
others="$(git grep -l 'agent-work' -- . ':!agent-work' | grep -Ev '^(\.oxfmtrc\.json|\.dockerignore)$' || true)"
test -z "$others" || { echo "agent-work is mentioned in: $others" >&2; exit 1; }

echo "Left for the user, for the orchestrator's closing report:"
awk '/^## Left for the user$/ { on = 1; next } /^## / { on = 0 } on' "$AGENT_WORK/stages/07-delivery/stage.md"
