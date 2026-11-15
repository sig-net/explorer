# Stage 02: workspaces

## Delivers

A Yarn workspace monorepo. The app lives in `packages/ui` and behaves exactly as before.
`packages/lib`, `packages/api` and `packages/backend` exist as empty, wired packages: each
typechecks, lints, formats and tests, and a cross-package import is proven in the browser bundle
and in Node. A committed browser smoke test exists and is the tool later stages check the UI with.

## Assumes

- Gate G5 is decided (how packages export TypeScript and how the backend runs).
- Workflow files are not touched (decision D20).

## Shape

A chain, then a pair. The move (02.1) changes nearly every path, so nothing can run beside it.
Afterwards 02.2 and 02.3 touch different packages. Both may add entries to manifests, so they do
NOT share a worktree: 02.2 runs in the main worktree and 02.3 in its own.

```
02.1 -> ( 02.2 | 02.3 ) -> review
```

## Steps

### Step 02.1: move the app into `packages/ui`

- **Stream / model:** `workspace` / `fable`
- **Waits on:** nothing
- **Runs in:** main worktree
- **Packs:** `checks-and-tooling.md`, `ui-codebase.md`
- **Scope:** the whole repository except `agent-work/` and `.github/workflows/`
- **Context:** heavy
- **Goal:** The same app, one level down, with a root that only orchestrates workspaces.
- **Work:**
  1. Census first. List every file at the root and decide for each: moves to `packages/ui`,
     stays at the root, or is split. Report the table. Expected: `src`, `public`, `index.html`,
     `vite.config.ts`, `components.json`, the three `tsconfig*.json` and the app's dependencies
     move. `.yarnrc.yml`, `yarn.lock`, `.editorconfig`, `.gitignore`, `LICENSE`, `README.md`,
     the rules files, `.vscode`, `.claude` stay. Lint and format configuration stays at the root
     and covers every package. `Dockerfile`, `docker/` and `.dockerignore` stay at the root and
     are adjusted to build `packages/ui`.
  2. Root `package.json`: `private`, `workspaces: ["packages/*"]`, `packageManager`, `engines`,
     the `resolutions`, and scripts that fan out: `check`, `typecheck`, `lint`, `format`,
     `format:check`, `test`, `build`, `dev`. `yarn check` and `yarn build` at the root must keep
     meaning what they mean today.
  3. Name the UI package and keep its scripts.
  4. `vite.config.ts` runs `git describe` for the footer version: confirm it still resolves from
     the new directory.
  5. Keep `agent-work` out of the formatter in the root configuration.
  6. The mover pays: grep the whole repository for every path that moved (`src/`, `public/`,
     `dist`, `vite.config.ts`, `components.json`, `index.html`) in `README.md`, the repository's
     engineering rules, `.vscode`, `.claude/launch.json`, `Dockerfile`, `docker/`,
     `.dockerignore`, `components.json` and comments. Fix every hit. Do NOT edit
     `.github/workflows/`: list the lines that will need changing in your report instead.
  7. Run every check in the exit check.
- **Exit check:**
  1. `yarn install --immutable` after the lockfile is regenerated once, then again clean.
  2. `yarn check` passes with the same test count as before (27 files, 143 tests).
  3. `yarn build` emits exactly the two `.wasm` files named in `checks-and-tooling.md`.
  4. `EXPLORER_BASE_PATH=/explorer/ yarn build` then the preview serves the app at `/explorer/`
     with no failed request.
  5. `docker build -t explorer-stage02 .` succeeds (run `docker ps` first).
  6. The dev server runs and the explorer page lists preprod requests.
- **Report must include:** the census table, and the workflow lines that stage 07 must change.

### Step 02.2: the three new packages, wired and proven

- **Stream / model:** `workspace` / `fable` (the same agent as 02.1 unless it reported `tight`)
- **Waits on:** 02.1
- **Runs in:** main worktree
- **Packs:** `checks-and-tooling.md`, `service-pattern.md`, `backend-conventions.md`
- **Scope:** `packages/lib`, `packages/api`, `packages/backend`, root configuration,
  `packages/ui` only for the one proving import
