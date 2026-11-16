#!/bin/bash
# Exit check of stage 04-build: on the merged branch every part's tests pass together, the
# inspection exists once, and the review's findings are closed by a decision row.
set -euo pipefail
source "$AGENT_WORK/lib/checks.sh"
with_postgres
with_preprod
repo_checks
test "$(git ls-files | grep -c 'sign-bidirectional-transaction-inspection\.ts$')" -eq 1 ||
  { echo "the transaction inspection module must exist exactly once, in the backend" >&2; exit 1; }
test "$(find packages/ui/dist -name '*.wasm' | wc -l)" -eq 1 || { echo "the UI build must emit one WebAssembly file" >&2; exit 1; }
! grep -rnE 'blockfrost|indexerUrl' packages/ui/src || { echo "the UI still names the indexer" >&2; exit 1; }
grep -qE '^\| D[0-9]+ \|.*review 04\.8' "$AGENT_WORK/decisions.md" ||
  { echo "decisions.md has no row recording how the findings of review 04.8 were closed" >&2; exit 1; }
