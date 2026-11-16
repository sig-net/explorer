#!/bin/bash
# Exit check of step 04.6: the UI has no ledger WebAssembly and no indexer read, and its tests pass.
set -euo pipefail
source "$AGENT_WORK/lib/checks.sh"
with_postgres
repo_checks
need_tests @sig-net/explorer-ui \
  'verifies a signature against the request the lifecycle carries' \
  'a failed inspection leaves the signature unverified and says why' \
  'shows the call chains and the request of an inspection' \
  'shows the reason of a failed inspection'
! grep -q 'ledger-v9' packages/ui/package.json || { echo "the UI still depends on the ledger" >&2; exit 1; }
! grep -rnE "ledger-v9|loadSignBidirectionalTransactionInspection|signetEventSourceFromIndexer|indexerServices" packages/ui/src packages/ui/vite.config.ts ||
  { echo "the UI still names the ledger, the loader or the indexer services" >&2; exit 1; }
wasm="$(find packages/ui/dist -name '*.wasm' | wc -l)"
test "$wasm" -eq 1 || { echo "the UI build emits $wasm WebAssembly files, 1 is expected" >&2; exit 1; }
