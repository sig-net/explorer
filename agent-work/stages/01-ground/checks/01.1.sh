#!/bin/bash
# Exit check of step 01.1. Runs in the step's own worktree.
set -euo pipefail

f=probes/README.md
test -f "$f" || { echo "$f is missing" >&2; exit 1; }
grep -q 'MIDNIGHT_PREPROD_INDEXER_URL' "$f" || { echo "$f does not name the variable" >&2; exit 1; }
grep -q 'probes/findings' "$f" || { echo "$f does not name the findings folder" >&2; exit 1; }
test "$(wc -l < "$f")" -le 15 || { echo "$f is longer than 15 lines" >&2; exit 1; }
if grep -Eiq 'agent-work|AGENTS\.md|CLAUDE\.md|SKILL\.md' "$f"; then
  echo "$f points at an agent file" >&2; exit 1
fi
yarn install --immutable > /dev/null
yarn format:check
