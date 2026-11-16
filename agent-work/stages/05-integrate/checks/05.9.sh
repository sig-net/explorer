#!/bin/bash
# Exit check of step 05.9: the advisory findings of review 05.4 are applied.
set -euo pipefail
source "$AGENT_WORK/lib/checks.sh"
! grep -n 'about 3 calls a' DECISIONS.md ||
  { echo "DECISIONS.md still gives 3 calls a poll" >&2; exit 1; }
grep -qE '"node": *">=24' package.json ||
  { echo "the root package.json does not ask for Node 24" >&2; exit 1; }
grep -q 'packages/ui/Dockerfile' README.md && grep -q 'VITE_EXPLORER_API_URL' README.md ||
  { echo "README.md does not name the corrections the workflows need" >&2; exit 1; }
! grep -n 'agent-work' README.md DECISIONS.md packages/backend/README.md ||
  { echo "a document names agent-work" >&2; exit 1; }
bash "$AGENT_WORK/stages/05-integrate/checks/05.6.sh"
bash "$AGENT_WORK/stages/05-integrate/checks/05.3.sh"
with_postgres
repo_checks
need_tests @sig-net/explorer-backend \
  'a network whose source never answered shows its error'
