#!/bin/bash
# Exit check of step 04.10: the ingest loop's six tests pass against a real PostgreSQL.
set -euo pipefail
source "$AGENT_WORK/lib/checks.sh"
with_postgres
repo_checks
need_tests @sig-net/explorer-backend \
  'cycles at once while there is more to read and waits once caught up' \
  'backs off after failures and resets on success' \
  'a cycle that rejects backs off and the loop goes on' \
  'stops when the signal aborts' \
  'a stopped network resumes after its schema is wiped and migrated' \
  'reports every outcome' \
  'stores a range and moves the cursor together'
grep -rqE 'export (async )?function startIngestLoop\b' packages/backend/src/ingest --include='*.ts' ||
  { echo "packages/backend/src/ingest does not export the function startIngestLoop" >&2; exit 1; }
! grep -rnE '\bdeleteFrom\(|DELETE FROM|TRUNCATE' packages/backend/src/ingest --include='*.ts' --exclude='*.test.ts' ||
  { echo "the ingest removes rows, against D45" >&2; exit 1; }
