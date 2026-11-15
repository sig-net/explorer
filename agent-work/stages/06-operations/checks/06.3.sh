#!/bin/bash
# Exit check of step 06.3. Runs in the step's own worktree. It starts and kills backend processes.
set -euo pipefail
. "$AGENT_WORK/stages/common.sh"

d=packages/backend/drills
test -f "$d/indexer-double.ts" && test -f "$d/harness.ts" || { echo "the indexer double or the harness is missing" >&2; exit 1; }
test "$(find "$d" -name '*.drill.test.ts' | wc -l)" -ge 8 || { echo "fewer than eight drills" >&2; exit 1; }
all="$(cat "$d"/*.drill.test.ts)"
for drill in 'kill' 'second|two writers' 'replace|changes under' 'changes its mind|one event more|re-read' 'never succeeds|for ever' 'reset-network' 'split|roles' 'schema'; do
  grep -Eiq "$drill" <<< "$all" || { echo "no drill covers: $drill" >&2; exit 1; }
done
no_match "product code imports a drill tool" "drills/" -- packages/backend/src
jq -e '.scripts.drills' package.json > /dev/null || { echo "the root script drills is missing" >&2; exit 1; }
if [ -n "${AGENT_WORK_REPORT:-}" ] && [ -f "$AGENT_WORK_REPORT" ]; then
  grep -Eq '^G24: (holds|fails)' "$AGENT_WORK_REPORT" || { echo "the report has no G24: line" >&2; exit 1; }
fi

postgres_up
yarn install --immutable > /dev/null
yarn lint
yarn build
yarn check
before="$(pgrep -fc 'packages/backend/src/main.ts' || true)"
yarn drills 2>&1 | tee /tmp/check-06.3.$$
tests_at_least 8 /tmp/check-06.3.$$; rm -f /tmp/check-06.3.$$
after="$(pgrep -fc 'packages/backend/src/main.ts' || true)"
test "${after:-0}" -le "${before:-0}" || { echo "the drills left a backend process running" >&2; exit 1; }
left="$(docker compose -p explorer exec -T postgres psql -U explorer -d explorer -Atc "select count(*) from pg_database where datname like 'scratch_%'")"
test "$left" = 0 || { echo "$left scratch database(s) were left behind" >&2; exit 1; }
