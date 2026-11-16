#!/bin/bash
# Exit check of step 04.3: the query service's nine tests pass against a real PostgreSQL.
set -euo pipefail
source "$AGENT_WORK/lib/checks.sh"
with_postgres
repo_checks
need_tests @sig-net/explorer-backend \
  'answers as the in-memory service for the shared seed' \
  'pages through 500 requests without repeating or skipping one' \
  'search matches a fragment in any case with or without 0x' \
  'search treats percent and underscore as text' \
  'excluding callers keeps requests that name no caller' \
  'counts matching and total requests and total events' \
  'reports starting, syncing, synced and stopped' \
  'an unknown network is the typed error' \
  'the newest page of 100,000 requests answers within 200 ms'
! grep -rnE 'sql\.raw\(|\$\{[^}]*\}' packages/backend/src/service --include='*.ts' | grep -v '\.test\.ts' | grep -i 'like\|where' ||
  { echo "a query of the service builds SQL from a string" >&2; exit 1; }
