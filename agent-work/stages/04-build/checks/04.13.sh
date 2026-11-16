#!/bin/bash
# Exit check of step 04.13: the review covers its heading and marks every finding.
set -euo pipefail
source "$AGENT_WORK/lib/checks.sh"
review_check 'the fix'
