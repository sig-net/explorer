#!/bin/bash
# Exit check of step 02.1. Runs in the step's own worktree.
set -euo pipefail
. "$AGENT_WORK/stages/common.sh"

for gone in src public index.html vite.config.ts tsconfig.app.json components.json; do
  test ! -e "$gone" || { echo "$gone is still at the root" >&2; exit 1; }
done
test -d packages/ui/src || { echo "packages/ui/src is missing" >&2; exit 1; }
test "$(jq -r .name packages/ui/package.json)" = "@explorer/ui" || { echo "packages/ui is not named @explorer/ui" >&2; exit 1; }
jq -e '.workspaces == ["packages/*"] and .private == true' package.json > /dev/null || { echo "the root is not a private workspace root" >&2; exit 1; }
for script in dev build preview typecheck lint format format:check test check; do
  jq -e --arg s "$script" '.scripts[$s] | type == "string"' package.json > /dev/null || { echo "the root lost its script: $script" >&2; exit 1; }
done

yarn install --immutable > /dev/null
yarn lint
yarn build
wasm_ok
yarn check 2>&1 | tee /tmp/check-02.1.$$
tests_at_least 143 /tmp/check-02.1.$$; rm -f /tmp/check-02.1.$$

EXPLORER_BASE_PATH=/explorer/ yarn build > /dev/null
grep -q '"/explorer/assets/' packages/ui/dist/index.html || { echo "the /explorer/ build does not put its base in index.html" >&2; exit 1; }
yarn build > /dev/null

no_match "a path of the app as it was before the move" '(^|[^/A-Za-z-])src/(lib|components|routes|index\.css|routeTree|fonts|vite-env)' -- . ':!packages/ui' ':!agent-work' ':!probes' ':!yarn.lock'
grep -q 'agent-work' .oxfmtrc.json || { echo ".oxfmtrc.json no longer ignores agent-work" >&2; exit 1; }
