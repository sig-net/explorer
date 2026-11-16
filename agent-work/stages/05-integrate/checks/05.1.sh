#!/bin/bash
# Exit check of step 05.1: the composed backend passes its tests. One thing runs at a time: the
# repository's checks, then the backend's tests.
set -euo pipefail
source "$AGENT_WORK/lib/checks.sh"
for f in packages/backend/src/main.ts packages/backend/src/backend.ts; do
  test -f "$f" || { echo "$f is missing" >&2; exit 1; }
done
grep -q "'EXPLORER_HOST'" packages/backend/src/config/backend-env.ts || { echo "parseBackendEnv does not read EXPLORER_HOST" >&2; exit 1; }
with_postgres
repo_checks
need_tests @sig-net/explorer-backend \
  'indexes the in-memory chain and serves it through the api client' \
  'serves what was stored before a restart and continues from the cursor' \
  'one network that stops leaves the other indexing' \
  'readyz turns 200 after the migrations' \
  'wipe-network drops one schema and the loop indexes it again' \
  'wipe-network of an unknown network drops nothing' \
  "no log line carries a URL's query string" \
  'SIGTERM ends the process cleanly' \
  'a database that does not answer at start exits 1'
no_plan_references
