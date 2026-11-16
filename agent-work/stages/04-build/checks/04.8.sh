#!/bin/bash
# Exit check of step 04.8: the review covers its eight headings and marks every finding.
set -euo pipefail
source "$AGENT_WORK/lib/checks.sh"
review_check 'atomicity' 'interleavings' 'the source' 'the inspection' 'the request rows' 'stopping' 'secrets' 'the checks'
