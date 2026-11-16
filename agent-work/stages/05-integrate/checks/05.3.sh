#!/bin/bash
# Exit check of step 05.3: the documentation exists, covers the configuration, and names nothing
# that is gone. It starts no test suite: the step changes documentation alone.
set -euo pipefail
source "$AGENT_WORK/lib/checks.sh"
docs=(README.md packages/backend/README.md packages/ui/README.md)
for f in "${docs[@]}"; do
  test -s "$f" || { echo "$f is missing or empty" >&2; exit 1; }
done

# Every variable the configuration parses: the quoted names, and each per-network suffix.
env_file=packages/backend/src/config/backend-env.ts
names="$(grep -oE "'EXPLORER_[A-Z0-9_]+'" "$env_file" | tr -d "'" | sort -u || true)"
suffixes="$(grep -oE '\$\{prefix\}_[A-Z0-9_]+' "$env_file" | sed 's/^\${prefix}//' | sort -u || true)"
test "$(wc -w <<< "$names")" -ge 7 || { echo "found fewer than 7 variable names in $env_file: this check no longer reads it" >&2; exit 1; }
test "$(wc -w <<< "$suffixes")" -ge 5 || { echo "found fewer than 5 per-network suffixes in $env_file: this check no longer reads it" >&2; exit 1; }
missing=0
for v in $names $suffixes; do
  grep -q -- "$v" packages/backend/README.md || { echo "packages/backend/README.md does not name $v" >&2; missing=1; }
done
test "$missing" -eq 0
for word in /healthz /readyz wipe-network pg_trgm; do
  grep -q -- "$word" packages/backend/README.md || { echo "packages/backend/README.md does not name $word" >&2; exit 1; }
done
grep -q 'VITE_EXPLORER_API_URL' packages/ui/README.md || { echo "the UI's README does not name VITE_EXPLORER_API_URL" >&2; exit 1; }
for word in 'yarn db:up' 'yarn dev:backend' 'yarn dev:ui' EXPLORER_TEST_DATABASE_URL DECISIONS.md packages/backend/README.md packages/ui/README.md; do
  grep -q -- "$word" README.md || { echo "README.md does not name $word" >&2; exit 1; }
done

# Nothing that is gone: a path, a variable of the UI, a removed module, the plan.
bad=0
for path in $(grep -ohE '(^|[^A-Za-z0-9_./-])packages/[A-Za-z0-9_./@-]+' "${docs[@]}" AGENTS.md | sed -E -e 's/^[^A-Za-z]//' -e 's/[.,:]*$//' | sort -u); do
  # A developer's own env file and a build's output are not in a fresh checkout.
  case "$path" in *'*'*|*/.env*|*/dist|*/dist/*|*/node_modules*) continue ;; esac
  test -e "$path" || { echo "the documentation names $path, which does not exist" >&2; bad=1; }
done
for v in $(grep -ohE 'VITE_[A-Z0-9_]*[A-Z0-9]' "${docs[@]}" AGENTS.md | sort -u); do
  grep -rqF -- "$v" packages/ui/src packages/ui/docker packages/ui/vite.config.ts ||
    { echo "the documentation names $v, which the UI does not read" >&2; bad=1; }
done
test "$bad" -eq 0
! grep -nE 'MidnightSignetEvents|useMidnightSignetEvents|signet-events-window|signet-event-store|indexer-services|sign-bidirectional-transaction-loader|signBidirectionalLifecycleCalledBy|SIGNET_EVENTS_FROM_BLOCK|indexer-block-height' "${docs[@]}" AGENTS.md ||
  { echo "the documentation names a module or a variable the task removed" >&2; exit 1; }
! grep -nE 'agent-work|\bD[0-9]{2}\b' "${docs[@]}" ||
  { echo "the documentation points into agent-work or cites a decision by its number" >&2; exit 1; }
! grep -nE 'yarn dev([^:a-z]|$)' "${docs[@]}" AGENTS.md ||
  { echo "the documentation names yarn dev, which is yarn dev:ui" >&2; exit 1; }
grep -qiE 'query string' AGENTS.md || { echo "AGENTS.md does not carry the rule on a URL's query string" >&2; exit 1; }
grep -qi 'from the backend alone' AGENTS.md || { echo "AGENTS.md does not carry the rule that the UI reads Midnight data from the backend alone" >&2; exit 1; }
light_checks
