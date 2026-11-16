#!/bin/bash
# Exit check of step 05.6: DECISIONS.md holds its fifteen sections and stands without the plan.
# It starts no test suite: the step changes one document.
set -euo pipefail
source "$AGENT_WORK/lib/checks.sh"
test -s DECISIONS.md || { echo "DECISIONS.md is missing or empty" >&2; exit 1; }
last=0
while IFS= read -r heading; do
  line="$(grep -nxF -- "## $heading" DECISIONS.md | head -1 | cut -d: -f1 || true)"
  test -n "$line" || { echo "DECISIONS.md has no section \`## $heading\`" >&2; exit 1; }
  test "$line" -gt "$last" || { echo "the section \`## $heading\` is out of order" >&2; exit 1; }
  last="$line"
done <<'HEADINGS'
PostgreSQL, with one schema per network
The request list is a maintained table read through a view
The processed block moves in the transaction that stores its data
The ingest only inserts
The backend inspects each transaction and keeps its raw bytes
Events and request records cross the wire as the bytes the contract emitted
The indexer is the one source
A network stops on a mismatch and is wiped only by an operator
No URL credential leaves the server
Search
How the process starts, reports ready and stops
What stays in the browser
Tests run against a real PostgreSQL
The backend runs its TypeScript sources
Two images, both built from the repository root
HEADINGS
test "$(grep -c '^## ' DECISIONS.md)" -eq 15 || { echo "DECISIONS.md does not hold exactly 15 sections" >&2; exit 1; }
! grep -nE 'agent-work|\b[DAOQ][0-9]{1,2}\b' DECISIONS.md ||
  { echo "DECISIONS.md cites the plan: a decision, assumption, outcome or question number, or agent-work" >&2; exit 1; }
! grep -niE '\b(stage [0-9]|step [0-9]|planner|orchestrator|subagent|review [0-9])' DECISIONS.md ||
  { echo "DECISIONS.md tells the history of the task" >&2; exit 1; }
test "$(wc -w < DECISIONS.md)" -ge 900 || { echo "DECISIONS.md is under 900 words for 15 sections: the reasons are missing" >&2; exit 1; }
light_checks
