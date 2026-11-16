#!/bin/bash
# Exit check of stage 02-workspace: on the merged branch the workspaces resolve, the shared
# modules are in lib, no test was lost on the way, and the UI image still builds.
set -euo pipefail
source "$AGENT_WORK/lib/checks.sh"
bash "$AGENT_WORK/stages/02-workspace/checks/02.2.sh"
bash "$AGENT_WORK/stages/02-workspace/checks/02.3.sh"
test "$(passed_tests)" -ge 143 || { echo "fewer than the 143 tests of the untouched tree pass" >&2; exit 1; }
test "$(find packages/ui/dist -name '*.wasm' | wc -l)" -eq 2 || { echo "the UI build must emit two WebAssembly files" >&2; exit 1; }
docker build -q -f packages/ui/Dockerfile -t explorer-check-ui-stage-02 . >/dev/null
docker rmi explorer-check-ui-stage-02 >/dev/null
