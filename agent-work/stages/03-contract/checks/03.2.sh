#!/bin/bash
# Exit check of step 03.2: the schema's seven tests pass against a real PostgreSQL.
set -euo pipefail
source "$AGENT_WORK/lib/checks.sh"
with_postgres
repo_checks
need_tests @sig-net/explorer-backend \
  'migrating twice changes nothing' \
  'two networks get separate schemas' \
  'wiping one network leaves the other untouched' \
  'a lifecycle view row satisfies the wire schema' \
  'the view lists a response that has no request' \
  'the list query reads no table in full' \
  'the in-memory source serves a range in emission order'
ls packages/backend/src/db/migrations/*.sql >/dev/null 2>&1 || { echo "no SQL migration file exists" >&2; exit 1; }
unset EXPLORER_TEST_DATABASE_URL
! yarn workspace @sig-net/explorer-backend vitest run >/dev/null 2>&1 ||
  { echo "the database tests pass with no database: they must fail, never skip" >&2; exit 1; }
