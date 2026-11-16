#!/bin/bash
# Exit check of step 05.5: the indexer's errors survive an answer with no data, and no comment of
# the code cites the plan or a copy that is gone.
set -euo pipefail
source "$AGENT_WORK/lib/checks.sh"
no_plan_references
! grep -nE 'delete that|Duplicates' packages/backend/src/config/backend-env.ts ||
  { echo "backend-env.ts still tells the reader to delete a copy in the UI" >&2; exit 1; }
with_postgres
repo_checks
need_tests @sig-net/explorer-backend \
  "an answer with errors and no data reports the server's messages" \
  'an answer with neither data nor errors is rejected'
