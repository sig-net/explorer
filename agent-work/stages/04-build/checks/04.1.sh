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
  'an error carries no query string' \
  'stores a failed inspection with its reason' \
  'stores the call chains and the request cell' \
  'reads preprod'
