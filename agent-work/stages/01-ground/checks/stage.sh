#!/bin/bash
# Exit check of stage 01-ground: both machinery files and the soak summary are merged, and the
# orchestrator has recorded the outcome of each gate as a decision.
set -euo pipefail
bash "$AGENT_WORK/stages/01-ground/checks/01.1.sh"
bash "$AGENT_WORK/stages/01-ground/checks/01.2.sh"
bash "$AGENT_WORK/stages/01-ground/checks/01.3.sh"
for gate in A7 A8 A10; do
  grep -qE "^\| D[0-9]+ \|.*gate $gate" "$AGENT_WORK/decisions.md" ||
    { echo "decisions.md has no row recording the outcome of gate $gate" >&2; exit 1; }
done
