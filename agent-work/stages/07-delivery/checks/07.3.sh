#!/bin/bash
# Exit check of step 07.3. Runs in the step's own worktree.
set -euo pipefail
. "$AGENT_WORK/stages/common.sh"

test ! -e probes || { echo "probes/ is still there" >&2; exit 1; }
no_match "something still mentions the probes" '\bprobes\b' -- . ':!agent-work'
grep -qx 'agent-work' .dockerignore || { echo ".dockerignore lost its agent-work line" >&2; exit 1; }
yarn install --immutable > /dev/null
yarn lint
yarn format:check
