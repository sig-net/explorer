#!/bin/bash
# Exit check of step 02.2: the three packages exist, resolve from Node, and the repository checks pass.
set -euo pipefail
source "$AGENT_WORK/lib/checks.sh"
node - <<'JS'
const need = {
  lib: { name: '@sig-net/explorer-lib', deps: ['@sig-net/midnight'] },
  api: { name: '@sig-net/explorer-api', deps: ['@sig-net/explorer-lib', '@sig-net/midnight', 'zod', 'hono'] },
  backend: { name: '@sig-net/explorer-backend', deps: ['@sig-net/explorer-lib', '@sig-net/explorer-api', '@sig-net/midnight', '@midnightntwrk/ledger-v9', 'hono', '@hono/node-server', 'kysely', 'pg', 'zod'] },
}
let bad = 0
for (const [dir, { name, deps }] of Object.entries(need)) {
  const p = require(`./packages/${dir}/package.json`)
  if (p.name !== name || p.private !== true || p.type !== 'module') { console.error(`packages/${dir}: wrong name, not private or not a module`); bad++ }
  if ((p.exports?.['.'] ?? p.exports) !== './src/index.ts') { console.error(`packages/${dir}: exports is not ./src/index.ts`); bad++ }
  for (const d of ['typescript', 'vitest']) if (!p.devDependencies?.[d]) { console.error(`packages/${dir}: no devDependency ${d}`); bad++ }
  for (const f of ['tsconfig.json', 'vitest.config.ts', 'src/index.ts']) if (!require('node:fs').existsSync(`packages/${dir}/${f}`)) { console.error(`packages/${dir}: no ${f}`); bad++ }
  for (const s of ['typecheck', 'test']) if (!p.scripts?.[s]) { console.error(`packages/${dir}: no ${s} script`); bad++ }
  for (const d of deps) if (!p.dependencies?.[d]) { console.error(`packages/${dir}: no dependency ${d}`); bad++ }
}
const backend = require('./packages/backend/package.json')
if (backend.scripts?.start !== 'node src/main.ts') { console.error('packages/backend: start is not node src/main.ts'); bad++ }
for (const d of ['@types/pg', '@types/node']) if (!backend.devDependencies?.[d]) { console.error(`packages/backend: no devDependency ${d}`); bad++ }
const ui = require('./packages/ui/package.json')
for (const d of ['@sig-net/explorer-lib', '@sig-net/explorer-api']) if (!ui.dependencies?.[d]) { console.error(`packages/ui: no dependency ${d}`); bad++ }
process.exit(bad ? 1 : 0)
JS
repo_checks
probe=packages/backend/src/zz-resolve-probe.ts
trap 'rm -f "$probe"' EXIT
printf "import '@sig-net/explorer-lib'\nimport '@sig-net/explorer-api'\nimport 'kysely'\nimport 'hono'\nimport 'pg'\nimport 'zod'\nimport '@midnightntwrk/ledger-v9'\nconst ok: string = 'resolved'\nconsole.log(ok)\n" > "$probe"
test "$(node "$probe")" = resolved || { echo "Node does not run a TypeScript file that imports the workspaces and dependencies" >&2; exit 1; }
