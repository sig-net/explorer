#!/bin/bash
# Exit check of step 04.2: the ingest's seventeen tests pass against a real PostgreSQL.
set -euo pipefail
source "$AGENT_WORK/lib/checks.sh"
with_postgres
repo_checks
need_tests @sig-net/explorer-backend \
  'the first cycle records the identity and starts at the start block' \
  'stores a range and moves the cursor together' \
  'a failing read leaves the cursor and the tables unchanged' \
  'a failure inside the transaction stores nothing' \
  'reading a range again stores nothing twice' \
  'of two cycles from one cursor only one commits' \
  'a changed genesis hash stops the network and writes nothing' \
  'a replaced cursor block stops the network' \
  'changed contract addresses stop the network' \
  'never reads past the tip less the margin, nor more than the range' \
  'a response stored before its request completes the same row' \
  'stores an event that does not decode without a request row' \
  'inspects a transaction once and stores a failed inspection' \
  'a transaction that cannot be fetched fails the cycle' \
  'backs off after failures and resets on success' \
  'a stopped network resumes after its schema is wiped' \
  'the recorded error carries no query string'
