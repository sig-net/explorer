#!/bin/bash
# Exit check of step 03.1: the api package's ten contract tests pass and both entries resolve.
set -euo pipefail
source "$AGENT_WORK/lib/checks.sh"
repo_checks
need_tests @sig-net/explorer-api \
  'round trips every event kind through the wire' \
  'round trips the request record through the wire' \
  'client and routes agree over the in-memory service' \
  'pages newest first without repeating or skipping a lifecycle' \
  'searches by a fragment of a request id or a caller' \
  'excludes callers' \
  'answers 404 for an unknown network and an unknown request' \
  'answers 400 for an invalid query' \
  'the client rejects a body that does not validate' \
  'the source url carries no query string'
probe=packages/backend/src/zz-api-probe.ts
trap 'rm -f "$probe"' EXIT
cat > "$probe" <<'TS'
import { createExplorerApiClient, explorerApiRoutes } from '@sig-net/explorer-api'
import { createInMemoryExplorerService } from '@sig-net/explorer-api/testing'
console.log([createExplorerApiClient, explorerApiRoutes, createInMemoryExplorerService].every((f) => typeof f === 'function') ? 'exports' : 'missing')
TS
test "$(node "$probe")" = exports || { echo "the api package does not export its client, routes and in-memory service" >&2; exit 1; }
