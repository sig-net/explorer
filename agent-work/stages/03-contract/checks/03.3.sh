#!/bin/bash
# Exit check of step 03.3: the review covers its seven headings and marks every finding.
set -euo pipefail
source "$AGENT_WORK/lib/checks.sh"
review_check "the UI's needs" 'no gaps' 'one row per row' 'network separation' 'secrets' 'the indexes' 'the fakes'
