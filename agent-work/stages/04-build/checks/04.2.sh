#!/bin/bash
# Exit check of step 04.2: the ingest's eighteen tests pass against a real PostgreSQL.
set -euo pipefail
source "$AGENT_WORK/lib/checks.sh"
with_postgres
repo_checks
need_tests @sig-net/explorer-backend \
  'the first cycle records the identity and starts at the start block' \
  'stores a range and moves the cursor together' \
  'a failing read leaves the cursor and the tables unchanged' \
  'a failure inside the transaction stores nothing' \
  'a cycle after a commit reads on from the new cursor and stores nothing twice' \
  'of two cycles from one cursor only one commits' \
  'a changed genesis hash stops the network and writes nothing' \
  'a replaced cursor block stops the network' \
  'changed contract addresses or start block stop the network' \
  'never reads past the tip less the margin, nor more than the range' \
  'a response stored before its request completes the same row' \
  'stores every caller of a request notified twice' \
  'the request rows equal a rebuild from the stored events after any order of arrival' \
  'stores an event that does not decode without a request row' \
  'inspects a transaction once with all its notifications and stores a failed inspection' \
  'stores a transaction without a notification uninspected' \
  'a transaction that cannot be fetched fails the cycle' \
  'the recorded error carries no query string'
grep -rqE 'export (async )?function runIngestCycle\b' packages/backend/src/ingest --include='*.ts' ||
  { echo "packages/backend/src/ingest does not export the function runIngestCycle" >&2; exit 1; }
! grep -rnE '\bdeleteFrom\(|DELETE FROM|TRUNCATE' packages/backend/src/ingest --include='*.ts' --exclude='*.test.ts' ||
  { echo "the ingest removes rows, against D45" >&2; exit 1; }
