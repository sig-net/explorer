#!/bin/bash
# Exit check of step 03.2: the schema's eight tests pass against a real PostgreSQL, and fail without one.
set -euo pipefail
source "$AGENT_WORK/lib/checks.sh"
with_postgres
repo_checks
need_tests @sig-net/explorer-backend \
  'migrating twice changes nothing' \
  'two networks get separate schemas' \
  'wiping one network leaves the other untouched' \
  'a lifecycle view row satisfies the wire schema' \
  'the view gives each request of one transaction its own record' \
  'the view lists a response that has no request' \
  'the list query reads no table in full' \
  'the in-memory source serves a range in emission order'
ls packages/backend/src/db/migrations/*.sql >/dev/null 2>&1 || { echo "no SQL migration file exists" >&2; exit 1; }
for file in packages/backend/src/db/schema.ts packages/backend/src/db/testing.ts packages/backend/src/source/port.ts packages/backend/src/source/in-memory.ts; do
  test -s "$file" || { echo "$file does not exist" >&2; exit 1; }
done
unset EXPLORER_TEST_DATABASE_URL
! yarn workspace @sig-net/explorer-backend vitest run >/dev/null 2>&1 ||
  { echo "the database tests pass with no database: they must fail, never skip" >&2; exit 1; }
