# Core pack: read first, every time

## The task

The explorer is a browser-only React app that reads Signet events straight from a Midnight
indexer and keeps them in memory. This task gives it a Node backend that indexes every event of
the Signet signer and responder into Postgres with no gaps, and changes the UI to read that
backend. The design is `../architecture.md`. The decisions are `../decisions.md`: append only,
report a disagreement and never act against an entry. Your stage's `stage.md` says what the
stage delivers and which gates it must close.

## Where things are

- Until stage 02 closes, the app IS the repository root: `src/`, `vite.config.ts`, one `package.json` with no workspaces. Stage 02 moves it to `packages/ui`. [read 6ee55f6]
- Domain modules are in `src/lib/midnight/`, React contexts in `src/components/contexts/`, the one data route in `src/routes/midnight/explorer.tsx`. [read 6ee55f6]
- The SDK is `@sig-net/midnight` 0.26.0-rc.15. Its documented types are `node_modules/@sig-net/midnight/dist/*.d.ts`, starting from `index.d.ts`. [read 6ee55f6]
- The repository's own check is `yarn check`: typecheck, lint, format check, tests, in that order (`package.json:16`). [run 6ee55f6]
- The one workflow that builds (`.github/workflows/pages-deploy.yml:65-79`) runs `yarn install --immutable`, `yarn lint`, `yarn build`. No workflow runs on a pull request. [read 6ee55f6]
- Test secrets are read with `dev-secrets get <NAME>`, names listed by `dev-secrets list`: `MIDNIGHT_PREPROD_BLOCKFROST_PROJECT_ID` and `SEPOLIA_FORK_RPC_URL` are the two this task uses. [run 6ee55f6]

## Pitfalls of this repository

- A fresh worktree has no `node_modules`. Run `yarn install --immutable` before anything else: it takes seconds with the machine's warm cache. [run 6ee55f6]
- `oxfmt` checks every `.md`, `.json`, `.mjs` and `.ts` file in the repository, wherever it is, and `oxlint` lints every script wherever it is. Run `yarn format` before each commit, then `yarn lint`. [run 6ee55f6]
- The tests run in headless Chromium through vitest's browser mode (`vite.config.ts:74-84`). Playwright 1.63.0 and its Chromium are installed on this machine: `yarn test` passes with 143 tests. [run 6ee55f6]
- `yarn check` and `yarn build` leave nothing untracked: `dist` and `node_modules` are ignored. [run 6ee55f6]
- At the baseline `.env` is NOT ignored by git, only `*.local` is (`.gitignore:15`). Step 01.3 changes that. Until it has merged, a secret goes in `.env.local` and nowhere else. [run 6ee55f6]
- The Midnight indexer URL carries its key in the query string (`?project_id=`). Never print it. Pipe any output that may hold a URL through `redact`. The SDK's own errors mask it, but they also echo the response body. [read 6ee55f6]
- Yarn refuses a package published in the last 24 hours, except `@sig-net/*` (`.yarnrc.yml:15-18`). Pick the newest version older than that. [read 6ee55f6]
- `yarn build` must emit exactly two `.wasm` files: `midnight_onchain_runtime_wasm_bg-*.wasm` (1.6MB) on the first load and `midnight_ledger_wasm_v9_bg-*.wasm` (10.8MB) behind the lazy inspection chunk. A third file, or the ledger file in a first-load chunk, breaks a repository rule. [run 6ee55f6]
- Node here is v26.13.1 and Yarn 4.18.0. The image builds on `node:24.18.0-bookworm-slim` (`Dockerfile:6`) and the manifest allows Node 22.12 and later (`package.json:64`). Code for the backend must run on Node 24.18. [run 6ee55f6]
- This machine is shared. A port or a container name already taken belongs to another session: use another port under your own Compose project name, and never stop a container you did not start. [read 6ee55f6]
