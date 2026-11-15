#!/bin/bash
# Exit check of step 01.10, which changes no file: it is checked on its report.
set -euo pipefail

test -n "${AGENT_WORK_REPORT:-}" && test -f "$AGENT_WORK_REPORT" || { echo "no report is filed yet" >&2; exit 1; }
grep -Eq '^G12: (holds|fails)$' "$AGENT_WORK_REPORT" || { echo "the report has no line: G12: holds | G12: fails" >&2; exit 1; }
grep -Eq '^PUSH: .+' "$AGENT_WORK_REPORT" || { echo "the report has no PUSH: line" >&2; exit 1; }
grep -Eq '^LEFT BEHIND: none$' "$AGENT_WORK_REPORT" || { echo "the report does not say LEFT BEHIND: none" >&2; exit 1; }
if git ls-remote --exit-code origin 'refs/heads/bernard/upgrade-protocol-workflow-push-probe' > /dev/null 2>&1; then
  echo "the scratch branch still exists on GitHub" >&2; exit 1
fi
