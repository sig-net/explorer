#!/bin/bash
# Exit check of step 04.3: the query service's fourteen tests pass against a real PostgreSQL.
set -euo pipefail
source "$AGENT_WORK/lib/checks.sh"
with_postgres
repo_checks
need_tests @sig-net/explorer-backend \
  'answers as the in-memory service for the shared seed' \
  'pages through 500 requests without repeating or skipping one' \
  'search matches a fragment in any case with or without 0x' \
  'search treats percent, underscore and backslash as text' \
  'excluding callers keeps requests that name no caller' \
  'counts the matching requests and events and the totals' \
  'reports starting, syncing, synced and stopped' \
  'an unknown network is the typed error' \
  'the newest page of 200,000 requests answers within 500 ms' \
  'a search of 200,000 requests by a fragment of a request id answers within 500 ms' \
  'a search of 200,000 requests by a fragment of a caller answers within 500 ms' \
  'excluding a caller of 200,000 requests answers within 500 ms' \
  'the callers of 200,000 requests answer within 500 ms' \
  'a selective search reads neither requests nor request_callers in full'
grep -rqE 'export (async )?function createPostgresExplorerService\b' packages/backend/src/service --include='*.ts' ||
  { echo "packages/backend/src/service does not export createPostgresExplorerService" >&2; exit 1; }
! grep -rnE 'sql\.(raw|lit)\(' packages/backend/src/service --include='*.ts' --exclude='*.test.ts' ||
  { echo "the service builds SQL from a raw string" >&2; exit 1; }
