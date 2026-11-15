#!/bin/bash
# Exit check of step 04.5. Runs in the step's own worktree.
set -euo pipefail
. "$AGENT_WORK/stages/common.sh"

d=packages/backend/src/services
for file in sign-request/sign-request-service-impl.ts sign-request/sign-request-service.contract.ts network/network-service-impl.ts network/network-service.contract.ts; do
  test -f "$d/$file" || { echo "$d/$file is missing" >&2; exit 1; }
done
for service in sign-request network; do
  grep -rlq '@explorer/api/fakes' "$d/$service" || { echo "the $service contract suite is not run over the fake" >&2; exit 1; }
done
no_match "a service imports the configuration folder" "from '.*config/" -- "$d/network" "$d/sign-request"
no_match "a service handles a URL" 'indexerUrl|rpcUrl|queryUrl' -- "$d/network" "$d/sign-request"
if git grep -nE '\b(it|test|describe)\.skip\(' -- "$d/network" "$d/sign-request" | grep -v 'reason' > /dev/null; then
  echo "a skipped case carries no reason" >&2; exit 1
fi

postgres_up
yarn install --immutable > /dev/null
yarn lint
yarn build
yarn check
