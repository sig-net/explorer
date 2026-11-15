#!/bin/bash
# Exit check of step 07.2. Runs in the step's own worktree.
set -euo pipefail
. "$AGENT_WORK/stages/common.sh"

for file in README.md docs/architecture.md docs/decisions.md AGENTS.md; do
  test -s "$file" || { echo "$file is missing or empty" >&2; exit 1; }
done
for variable in $(grep -Eo '^#? ?[A-Z][A-Z0-9_]+=' packages/backend/.env.example | tr -d '#= ' | sort -u) VITE_EXPLORER_BACKEND_URL VITE_MIDNIGHT_DEFAULT_NETWORK; do
  grep -q "$variable" README.md || { echo "README.md does not document $variable" >&2; exit 1; }
done
for command in migrate wipe reset-network audit rebuild-sign-requests schema-state 'yarn check' 'yarn drills' 'yarn e2e:preprod' 'docker compose'; do
  grep -q -- "$command" README.md || { echo "README.md does not mention: $command" >&2; exit 1; }
done
humans=(README.md docs)
no_match "a document for people points at an agent file" 'agent-work|AGENTS\.md|CLAUDE\.md|SKILL\.md' -- "${humans[@]}"
no_match "a document names a stage, a gate or a step of the plan" '\b(G[0-9]{2}|[Ss]tage 0[0-9]|step 0[0-9]\.[0-9]+)\b' -- "${humans[@]}"
no_match "a document names something stage 05 removed" 'SignetEventStore|VITE_MIDNIGHT_PREPROD_BLOCKFROST_PROJECT_ID|SIGNET_EVENTS_FROM_BLOCK|Starting Block' -- "${humans[@]}"
no_match "a document tells history" '\b(previously|no longer|used to|formerly)\b' -- "${humans[@]}"
no_match "the wrong name for Night Mode" -i 'dark mode' -- "${humans[@]}" AGENTS.md
grep -q '@explorer/lib' AGENTS.md && grep -q 'network_id' AGENTS.md || { echo "AGENTS.md does not hold the new packages' rules" >&2; exit 1; }

yarn install --immutable > /dev/null
yarn lint
yarn format:check
