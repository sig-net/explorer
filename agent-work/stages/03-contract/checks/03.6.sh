#!/bin/bash
# Exit check of step 03.6, which changes no file: it is checked on its report.
set -euo pipefail
. "$AGENT_WORK/stages/common.sh"
review_ok
