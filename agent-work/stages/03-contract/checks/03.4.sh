#!/bin/bash
# Exit check of step 03.4: every caller of a request is stored, and a page counts its matching events.
set -euo pipefail
source "$AGENT_WORK/lib/checks.sh"
with_postgres
repo_checks
need_tests @sig-net/explorer-backend \
  'the store keeps every caller of a request' \
  'a caller search reads no table in full' \
  'migrating twice changes nothing' \
  'a lifecycle view row satisfies the wire schema' \
  'the list query reads no table in full'
need_tests @sig-net/explorer-api 'a page counts the events of the matching requests'
grep -q 'request_callers' packages/backend/src/db/migrations/0001_network_tables.sql ||
  { echo "the migration makes no request_callers table" >&2; exit 1; }
grep -q 'request_callers' packages/backend/src/db/schema.ts ||
  { echo "schema.ts has no type for request_callers" >&2; exit 1; }
grep -q 'matchingEvents' packages/api/src/wire.ts ||
  { echo "the wire schema has no matchingEvents" >&2; exit 1; }