- **Context:** light
- **Goal:** Empty packages that the rest of the task can fill without touching tooling again.
- **Work:**
  1. Create the three packages with the `exports`, `tsconfig` and run settings that step 01.3
     proved (gate G5).
  2. Each has `typecheck`, `lint`, `test` scripts. `lib` and `api` test in Vitest's Node
     environment AND are importable by the UI's browser tests. `backend` tests in Node.
  3. Prove the wiring with the smallest real thing: one trivial exported constant in `lib`,
     re-exported through `api`, imported by `ui` (rendered nowhere, asserted in a test) and by a
     `backend` entry point that prints it under `node`. Remove nothing afterwards: the proof
     stays until stage 03 replaces it with real code, and the report says where it is.
  4. Enforce the dependency direction with a check that fails: `ui` and `backend` must not import
     each other, `lib` must not import `api`, `api` must not import `ui` or `backend`. Use the
     linter if it can express it, otherwise a small script wired into `yarn check`. Plant a
     violation, watch it fail, restore from a copy of the file (never with git).
  5. Record the dependency direction in the repository's engineering rules.
- **Exit check:** `yarn check` and `yarn build` pass at the root. `node` runs the backend entry
  and prints the constant. The planted violation failed the check (quote the failure).
- **Report must include:** the commands to run each package's checks alone.

### Step 02.3: a committed browser smoke test

- **Stream / model:** `ui` / `opus`
- **Waits on:** 02.1
- **Runs in:** own worktree `bernard/02-ui-smoke`
- **Packs:** `checks-and-tooling.md`, `ui-codebase.md`
- **Scope:** `packages/ui` (a script and its `package.json` entry)
- **Context:** light
- **Goal:** One command that proves the running app works in a real browser.
- **Work:**
  1. A script, run as `yarn workspace <ui> smoke <base URL>`, using the Playwright already in the
     dev dependencies. It loads every route, waits for the explorer list to show at least one
     row, expands one row whose response column is filled, and waits for the three event
     sections and the signature check.
  2. It fails (non-zero exit) on any console error, page error, failed request or HTTP status of
     400 or more, and prints which. It scrubs `project_id=` from everything it prints.
  3. It takes the expectations that vary (must rows exist, which network) as arguments, so it
     serves the fake-backed UI in stage 04 and the real one in stage 05.
  4. Prove it can fail: point it at a URL that serves nothing, and at the app with a deliberately
     wrong project id, and quote both failures.
- **Exit check:** the smoke command passes against the dev server on preprod, and fails in the two
  planted cases.
- **Report must include:** the exact command line for each mode.

### Step 02.4: independent review

- **Stream / model:** `review` / `fable`, fresh
- **Waits on:** 02.2, 02.3 merged
- **Runs in:** main worktree, read only
- **Packs:** `checks-and-tooling.md`, `ui-codebase.md`
- **Scope:** none (read only)
- **Context:** heavy
- **Goal:** Find what the builders missed. The reviewer is given the diff range and the exit
  checks, never a builder's summary.
- **Work:**
  1. Review `git diff <stage start>..HEAD` for: a stale path anywhere in the repository (grep for
     the old paths yourself), a behaviour change in the app, a rule violation, a dead file.
  2. Run the stage exit check independently.
- **Exit check:** a list of findings, each with file and line and a concrete failure, or "none".
- **Report must include:** findings ranked by severity.

The orchestrator sends each confirmed finding back to the stream that owns the code.

## Gates

none

## Stage exit check

Run from the main worktree after 02.3 is merged and review findings are fixed:

1. `yarn install --immutable && yarn check && yarn build`.
2. The two `.wasm` files, and no third.
3. `EXPLORER_BASE_PATH=/explorer/ yarn build`, preview, smoke against the preview URL.
4. Smoke against the dev server on preprod.
5. `docker build` of the root image.
6. `git grep -n "src/lib\|src/components\|src/routes" -- ':!agent-work' ':!packages'` returns only
   lines that are correct relative paths. Read each hit.

## Checkpoint

Commit and push. Mark stage 02 `done`. Rewrite `knowledge/checks-and-tooling.md` and
`knowledge/ui-codebase.md` for the new paths and commands (every path in them is checked by
`ls`, every command by running it). Record the workflow lines to change in stage 07's plan.
