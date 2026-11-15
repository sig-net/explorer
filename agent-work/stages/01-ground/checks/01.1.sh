#!/bin/bash
# Exit check of step 01.1. Runs in the step's own worktree.
set -euo pipefail

f=agent-work/probes/README.md
test -f "$f" || { echo "$f is missing" >&2; exit 1; }
grep -q 'MIDNIGHT_PREPROD_INDEXER_URL' "$f" || { echo "$f does not name the variable" >&2; exit 1; }
grep -q 'agent-work/probes/findings' "$f" || { echo "$f does not name the findings folder" >&2; exit 1; }
test "$(wc -l < "$f")" -le 15 || { echo "$f is longer than 15 lines" >&2; exit 1; }
