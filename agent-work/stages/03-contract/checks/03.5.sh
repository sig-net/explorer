#!/bin/bash
# Exit check of step 03.5: the advisory fixes of review 03.3 hold.
set -euo pipefail
source "$AGENT_WORK/lib/checks.sh"
with_postgres
repo_checks
need_tests @sig-net/explorer-backend \
  'the store refuses an unknown sync state' \
  'the view keeps a failed notification beside a read one' \
  'the view gives each request of one transaction its own record' \
  'the store keeps every caller of a request'
need_tests @sig-net/explorer-api \
  'the source URL crosses the wire without credentials' \
  'a page counts the events of the matching requests'
