#!/bin/bash
# Exit check of step 07.4. Runs in the step's own worktree.
set -euo pipefail
. "$AGENT_WORK/stages/common.sh"

pages=.github/workflows/pages-deploy.yml
publish=.github/workflows/docker-publish.yml
parse() {
  if python3 -c 'import yaml' 2> /dev/null; then python3 -c 'import yaml,sys; yaml.safe_load(open(sys.argv[1]))' "$1"
  else ruby -ryaml -e 'YAML.load_file(ARGV[0], aliases: true)' "$1"; fi
}
parse "$pages" || { echo "$pages does not parse" >&2; exit 1; }
parse "$publish" || { echo "$publish does not parse" >&2; exit 1; }
grep -q 'packages/ui/dist' "$pages" || { echo "$pages does not publish packages/ui/dist" >&2; exit 1; }
grep -q 'VITE_EXPLORER_BACKEND_URL' "$pages" && grep -q 'vars\.EXPLORER_BACKEND_URL' "$pages" || { echo "$pages does not pass the backend URL from a repository variable" >&2; exit 1; }
for command in 'yarn install --immutable' 'yarn lint' 'yarn build'; do
  grep -q "$command" "$pages" || { echo "$pages lost: $command" >&2; exit 1; }
done
grep -q 'packages/backend/Dockerfile' "$publish" || { echo "$publish does not build the backend image" >&2; exit 1; }
grep -q -- '-backend' "$publish" || { echo "$publish does not name the backend image" >&2; exit 1; }
for file in "$pages" "$publish"; do
  if grep -E '^\s*-?\s*uses: ' "$file" | grep -Ev 'uses: [A-Za-z0-9_./-]+@[0-9a-f]{40}( |$)' | grep -q .; then
    echo "$file uses an action that is not pinned to a commit hash" >&2; exit 1
  fi
  if grep -Eq '^\s*(pull_request|pull_request_target|schedule):' "$file"; then echo "$file gained a trigger" >&2; exit 1; fi
  grep -q 'persist-credentials: false' "$file" || { echo "$file checks out with credentials kept" >&2; exit 1; }
done
before="$(git show "$AGENT_WORK_PARENT:$publish" | grep -Eo 'uses: [^ ]+' | sort -u)"
after="$(grep -Eo 'uses: [^ ]+' "$publish" | sort -u)"
test -z "$(comm -13 <(echo "$before") <(echo "$after"))" || { echo "$publish uses an action it did not use before" >&2; exit 1; }
