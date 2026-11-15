#!/bin/bash
# Exit check of step 04.11, which changes no file: it is checked on its report.
set -euo pipefail
. "$AGENT_WORK/stages/common.sh"
review_ok
dirty="$(git status --porcelain -- packages | head -5)"
test -z "$dirty" || { echo "the review left changes behind:" >&2; echo "$dirty" >&2; exit 1; }
