# Stage 02-workspace

## Delivers

The repository as a Yarn workspace with no change in what the app does: the app in
`packages/ui`, and `packages/backend` holding its dependencies, a local Postgres and the harness
its tests get a database from. `packages/lib` and `packages/api` are NOT made here: each is made
in stage 03 by the step that gives it its first real content, so no empty package ever exists.

## Assumes

- G10 (stage 01): Node runs TypeScript source across workspace packages with no build. If it
  failed on source imports, step 02.2 adds `tsx` and the start scripts use it.
- D15, D25: the folders and the package names. D27: the local Postgres.
- D35: no workflow file changes in this task. `pages-deploy.yml` uploads `dist` from the root,
  so from this stage on that workflow would fail on this branch. It runs on release tags on
  `main` only, and this branch is never tagged. What it needs is in the list stage 07 leaves
  for the user.
- The app's 143 tests all pass at the baseline. None may be lost by the move.

## Shape

A chain of two. 02.1 moves everything and rewrites the root manifest and the lockfile, so
nothing can run beside it. 02.2 adds the backend package and EVERY dependency the backend will
need up to stage 06, so that the steps of stages 03 and 04 that run side by side never touch
`yarn.lock`.

## Gates

| Gate | Question | Answered by | Outcome and fallback |
| --- | --- | --- | --- |
| G13 | Does Yarn link the workspaces so that plain Node resolves `@explorer/backend`'s imports with no build? | 02.2, by a script the check runs | Yes: as planned. No: `tsx` is added in 02.2 and every later start command uses it. Either way the planner marks the `[unverified]` lines of the `layout` pack |
| G14 | Does the image still build from the workspace? | the stage check, `docker build` | Yes: as planned. No: 02.1 is sent back, the image is part of its move |
