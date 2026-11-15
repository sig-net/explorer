# Pack: checks and tooling

Paths and commands here describe the repository BEFORE stage 02. Stage 02 moves the app into
`packages/ui` and the orchestrator rewrites this pack at that checkpoint.

## Commands (run from the worktree root)

| Command | What it does | Mark |
| --- | --- | --- |
| `yarn install --immutable` | Installs from the committed lockfile | `[run]` planning session, clean |
| `yarn check` | `typecheck`, `lint`, `format:check`, `test` in sequence | `[run]` 27 test files, 143 tests passed |
| `yarn build` | `tsc -b && vite build` into `dist` | `[run]` succeeded |
| `yarn dev --host 127.0.0.1` | Vite dev server on `127.0.0.1:5173` | `[run]` |
| `yarn lint`, `yarn format`, `yarn format:check`, `yarn typecheck`, `yarn test` | Oxlint (type aware), Oxfmt, `tsc -b`, Vitest | `[read]` `package.json` |

`yarn check` then `yarn build` is the baseline for every checkpoint.

## What CI runs

`[read]` `.github/workflows/pages-deploy.yml`: `corepack enable && yarn install --immutable`,
`yarn lint`, then `yarn build` with `EXPLORER_BASE_PATH` and `EXPLORER_VERSION`, then
`cp dist/index.html dist/404.html`. It runs on a `vX.Y.Z` tag only. No workflow runs
`yarn check` on a branch. `docker-publish.yml` builds the root `Dockerfile` on a release tag.
Workflow files are changed only in stage 07.

## Build facts that are checkpoints

- `[run]` `yarn build` emits exactly two `.wasm` files: `midnight_onchain_runtime_wasm_bg-*.wasm`
  (about 1.6 MB) and `midnight_ledger_wasm_v9_bg-*.wasm` (about 10.8 MB). A third file, or the
  ledger file referenced from a non-lazy chunk, is a regression.
- `[read]` `vite.config.ts`: `EXPLORER_BASE_PATH` must start and end with `/`. Routes and public
  files must never be root-absolute. After touching either, build with
  `EXPLORER_BASE_PATH=/explorer/` and load `yarn preview`.
- `[read]` `vite.config.ts`: the footer version comes from `git describe`, run by the config.
- `[read]` `.oxfmtrc.json`: no semicolons, single quotes, width 100. `agent-work`, `AGENTS.md`
  and `CLAUDE.md` are ignored by the formatter.

## Tests

- `[read]` `vite.config.ts`: Vitest runs in BROWSER mode (Chromium through Playwright), timezone
  `Asia/Kolkata`, files `src/**/*.test.{ts,tsx}`.
- `[run]` Playwright 1.63.0 needs Chromium build 1243. It was installed on this machine with
  `yarn playwright install chromium`. If a launch fails with "Executable doesn't exist", run that
  command once and report it.
- Backend tests (from stage 03) run in Vitest's Node environment, not the browser.

## Driving the app in a browser

There is no committed browser smoke test before stage 02 (step 02.3 adds one). To check the
running app, write a Playwright script that `require`s `<worktree>/node_modules/playwright`,
loads each route, and fails on console errors, page errors and HTTP statuses of 400 or more.
Scrub `project_id=` values from anything you print.

`[run]` With a valid Blockfrost project id, `/midnight/explorer` on preprod showed thousands of
requests within 30 seconds, and expanding a row (click the first button in the row) loaded the
ledger WebAssembly and showed all three event kinds with a valid signature check.

## Environment files

- `[run]` `.env.local` at the worktree root is gitignored (`git check-ignore .env.local`) and holds
  `VITE_MIDNIGHT_PREPROD_BLOCKFROST_PROJECT_ID`, written from the shared secret
  `MIDNIGHT_PREPROD_BLOCKFROST_PROJECT_ID`.
- Shared secrets that exist: `MIDNIGHT_PREPROD_BLOCKFROST_PROJECT_ID`, `SEPOLIA_FORK_RPC_URL`
  (archive Sepolia with a key), `SEPOLIA_FUNDER_SEED`. `[run]` `dev-secrets list`.
- Pattern to write one: `echo "NAME=$(dev-secrets get SECRET_NAME)" >> .env.local`. Check
  `git check-ignore <file>` first.

## Docker

- `[read]` Root `Dockerfile`: builds the UI and serves it with nginx on 8080.
  `docker/30-explorer-env.sh` writes `VITE_MIDNIGHT_*` variables into `env.js` at container start.
- `[run]` `docker ps` showed no containers during planning. Check again before you start one.
- The local Postgres for this task uses a host port other than 5432 (the demo's).

## Git

- You never commit. See `core.md`.
- `[run]` The remote is `https://github.com/sig-net/explorer.git`. Pushes use a token chosen per
  repository. Whether it may push a workflow change is tested in stage 01.
