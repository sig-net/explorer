#!/bin/bash
# Exit check of step 04.11: an inspection the store refuses is kept as a failed inspection.
set -euo pipefail
source "$AGENT_WORK/lib/checks.sh"
with_postgres
repo_checks
need_tests @sig-net/explorer-backend \
  'an inspection holding a NUL character is stored as a failed inspection' \
  'a thrown reason holding a NUL character is stored' \
  'inspects a transaction once with all its notifications and stores a failed inspection' \
  'stores a range and moves the cursor together'
