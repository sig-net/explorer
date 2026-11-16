#!/bin/bash
# Exit check of stage 03-contract: on the merged branch the contract tests pass, and no blocking
# finding of a review is left without a decision row that closes it.
set -euo pipefail
source "$AGENT_WORK/lib/checks.sh"
# 03.1's check runs the whole repository's tests, which hold the database tests once 03.2 is merged.
with_postgres
bash "$AGENT_WORK/stages/03-contract/checks/03.1.sh"
bash "$AGENT_WORK/stages/03-contract/checks/03.2.sh"
bash "$AGENT_WORK/stages/03-contract/checks/03.4.sh"
bash "$AGENT_WORK/stages/03-contract/checks/03.5.sh"
grep -qE '^\| D[0-9]+ \|.*review 03\.3' "$AGENT_WORK/decisions.md" ||
  { echo "decisions.md has no row recording how the findings of review 03.3 were closed" >&2; exit 1; }
