#!/bin/bash
# Exit check of step 03.5. Runs in the step's own worktree.
set -euo pipefail
. "$AGENT_WORK/stages/common.sh"

b=packages/backend
for file in src/db/schema.ts src/db/migrate.ts src/db/schema-state.ts src/db/schema.test.ts drizzle.config.ts \
  src/chain-source/chain-source.ts src/chain-source/fake-chain-source.ts src/repositories/unit-of-work.ts; do
  test -f "$b/$file" || { echo "$b/$file is missing" >&2; exit 1; }
done
test "$(find "$b/drizzle" -maxdepth 1 -name '*.sql' | wc -l)" = 1 || { echo "$b/drizzle does not hold exactly one migration" >&2; exit 1; }
grep -qi 'create extension if not exists pg_trgm' "$b"/drizzle/*.sql || { echo "the migration does not create pg_trgm" >&2; exit 1; }
for table in midnight_signet_deployments_v1 midnight_signet_indexer_checkpoints_v1 midnight_signet_events_v1 \
  midnight_signet_sign_requests_v1 midnight_transactions_v1 ethereum_transaction_outputs_v1; do
  grep -q "\"$table\"" "$b"/drizzle/*.sql || { echo "the migration has no table $table" >&2; exit 1; }
done
for method in headBlock blockAt eventsInRange rawTransaction contractExistsAt; do
  grep -q "\b$method\b" "$b/src/chain-source/chain-source.ts" || { echo "MidnightChainSource lacks $method" >&2; exit 1; }
  grep -q "\b$method\b" "$b/src/chain-source/fake-chain-source.ts" || { echo "the fake chain source lacks $method" >&2; exit 1; }
done
no_match "a repository implementation in a stage that ships interfaces only" 'class .* implements .*Repository' -- "$b/src/repositories"

postgres_up
yarn install --immutable > /dev/null
# The committed migration is what the schema generates today.
before="$(cat "$b"/drizzle/*.sql | sha256sum)"
yarn workspace @explorer/backend db:generate > /dev/null
after="$(cat "$b"/drizzle/*.sql | sha256sum)"
test "$before" = "$after" && test -z "$(git status --porcelain -- "$b/drizzle")" ||
  { echo "the committed migration is not what db:generate writes" >&2; git status --short -- "$b/drizzle" >&2; exit 1; }
yarn lint
yarn build
wasm_ok
yarn check
