#!/bin/bash
# Exit check of step 04.1: the source adaptor's and the inspection's tests pass, the live one included.
set -euo pipefail
source "$AGENT_WORK/lib/checks.sh"
with_postgres
with_preprod
repo_checks
need_tests @sig-net/explorer-backend \
  'merges both contracts by event id' \
  'reads a contract configured in both roles once' \
  'rejects an event outside the range' \
  'answers null for a block above the tip' \
  'rejects a response that does not validate' \
  'rejects when the indexer holds no such transaction' \
  'a request that never answers is rejected after the timeout' \
  'an error carries no query string' \
  'stores the call chains and the request cell of the fixture transaction' \
  'stores a null cell for a notification the transaction does not write' \
  'stores one failed notification beside a read one' \
  'stores a transaction that does not deserialise as failed' \
  'reads preprod'
grep -q 'export function inspectTransactionForStorage' packages/backend/src/inspection/sign-bidirectional-transaction-inspection.ts ||
  { echo "the inspection module does not export inspectTransactionForStorage" >&2; exit 1; }
