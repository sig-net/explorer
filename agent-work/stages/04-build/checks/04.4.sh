#!/bin/bash
# Exit check of step 04.4: the configuration's and the HTTP shell's twelve tests pass.
set -euo pipefail
source "$AGENT_WORK/lib/checks.sh"
with_postgres
repo_checks
need_tests @sig-net/explorer-backend \
  'parses a full environment' \
  'names the variable that is missing or invalid and prints no value' \
  "builds preprod's source from a Blockfrost project id" \
  "takes the SDK's addresses and preprod's start block by default" \
  'takes the poll interval, the tip margin and the range from the decisions by default' \
  'refuses a network that is not a Midnight network or has no source' \
  'answers a preflight and a GET for an allowed origin' \
  'sends no CORS header to another origin' \
  'healthz is 200 and readyz follows ready' \
  'serves the api routes over the in-memory service' \
  'an unknown path answers not_found in the api'"'"'s error body' \
  'an unexpected error answers 500 with no detail and is logged without a token'
for name in parseBackendEnv createHttpApp; do
  grep -rqE "export (async )?function $name\b" packages/backend/src/config packages/backend/src/http --include='*.ts' ||
    { echo "the backend does not export $name" >&2; exit 1; }
done
