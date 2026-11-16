#!/bin/bash
# Exit check of step 03.1: the api package's twelve contract tests pass and both entries resolve.
set -euo pipefail
source "$AGENT_WORK/lib/checks.sh"
repo_checks
need_tests @sig-net/explorer-api \
  'round trips every event kind through the wire' \
  'round trips the request record through the wire' \
  'a request cell that does not decode becomes a failed inspection' \
  'client and routes agree over the in-memory service' \
  'pages newest first without repeating or skipping a lifecycle' \
  'searches by a fragment of a request id or a caller' \
  'excludes callers and keeps a lifecycle that names none' \
  'answers 404 for an unknown network and an unknown request' \
  'answers 400 for an invalid query' \
  'the client rejects a body that does not validate' \
  'the source url carries no query string' \
  'the seed holds every case the step lists'
# Resolved from the backend, the consumer that runs the sources under Node.
(cd packages/backend && node --input-type=module -e "
const api = await import('@sig-net/explorer-api')
const testing = await import('@sig-net/explorer-api/testing')
const missing = ['createExplorerApiClient', 'explorerApiRoutes', 'lifecycleWireSchema', 'lifecycleFromWire', 'lifecycleToWire', 'ExplorerApiError']
  .filter((name) => !(name in api))
  .concat(['createInMemoryExplorerService', 'explorerSeed'].filter((name) => !(name in testing)))
if (missing.length > 0) { console.error('the api package does not export: ' + missing.join(', ')); process.exit(1) }
")
