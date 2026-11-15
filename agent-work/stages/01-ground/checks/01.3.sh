#!/bin/bash
# Exit check of step 01.3. Runs in the step's own worktree.
set -euo pipefail

for path in .env .env.local .env.production packages/backend/.env packages/ui/.env.local; do
  git check-ignore -q "$path" || { echo "git does not ignore $path" >&2; exit 1; }
done
for path in .env.example packages/backend/.env.example; do
  if git check-ignore -q "$path"; then
    echo "git ignores $path, which must be tracked" >&2; exit 1
  fi
done
removed="$(git diff --numstat "$AGENT_WORK_PARENT"...HEAD -- .gitignore | awk '{print $2}')"
test "${removed:-0}" = 0 || { echo ".gitignore lost $removed line(s): the step only adds" >&2; exit 1; }
