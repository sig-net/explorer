#!/bin/bash
# Exit check of step 04.12: the advisory fixes of review 04.8 hold.
set -euo pipefail
source "$AGENT_WORK/lib/checks.sh"
with_postgres
repo_checks
need_tests @sig-net/explorer-backend \
  'a cycle that read under another identity stores nothing' \
  'the source masks a token the server echoes percent encoded' \
  'a returned failed reason is stored without url credentials' \
  'the source reads a range that spans several pages' \
  'of two cycles from one cursor only one commits' \
  'an inspection holding a NUL character is stored as a failed inspection'
need_tests @sig-net/explorer-api \
  'a text loses the credentials of a url whose password holds a bracket' \
  'a text loses the credentials of every url it holds'
