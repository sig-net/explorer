#!/bin/bash
# Exit check of stage 05-integrate: on the merged branch the composed backend, the live run's
# evidence and the documentation all hold, and the final review's findings are closed.
set -euo pipefail
bash "$AGENT_WORK/stages/05-integrate/checks/05.1.sh"
bash "$AGENT_WORK/stages/05-integrate/checks/05.2.sh"
bash "$AGENT_WORK/stages/05-integrate/checks/05.3.sh"
grep -qE '^\| D[0-9]+ \|.*review 05\.4' "$AGENT_WORK/decisions.md" ||
  { echo "decisions.md has no row recording how the findings of review 05.4 were closed" >&2; exit 1; }
