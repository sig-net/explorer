# Sourced by the exit checks: what several of them share. Every function exits non-zero on failure.

# A scratch PostgreSQL 17 for this check alone, removed when the check exits. Exports
# EXPLORER_TEST_DATABASE_URL. It starts one container on a port Docker picks.
with_postgres() {
  local name="explorer-check-pg-$$-$RANDOM" tries=0 port
  docker run -d --rm --name "$name" -e POSTGRES_PASSWORD=check -p 127.0.0.1::5432 postgres:17 >/dev/null
  # shellcheck disable=SC2064
  trap "docker rm -f $name >/dev/null 2>&1 || true" EXIT
  # The image's first start runs a server on the socket alone, so only a TCP answer means ready.
  until docker exec "$name" psql -U postgres -h 127.0.0.1 -c 'select 1' >/dev/null 2>&1; do
    tries=$((tries + 1))
    test "$tries" -lt 120 || { echo "the scratch PostgreSQL did not start" >&2; exit 1; }
    sleep 0.5
  done
  port="$(docker port "$name" 5432/tcp | head -1 | sed 's/.*://')"
  export EXPLORER_TEST_DATABASE_URL="postgres://postgres:check@127.0.0.1:$port/postgres"
}

# The preprod indexer and node with the test token, for a check that reads the live network.
# The values never reach the output.
with_preprod() {
  local id
  id="$(dev-secrets get MIDNIGHT_PREPROD_BLOCKFROST_PROJECT_ID)"
  export EXPLORER_TEST_PREPROD_INDEXER_URL="https://midnight-preprod.blockfrost.io/api/v0?project_id=$id"
  export EXPLORER_TEST_PREPROD_NODE_URL="https://rpc.midnight-preprod.blockfrost.io?project_id=$id"
}

# What CI runs, in CI's order (install, then lint), then the rest of `yarn check` and the build.
repo_checks() {
  yarn install --immutable
  yarn lint
  yarn check
  yarn build
}

# need_tests <workspace> <test title>...: runs the workspace's tests and requires each title to
# name at least one test, all of them passed. A title matches a test whose full name contains it.
need_tests() {
  local workspace="$1" out
  shift
  out="$(mktemp)"
  yarn workspace "$workspace" vitest run --reporter=json --outputFile="$out" >/dev/null 2>&1 || true
  node - "$out" "$@" <<'JS'
const fs = require('node:fs')
const [file, ...titles] = process.argv.slice(2)
let report
try { report = JSON.parse(fs.readFileSync(file, 'utf8')) } catch { console.error('the test run wrote no report: run the workspace tests by hand'); process.exit(1) }
const tests = report.testResults.flatMap((f) => f.assertionResults)
let bad = 0
for (const title of titles) {
  const hits = tests.filter((t) => t.fullName.includes(title))
  if (hits.length === 0) { console.error(`no test is named: ${title}`); bad++ }
  else if (hits.some((t) => t.status !== 'passed')) { console.error(`not passed: ${title}`); bad++ }
}
if (report.numFailedTests > 0) { console.error(`${report.numFailedTests} test(s) of the workspace fail`); bad++ }
process.exit(bad === 0 ? 0 : 1)
JS
}

# review_check <heading>...: a review's report must exist, hold a FINDINGS section in which every
# line is marked `blocking:`, `advisory:` or is `none`, and a line `covered: <heading>` for each
# heading the review had to attack.
review_check() {
  local report="${AGENT_WORK_REPORT:-}" findings unmarked heading
  test -s "$report" || { echo "no report is filed yet: file it, then run this again" >&2; exit 1; }
  findings="$(awk '/^FINDINGS[[:space:]]*$/ {inside = 1; next} /^[A-Z][A-Z ]+[[:space:]]*$/ {inside = 0} inside' "$report")"
  test -n "$findings" || { echo "the report has no FINDINGS section, or it is empty (write \`none\`)" >&2; exit 1; }
  for heading in "$@"; do
    grep -qF "covered: $heading" "$report" || { echo "the report has no line \`covered: $heading\`" >&2; exit 1; }
  done
  unmarked="$(grep -vE '^(blocking: |advisory: |none[[:space:]]*$|[[:space:]]|$)' <<< "$findings" || true)"
  test -z "$unmarked" || { echo "these lines of FINDINGS carry no mark:" >&2; echo "$unmarked" >&2; exit 1; }
}
