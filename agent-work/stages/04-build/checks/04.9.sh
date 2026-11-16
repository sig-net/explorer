#!/bin/bash
# Exit check of step 04.9: the api package holds D41 and D47, and the seed helpers are shared.
set -euo pipefail
source "$AGENT_WORK/lib/checks.sh"
with_postgres
repo_checks
need_tests @sig-net/explorer-api \
  'a search of fewer than three characters matches every lifecycle' \
  'a text loses the credentials of every url it holds' \
  'the error of a network crosses the wire without a token' \
  'a failed inspection crosses the wire without a token'
grep -q 'export const LIFECYCLES_MIN_SEARCH_LENGTH = 3' packages/api/src/service.ts ||
  { echo "service.ts does not export LIFECYCLES_MIN_SEARCH_LENGTH = 3" >&2; exit 1; }
grep -q 'export function textWithoutUrlCredentials' packages/api/src/wire.ts ||
  { echo "wire.ts does not export textWithoutUrlCredentials" >&2; exit 1; }
for helper in seedNetworkEvents storedInspectionsOfSeed; do
  grep -qE "export (async )?function $helper\b" packages/backend/src/db/testing.ts ||
    { echo "db/testing.ts does not export $helper" >&2; exit 1; }
done
! grep -n 'function seedEvents' packages/backend/src/db/network-schema.test.ts ||
  { echo "network-schema.test.ts still defines seedEvents" >&2; exit 1; }
