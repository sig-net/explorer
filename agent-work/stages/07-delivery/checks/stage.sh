#!/bin/bash
# Exit check of stage 07-delivery. Runs in the parent branch's worktree, on the merged result.
set -euo pipefail
. "$AGENT_WORK/stages/common.sh"

postgres_up
ci_checks
wasm_ok
test ! -e probes || { echo "probes/ is still there" >&2; exit 1; }
no_match "something still mentions the probes" '\bprobes\b' -- . ':!agent-work'
for file in docs/architecture.md docs/decisions.md packages/backend/Dockerfile; do
  test -s "$file" || { echo "$file is missing" >&2; exit 1; }
done
no_match "a document for people points at an agent file" 'agent-work|AGENTS\.md|CLAUDE\.md' -- README.md docs
no_match "the wrong name for Night Mode" -i 'dark mode' -- . ':!agent-work'
grep -q 'packages/ui/dist' .github/workflows/pages-deploy.yml || { echo "pages-deploy does not publish packages/ui/dist" >&2; exit 1; }
grep -q 'packages/backend/Dockerfile' .github/workflows/docker-publish.yml || { echo "docker-publish does not build the backend image" >&2; exit 1; }
# Both images build from the merged result.
docker build --quiet -t explorer-replan-ui:stage-07 . > /dev/null
docker build --quiet -f packages/backend/Dockerfile -t explorer-replan-backend:stage-07 . > /dev/null
docker image rm explorer-replan-ui:stage-07 explorer-replan-backend:stage-07 > /dev/null
# The only mentions of agent-work left outside it are the two ignore entries, which go with the folder.
others="$(git grep -l 'agent-work' -- . ':!agent-work' | grep -Ev '^(\.oxfmtrc\.json|\.dockerignore)$' || true)"
test -z "$others" || { echo "agent-work is mentioned in: $others" >&2; exit 1; }
