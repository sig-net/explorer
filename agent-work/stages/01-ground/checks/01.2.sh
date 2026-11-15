#!/bin/bash
# Exit check of step 01.2. Runs in the step's own worktree.
set -euo pipefail

f=agent-work/probes/findings/README.md
test -f "$f" || { echo "$f is missing" >&2; exit 1; }
for verdict in holds fails not-observed; do
  grep -q -- "$verdict" "$f" || { echo "$f does not name the verdict: $verdict" >&2; exit 1; }
done
test "$(wc -l < "$f")" -le 10 || { echo "$f is longer than 10 lines" >&2; exit 1; }
