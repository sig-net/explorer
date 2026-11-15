#!/bin/bash
# Exit check of step 02.2. Runs in the step's own worktree.
set -euo pipefail
. "$AGENT_WORK/stages/common.sh"

manifest=packages/backend/package.json
test "$(jq -r .name "$manifest")" = "@explorer/backend" || { echo "packages/backend is not named @explorer/backend" >&2; exit 1; }
for dep in drizzle-orm pg zod fastify @fastify/cors pino @sig-net/midnight; do
  jq -e --arg d "$dep" '.dependencies[$d]' "$manifest" > /dev/null || { echo "$manifest lacks the dependency $dep" >&2; exit 1; }
done
for dep in drizzle-kit @types/pg vitest; do
  jq -e --arg d "$dep" '.devDependencies[$d]' "$manifest" > /dev/null || { echo "$manifest lacks the dev dependency $dep" >&2; exit 1; }
done
test "$(jq -r '.dependencies["@sig-net/midnight"]' "$manifest")" = "$(jq -r '.dependencies["@sig-net/midnight"]' packages/ui/package.json)" ||
  { echo "the backend and the UI pin different SDK versions" >&2; exit 1; }
test -f packages/backend/.env.example || { echo "packages/backend/.env.example is missing" >&2; exit 1; }
if git ls-files --error-unmatch packages/backend/.env > /dev/null 2>&1; then echo "packages/backend/.env is tracked" >&2; exit 1; fi

postgres_up
yarn install --immutable > /dev/null
yarn lint
yarn build
wasm_ok
yarn check 2>&1 | tee /tmp/check-02.2.$$
tests_at_least 147 /tmp/check-02.2.$$; rm -f /tmp/check-02.2.$$

left="$(docker compose -p explorer exec -T postgres psql -U explorer -d explorer -Atc "select count(*) from pg_database where datname like 'scratch_%'")"
test "$left" = 0 || { echo "$left scratch database(s) were left behind by the tests" >&2; exit 1; }

runner=node
jq -e '.devDependencies.tsx' "$manifest" > /dev/null && runner="yarn tsx"
test "$($runner packages/backend/scripts/node-runs-source.ts | tail -n 1)" = ok || { echo "Node does not run the package's source here" >&2; exit 1; }
if [ "$runner" = node ]; then
  test "$(docker run --rm -v "$PWD":/repo:ro -w /repo node:24.18.0-bookworm-slim node packages/backend/scripts/node-runs-source.ts | tail -n 1)" = ok ||
    { echo "Node 24.18 does not run the package's source" >&2; exit 1; }
fi
