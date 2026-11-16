#!/bin/bash
# Exit check of the review of the whole branch: exits 0 only when the filed report gives every
# outcome of architecture.md a verdict and every finding a mark. Runs in the parent branch's worktree.
set -euo pipefail
report="${AGENT_WORK_REPORT:-}"
test -s "$report" || { echo "no report is filed yet: file it, then run this again" >&2; exit 1; }
outcomes="$(grep -oE '^- O[0-9]+ ' "$AGENT_WORK/architecture.md" | tr -d ' -' || true)"
test -n "$outcomes" || { echo "architecture.md names no outcome (\`- O1 <the outcome>\` under \`## Outcomes\`)" >&2; exit 1; }
findings="$(awk '/^FINDINGS[[:space:]]*$/ {inside = 1; next} /^[A-Z][A-Z ]+[[:space:]]*$/ {inside = 0} inside' "$report")"
for outcome in $outcomes; do
  grep -qE "^$outcome: (met|not met) [^[:space:]]" <<< "$findings" ||
    { echo "FINDINGS has no line \`$outcome: met <the evidence>\` or \`$outcome: not met <what is missing>\`" >&2; exit 1; }
done
unmarked="$(grep -vE '^(O[0-9]+: (met|not met) |blocking: |advisory: |none[[:space:]]*$|[[:space:]]|$)' <<< "$findings" || true)"
test -z "$unmarked" || { echo "these lines of FINDINGS are neither an outcome's verdict nor a finding marked blocking: or advisory:" >&2; echo "$unmarked" >&2; exit 1; }
