#!/bin/bash
# Exit check of stage 03-contract. Runs in the parent branch's worktree, on the merged result.
set -euo pipefail
. "$AGENT_WORK/stages/common.sh"

postgres_up
ci_checks
wasm_ok
# Dependencies point one way: lib <- api <- ui, backend.
no_match "lib imports another package of the workspace" "from '@explorer/(api|backend|ui)" -- packages/lib/src
no_match "api imports the backend or the UI" "from '@explorer/(backend|ui)" -- packages/api/src
no_match "the UI and the backend import each other" "from '@explorer/(backend)" -- packages/ui/src
no_match "the UI and the backend import each other" "from '@explorer/(ui)" -- packages/backend/src
# The stage ships contracts only.
for later in ingester services http config; do
  test ! -e "packages/backend/src/$later" || { echo "packages/backend/src/$later exists: stage 04 or 05 makes it" >&2; exit 1; }
done
baseline="$(jq -r .baseline "$AGENT_WORK/task.json")"
test -z "$(git diff --name-only "$baseline"..HEAD -- .github)" || { echo "a workflow file changed (D35)" >&2; exit 1; }
