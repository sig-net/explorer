#!/bin/bash
# Exit check of step 04.2. Runs in the step's own worktree.
set -euo pipefail
. "$AGENT_WORK/stages/common.sh"

d=packages/backend/src
test "$(find "$d/repositories/sql" -name '*-repository-sql.ts' | wc -l)" -ge 6 || { echo "fewer than six repository implementations" >&2; exit 1; }
for file in repositories/sql/unit-of-work.ts sign-requests/apply-events.ts; do
  test -f "$d/$file" || { echo "$d/$file is missing" >&2; exit 1; }
done
grep -rq 'ChainDataConflict' "$d/repositories/sql" || { echo "no ChainDataConflict in the repositories" >&2; exit 1; }
grep -rq 'deriveSignRequest' "$d/sign-requests" || { echo "the aggregate does not answer to deriveSignRequest" >&2; exit 1; }
grep -rlq 'deriveSignRequest' "$d/sign-requests"/*.test.ts || { echo "no test compares the table with deriveSignRequest" >&2; exit 1; }
no_match "a repository casts a row instead of parsing it" ' as (SignRequest|SignetEvent)\b' -- "$d/repositories/sql"

postgres_up
yarn install --immutable > /dev/null
yarn lint
yarn build
yarn check
left="$(docker compose -p explorer exec -T postgres psql -U explorer -d explorer -Atc "select count(*) from pg_database where datname like 'scratch_%'")"
test "$left" = 0 || { echo "$left scratch database(s) were left behind by the tests" >&2; exit 1; }
