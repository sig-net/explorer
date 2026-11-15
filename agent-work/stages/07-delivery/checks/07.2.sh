#!/bin/bash
# Exit check of step 07.2: exits 0 only when it is done. Runs in the step's own worktree.
# Given: $AGENT_WORK (the task's agent-work folder), $AGENT_WORK_PARENT (the parent branch) and
# $AGENT_WORK_REPORT (the step's newest filed report, empty when none). Before this script runs,
# the tool itself fails a step whose branch changes a path outside its scope or whose worktree
# holds uncommitted or untracked files.
set -euo pipefail

echo "this exit check is not written yet" >&2
exit 1
