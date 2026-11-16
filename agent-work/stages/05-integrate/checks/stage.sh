#!/bin/bash
# Exit check of stage 05-integrate: on the merged branch the composed backend, its image, the live
# run's evidence and the documentation all hold, and the final review's findings are closed.
# Everything runs in sequence, and each test suite once.
set -euo pipefail
source "$AGENT_WORK/lib/checks.sh"
with_postgres
as_stage_check
repo_checks
for step in 05.5 05.1 05.7 05.8 05.2 05.3 05.6 05.9; do
  bash "$AGENT_WORK/stages/05-integrate/checks/$step.sh" || { echo "the check of step $step fails on the merged branch" >&2; exit 1; }
done
git diff --quiet 942e473 HEAD -- .github/workflows ||
  { echo "the branch changes a workflow file, which this machine cannot push" >&2; exit 1; }
grep -qE '^\| D[0-9]+ \|.*review 05\.4' "$AGENT_WORK/decisions.md" ||
  { echo "decisions.md has no row recording how the findings of review 05.4 were closed" >&2; exit 1; }
