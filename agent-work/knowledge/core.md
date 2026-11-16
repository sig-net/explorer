# Core pack: read first, every time

## The task

The explorer is a browser app that read Signet request data straight from a Midnight indexer.
No indexer serves a browser any more, so the explorer gets a Node backend that reads the indexer
with a server-side token, stores what it reads in PostgreSQL, and serves it to the UI over HTTP.
The design is `../architecture.md` and every decision is a row of `../decisions.md`: read both
before you start, and never act against a row.

## Where things are

- Until step 02.1 is merged the app is at the repository root (`src/`, `vite.config.ts`). From then on it is `packages/ui/`, beside `packages/lib`, `packages/api` and `packages/backend`. Paths in the packs written before that move are relative to the app's folder. [read 4234222]
- `yarn check` is the repository's own check: typecheck, lint, format check, tests (`package.json:16`). CI runs `yarn install --immutable`, `yarn lint`, then `yarn build` (`.github/workflows/pages-deploy.yml:69-79`). [read 4234222]
- `yarn check` passed on the untouched tree: 27 test files, 143 tests, and left no untracked file. [run 4234222]
- The app's tests run in a real Chromium through Vitest browser mode (`vite.config.ts:76-86`). Chromium is installed on this machine. [run 4234222]
- Scripts that test an assumption are in `probes/`, with their output beside them. [read 4234222]
- `lib/checks.sh` holds what the exit checks share: a scratch PostgreSQL, the preprod URLs, the repository checks, a test-by-title check. [read 4234222]

## Pitfalls of this repository

- Yarn holds back any package published in the last 24 hours (`.yarnrc.yml:16`). When an install refuses a version for its age, take the release before it. [read 4234222]
- `agent-work/` is ignored by oxfmt, oxlint and both Docker build contexts (`.oxfmtrc.json`, `.oxlintrc.json`, `.dockerignore`). Keep it so when those files move. [read 4234222]
- Node 26 on this machine and `node:24.18.0-bookworm-slim` both run a `.ts` file directly, and an import of a workspace package whose `exports` names a `.ts` file resolves through the `node_modules` link. Probed with a two-package workspace. [run 4234222]
- TypeScript here is `erasableSyntaxOnly` with `allowImportingTsExtensions` (`tsconfig.app.json`): no enums, no parameter properties, and relative imports in code Node runs carry the `.ts` extension. [read 4234222]
- `.github/workflows/**` is never edited in this task: this machine cannot push such a change. What a workflow needs is written into the closing report of step 05.3. [read 4234222]
- The Blockfrost token is `MIDNIGHT_PREPROD_BLOCKFROST_PROJECT_ID` in the dev secrets. It is part of a URL's query string, so any error message or log that prints a URL prints the token: strip the query string before printing, and pipe command output through `redact`. [run 4234222]
- A container or a port you start carries a name of your own (`explorer-<step>-...`) and binds `127.0.0.1`. Remove what you started before you report. [read 4234222]
