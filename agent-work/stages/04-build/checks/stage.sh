#!/bin/bash
# Exit check of stage 04-build: on the merged branch every step's check holds together, the
# inspection exists once, and the review's findings are closed by a decision row.
set -euo pipefail
source "$AGENT_WORK/lib/checks.sh"
with_postgres
with_preprod
as_stage_check
repo_checks
for step in 04.9 04.1 04.2 04.10 04.3 04.4 04.5 04.6 04.7; do
  bash "$AGENT_WORK/stages/04-build/checks/$step.sh" || { echo "the check of step $step fails on the merged branch" >&2; exit 1; }
done
test "$(git ls-files | grep -c 'sign-bidirectional-transaction-inspection\.ts$')" -eq 1 ||
  { echo "the transaction inspection module must exist exactly once, in the backend" >&2; exit 1; }
grep -qE '^\| D[0-9]+ \|.*review 04\.8' "$AGENT_WORK/decisions.md" ||
  { echo "decisions.md has no row recording how the findings of review 04.8 were closed" >&2; exit 1; }
