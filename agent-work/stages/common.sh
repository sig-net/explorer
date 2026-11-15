#!/bin/bash
# Shared by the exit checks of stages 02 to 07.

# What CI runs, in CI's order (install, lint, build), then the repository's own check.
ci_checks() {
  yarn install --immutable > /dev/null
  yarn lint
  yarn build
  yarn check
}

# The UI's build holds exactly the two WebAssembly files the repository's rules allow.
wasm_ok() {
  local dist=packages/ui/dist/assets found
  found="$(find "$dist" -name '*.wasm' -printf '%f\n' | sed -E 's/-[A-Za-z0-9_-]{8}\.wasm$/.wasm/' | sort | tr '\n' ' ')"
  test "$found" = "midnight_ledger_wasm_v9_bg.wasm midnight_onchain_runtime_wasm_bg.wasm " ||
    { echo "the UI build emits these .wasm files: $found" >&2; return 1; }
  # The ledger build is referenced by the lazy inspection chunk alone.
  local referrers
  referrers="$(grep -l 'midnight_ledger_wasm_v9_bg' "$dist"/*.js | xargs -n1 basename | grep -v '^sign-bidirectional-transaction-inspection-' || true)"
  test -z "$referrers" || { echo "the ledger WebAssembly is referenced outside the lazy chunk: $referrers" >&2; return 1; }
}

# The shared local Postgres is running. Never stops it.
postgres_up() {
  docker compose -p explorer up -d --wait postgres > /dev/null
}

# tests_at_least <n> <vitest output file>: no test was lost.
tests_at_least() {
  local passed
  passed="$(grep -Eo 'Tests +[0-9]+ passed' "$2" | grep -Eo '[0-9]+' | paste -sd+ | bc)"
  test "${passed:-0}" -ge "$1" || { echo "only ${passed:-0} tests passed, at least $1 expected" >&2; return 1; }
}

# no_match <description> <git grep arguments...>: fails when the pattern is still found.
no_match() {
  local what="$1"; shift
  if git grep -nE "$@" > /tmp/no_match.$$ 2> /dev/null; then
    echo "$what:" >&2; head -20 /tmp/no_match.$$ >&2; rm -f /tmp/no_match.$$; return 1
  fi
  rm -f /tmp/no_match.$$
}

# review_ok: the report of a review step marks every finding, and says so when there is none.
review_ok() {
  test -n "${AGENT_WORK_REPORT:-}" && test -f "$AGENT_WORK_REPORT" || { echo "no report is filed yet" >&2; return 1; }
  grep -Eq '^(FINDING [0-9]+ \((blocking|advisory)\): .+|NO FINDINGS$)' "$AGENT_WORK_REPORT" ||
    { echo "the report has neither a marked finding nor the line NO FINDINGS" >&2; return 1; }
  if grep -E '^FINDING ' "$AGENT_WORK_REPORT" | grep -Evq '^FINDING [0-9]+ \((blocking|advisory)\): .+'; then
    echo "a finding carries no mark, blocking or advisory" >&2; return 1
  fi
  grep -Eq '^ATTACKED: .+' "$AGENT_WORK_REPORT" || { echo "the report has no ATTACKED: line" >&2; return 1; }
}
