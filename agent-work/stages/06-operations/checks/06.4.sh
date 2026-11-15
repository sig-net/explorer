#!/bin/bash
# Exit check of step 06.4, which changes no file: it is checked on its report.
set -euo pipefail
. "$AGENT_WORK/stages/common.sh"
review_ok
dirty="$(git status --porcelain -- packages | head -5)"
test -z "$dirty" || { echo "the review left changes behind:" >&2; echo "$dirty" >&2; exit 1; }
left="$(docker compose -p explorer exec -T postgres psql -U explorer -d explorer -Atc "select count(*) from pg_database where datname like 'scratch_%'")"
test "$left" = 0 || { echo "$left scratch database(s) were left behind" >&2; exit 1; }
