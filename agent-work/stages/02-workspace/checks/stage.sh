#!/bin/bash
# Exit check of stage 02-workspace: on the merged branch, each step's check still passes.
set -euo pipefail
for c in 02.1 02.2 02.3; do bash "$AGENT_WORK/stages/02-workspace/checks/$c.sh"; done
