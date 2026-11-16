# Sourced by the exit checks: what several of them share. Every function exits non-zero on failure.

# A scratch PostgreSQL 17 for this check alone, removed when the check exits. Exports
# EXPLORER_TEST_DATABASE_URL. It starts one container on a port Docker picks. Inside a stage
# check that runs step checks (EXPLORER_STAGE_CHECK=1) the stage's own container is used.
with_postgres() {
  if test "${EXPLORER_STAGE_CHECK:-}" = 1 && test -n "${EXPLORER_TEST_DATABASE_URL:-}"; then return 0; fi
  local name="explorer-check-pg-$$-$RANDOM" tries=0 port
  docker run -d --rm --name "$name" -e POSTGRES_PASSWORD=check -p 127.0.0.1::5432 postgres:17 >/dev/null
  # shellcheck disable=SC2064
  trap "docker rm -f -v $name >/dev/null 2>&1 || true" EXIT
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
  if test "${EXPLORER_STAGE_CHECK:-}" = 1 && test -n "${EXPLORER_REPO_CHECKED:-}"; then return 0; fi
  yarn install --immutable
  yarn lint
  yarn check
  yarn build
  export EXPLORER_REPO_CHECKED=1
}

# What a step that changes documentation alone needs of the repository's checks: no test suite
# and no build.
light_checks() {
  if test "${EXPLORER_STAGE_CHECK:-}" = 1 && test -n "${EXPLORER_REPO_CHECKED:-}"; then return 0; fi
  yarn install --immutable
  yarn lint
  yarn format:check
}

# No tracked source file under packages/ cites a row of decisions.md or the plan's folder, which
# is removed when the pull request opens.
no_plan_references() {
  local files hits
  files="$(git ls-files packages | grep -E '\.(ts|tsx|sql|sh|json|yaml|yml|conf|md)$|Dockerfile$' || true)"
  test -n "$files" || { echo "no source file is tracked under packages/" >&2; exit 1; }
  # shellcheck disable=SC2086
  hits="$(grep -nE '\bD[0-9]{2}\b|agent-work' $files || true)"
  test -z "$hits" || { echo "these lines cite a decision number or agent-work, which go with the folder:" >&2; echo "$hits" >&2; exit 1; }
}

# For a stage check: every step check it runs after this shares its PostgreSQL, its repository
# checks and one test run per workspace.
as_stage_check() {
  export EXPLORER_STAGE_CHECK=1
  EXPLORER_TEST_REPORTS="$(mktemp -d)"
  export EXPLORER_TEST_REPORTS
}

# need_tests <workspace> <test title>...: runs the workspace's tests and requires each title to
# name at least one test, all of them passed. A title matches a test whose full name contains it.
need_tests() {
  local workspace="$1" out
  shift
  if test -n "${EXPLORER_TEST_REPORTS:-}"; then out="$EXPLORER_TEST_REPORTS/${workspace##*/}.json"; else out="$(mktemp)"; fi
  test -s "$out" ||
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

# The number of tests that pass over every workspace that has a test script.
passed_tests() {
  local total=0 out workspace
  for workspace in $(yarn workspaces list --json | node -e "
    const fs = require('node:fs')
    for (const line of fs.readFileSync(0, 'utf8').trim().split('\n')) {
      const w = JSON.parse(line)
      if (w.location !== '.' && require(process.cwd() + '/' + w.location + '/package.json').scripts?.test) console.log(w.name)
    }"); do
    out="$(mktemp)"
    yarn workspace "$workspace" vitest run --reporter=json --outputFile="$out" >/dev/null 2>&1 || true
    total=$((total + $(node -e "try{console.log(JSON.parse(require('node:fs').readFileSync('$out','utf8')).numPassedTests)}catch{console.log(0)}")))
  done
  echo "$total"
}
