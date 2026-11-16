# Core pack: read first, every time

## The task

The explorer is a browser app that read Signet request data straight from a Midnight indexer.
No indexer serves a browser any more, so the explorer gets a Node backend that reads the indexer
with a server-side token, stores what it reads in PostgreSQL, and serves it to the UI over HTTP.
The design is `../architecture.md` and every decision is a row of `../decisions.md`. Your step
names the rows and sections it rests on: read those, and never act against a row.

## Where things are

- The app is in `packages/ui/`, moved there by step 02.1 (merge commit `0c17b75`). `packages/` holds no other workspace package at HEAD: `packages/lib`, `packages/api` and `packages/backend` do not exist yet. Paths in the packs written before that move are relative to the app's folder. [run 6a2cf63]
- `yarn check` is the repository's own check: typecheck, lint, format check, tests (`package.json:18`). CI runs `yarn install --immutable`, `yarn lint`, then `yarn build` (`.github/workflows/pages-deploy.yml:69-79`). [read 6a2cf63]
- `yarn check` passed on the untouched tree: 27 test files, 143 tests, and left no untracked file. [run 4234222]
- The test "the button excludes the typed address, and marks the box when it is not one" in `packages/ui/src/components/midnight/excluded-callers-filter.test.tsx` times out in about 1 of 10 runs of the full suite (the orchestrator saw it fail on run 7 of 25), and step 02.4 is fixing it. [run 0c17b75]
- `yarn lint` at the root prints nothing on a clean run: it runs `oxlint` (`package.json:14`) and exits 0 with no output. [run 6a2cf63]
- The build context of `packages/ui/Dockerfile` is the repository root (`packages/ui/Dockerfile:4`), and `.dockerignore` carries the line `**/.env*`, which covers `packages/ui/.env.local`. [read 6a2cf63]
- `.dockerignore` patterns are anchored at the root of the build context, so a pattern without a leading `**/` does not match files in `packages/ui/`. [unverified]
- The app's tests run in a real Chromium through Vitest browser mode (`packages/ui/vite.config.ts:76-86`). Chromium is installed on this machine. [run 6a2cf63]
- Scripts that test an assumption are in `agent-work/probes/`, with their output beside them. [run 6a2cf63]
- `agent-work/lib/checks.sh` holds what the exit checks share: a scratch PostgreSQL, the preprod URLs, the repository checks, a test-by-title check. [read 4234222]

## Pitfalls of this repository

- Yarn holds back any package published in the last 24 hours (`.yarnrc.yml:16`). When an install refuses a version for its age, take the release before it. [read 4234222]
- `agent-work/` is ignored by oxfmt, oxlint and both Docker build contexts (`.oxfmtrc.json`, `.oxlintrc.json`, `.dockerignore`). Keep it so when those files move. [read 4234222]
- Node 26 on this machine and `node:24.18.0-bookworm-slim` both run a `.ts` file directly, and an import of a workspace package whose `exports` names a `.ts` file resolves through the `node_modules` link. Probed with a two-package workspace. [run 4234222]
- TypeScript here is `erasableSyntaxOnly` with `allowImportingTsExtensions` (`packages/ui/tsconfig.app.json`): no enums, no parameter properties, and relative imports in code Node runs carry the `.ts` extension. [read 6a2cf63]
- `.github/workflows/**` is never edited in this task: this machine cannot push such a change. What a workflow needs is written into the closing report of step 05.3. [read 4234222]
- The Blockfrost token is `MIDNIGHT_PREPROD_BLOCKFROST_PROJECT_ID` in the dev secrets. It is part of a URL's query string, so any error message or log that prints a URL prints the token: strip the query string before printing, and pipe command output through `redact`. [run 4234222]
- A container or a port you start carries a name of your own (`explorer-<step>-...`) and binds `127.0.0.1`. Remove what you started before you report. [read 4234222]
- A new step worktree has no `node_modules`: run `yarn install --immutable` before the first test or check. [unverified]
- A workspace that lists `vitest` in its devDependencies lists `vite` beside it, or `yarn install` warns YN0002 about the missing peer. [unverified]
