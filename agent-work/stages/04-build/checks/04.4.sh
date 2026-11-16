#!/bin/bash
# Exit check of step 04.4: the configuration's and the HTTP shell's ten tests pass.
set -euo pipefail
source "$AGENT_WORK/lib/checks.sh"
with_postgres
repo_checks
need_tests @sig-net/explorer-backend \
  'parses a full environment' \
  'names the variable that is missing or invalid and prints no value' \
  "builds preprod's source from a Blockfrost project id" \
  "takes the SDK's addresses and preprod's start block by default" \
  'the display source url has no query string' \
  'answers a preflight and a GET for an allowed origin' \
  'sends no CORS header to another origin' \
  'healthz is 200 and readyz follows ready' \
  'serves the api routes over the in-memory service' \
  'an unexpected error answers 500 with no detail'
