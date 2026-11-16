#!/bin/bash
# Exit check of step 02.1: the app is packages/ui in a workspaces root and still builds as before.
set -euo pipefail
source "$AGENT_WORK/lib/checks.sh"
test -d packages/ui/src && test -f packages/ui/vite.config.ts || { echo "the app is not in packages/ui" >&2; exit 1; }
for gone in src public index.html vite.config.ts Dockerfile docker components.json; do
  test ! -e "$gone" || { echo "$gone is still at the root" >&2; exit 1; }
done
node -e "const p=require('./package.json'); if(!p.workspaces||!p.private) process.exit(1); if(require('./packages/ui/package.json').name!=='@sig-net/explorer-ui') process.exit(1)" ||
  { echo "the root is not a private workspaces root, or the UI package is misnamed" >&2; exit 1; }
grep -q '"agent-work"' .oxlintrc.json && grep -q '"agent-work"' .oxfmtrc.json && grep -qx 'agent-work' .dockerignore ||
  { echo "agent-work is no longer ignored by oxlint, oxfmt or the Docker context" >&2; exit 1; }
repo_checks
# The build emits the onchain runtime and one ledger build, as AGENTS.md requires.
wasm="$(find packages/ui/dist -name '*.wasm' | wc -l)"
test "$wasm" -eq 2 || { echo "the build emits $wasm WebAssembly files, 2 are expected" >&2; exit 1; }
(cd packages/ui && EXPLORER_BASE_PATH=/explorer/ yarn build >/dev/null)
grep -q '/explorer/assets/' packages/ui/dist/index.html || { echo "the base path build does not prefix its assets" >&2; exit 1; }
docker build -q -f packages/ui/Dockerfile -t explorer-check-ui-02-1 . >/dev/null
docker rmi explorer-check-ui-02-1 >/dev/null
