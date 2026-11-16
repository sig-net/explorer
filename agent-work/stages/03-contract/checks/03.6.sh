#!/bin/bash
# Exit check of step 03.6: the review covers its two headings and marks every finding.
set -euo pipefail
source "$AGENT_WORK/lib/checks.sh"
review_check 'the callers' 'the matching events count'
