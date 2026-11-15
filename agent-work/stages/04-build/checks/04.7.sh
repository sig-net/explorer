#!/bin/bash
# Exit check of step 04.7. Runs in the step's own worktree.
set -euo pipefail
. "$AGENT_WORK/stages/common.sh"

ui=packages/ui/src
for file in components/contexts/ExplorerBackendContext.tsx components/use-polled-query.ts components/use-polled-query.test.tsx \
  components/midnight/sign-bidirectional-lifecycle-details.tsx lib/explorer-backend/backend-url.ts; do
  test -f "$ui/$file" || { echo "$ui/$file is missing" >&2; exit 1; }
done
grep -q 'VITE_EXPLORER_BACKEND_URL' "$ui/vite-env.d.ts" || { echo "VITE_EXPLORER_BACKEND_URL is not declared" >&2; exit 1; }
grep -q 'ExplorerBackendProvider' "$ui/routes/__root.tsx" || { echo "the provider is not mounted at the root" >&2; exit 1; }
no_match "a file that is not a test imports the fakes" "@explorer/api/fakes" -- "$ui" ':!*.test.ts' ':!*.test.tsx' ':!*.fixture.ts'

postgres_up
yarn install --immutable > /dev/null
yarn lint
yarn build
wasm_ok
if grep -rlq 'signet-history\|ServiceFake' packages/ui/dist/assets; then echo "the production bundle holds a fake" >&2; exit 1; fi
yarn check 2>&1 | tee /tmp/check-04.7.$$
tests_at_least 150 /tmp/check-04.7.$$; rm -f /tmp/check-04.7.$$
