#!/bin/bash
# Exit check of step 05.8: a connection PostgreSQL ends leaves the backend running, and the launch
# file calls root scripts that exist.
set -euo pipefail
source "$AGENT_WORK/lib/checks.sh"
! grep -nE 'yarn dev( |")' .claude/launch.json ||
  { echo ".claude/launch.json calls yarn dev, which the root package.json names dev:ui" >&2; exit 1; }
with_postgres
repo_checks
need_tests @sig-net/explorer-backend \
  'a connection the server ends does not end the process' \
  'the backend logs a connection the server ends and goes on'
