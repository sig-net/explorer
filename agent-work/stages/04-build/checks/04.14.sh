#!/bin/bash
# Exit check of step 04.14: the blocking findings of review 04.13 are closed.
set -euo pipefail
source "$AGENT_WORK/lib/checks.sh"
with_postgres
repo_checks
need_tests @sig-net/explorer-backend \
  'an event name holding a NUL character is stored without it' \
  'a failure text of a million characters is recorded within 100 ms' \
  'an inspection the wire rejects is stored as a failed inspection' \
  'an inspection that cannot be serialised is stored as a failed inspection' \
  'a NUL character inside a URL does not hide its credentials' \
  'an inspection holding a NUL character is stored as a failed inspection' \
  'stores a range and moves the cursor together'
