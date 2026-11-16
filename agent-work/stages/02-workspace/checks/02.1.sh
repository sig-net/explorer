#!/bin/bash
# Exit check of step 02.1: the app is packages/ui in a workspaces root and still builds as before.
set -euo pipefail
source "$AGENT_WORK/lib/checks.sh"
test -d packages/ui/src && test -f packages/ui/vite.config.ts || { echo "the app is not in packages/ui" >&2; exit 1; }
for gone in src public index.html vite.config.ts Dockerfile docker components.json tsconfig.app.json tsconfig.node.json; do
  test ! -e "$gone" || { echo "$gone is still at the root" >&2; exit 1; }
done
node -e "
const p = require('./package.json'), ui = require('./packages/ui/package.json')
const ok = p.private === true && (p.workspaces ?? []).includes('packages/*') &&
  ['typecheck', 'lint', 'format:check', 'test', 'check', 'build', 'dev', 'preview'].every((s) => p.scripts?.[s]) &&
  ui.name === '@sig-net/explorer-ui' && ['typecheck', 'test', 'build'].every((s) => ui.scripts?.[s]) && ui.dependencies?.react
process.exit(ok ? 0 : 1)" ||
  { echo "the root is not a workspaces root with its scripts, or the UI package lacks its name, scripts or dependencies" >&2; exit 1; }
grep -q '"agent-work"' .oxlintrc.json && grep -q '"agent-work"' .oxfmtrc.json && grep -qx 'agent-work' .dockerignore ||
  { echo "agent-work is no longer ignored by oxlint, oxfmt or the Docker context" >&2; exit 1; }
repo_checks
test "$(passed_tests)" -ge 143 || { echo "fewer than the 143 tests of the untouched tree pass" >&2; exit 1; }
# The build emits the onchain runtime and one ledger build, as AGENTS.md requires.
wasm="$(find packages/ui/dist -name '*.wasm' | wc -l)"
test "$wasm" -eq 2 || { echo "the build emits $wasm WebAssembly files, 2 are expected" >&2; exit 1; }
(cd packages/ui && EXPLORER_BASE_PATH=/explorer/ yarn build >/dev/null)
grep -q '/explorer/assets/' packages/ui/dist/index.html || { echo "the base path build does not prefix its assets" >&2; exit 1; }
docker build -q --no-cache -f packages/ui/Dockerfile -t explorer-check-ui-02-1 . >/dev/null
docker rmi explorer-check-ui-02-1 >/dev/null
