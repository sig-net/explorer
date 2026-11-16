#!/bin/bash
# Exit check of step 05.3: the documentation exists, covers the configuration, and names nothing removed.
set -euo pipefail
source "$AGENT_WORK/lib/checks.sh"
for f in README.md DECISIONS.md packages/backend/README.md packages/ui/README.md; do
  test -s "$f" || { echo "$f is missing or empty" >&2; exit 1; }
done
missing=0
for v in $(grep -rhoE 'EXPLORER_[A-Z0-9_]+' packages/backend/src/config --include='*.ts' | grep -v '_TEST_' | sort -u); do
  case "$v" in *_) continue ;; esac
  grep -q "$v" packages/backend/README.md || { echo "packages/backend/README.md does not name $v" >&2; missing=1; }
done
test "$missing" -eq 0
grep -q 'VITE_EXPLORER_API_URL' packages/ui/README.md || { echo "the UI's README does not name VITE_EXPLORER_API_URL" >&2; exit 1; }
! grep -rnE 'VITE_MIDNIGHT_PREPROD_BLOCKFROST_PROJECT_ID|SIGNET_EVENTS_FROM_BLOCK|signet-event-store|agent-work' README.md DECISIONS.md packages/*/README.md ||
  { echo "the documentation names something the task removed, or points into agent-work" >&2; exit 1; }
! grep -nE 'src/lib/midnight/sign-bidirectional-transaction-inspection' AGENTS.md | grep -v packages/backend ||
  { echo "AGENTS.md still places the inspection module in the UI" >&2; exit 1; }
with_postgres
repo_checks
