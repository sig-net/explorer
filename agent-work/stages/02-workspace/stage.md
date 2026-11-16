# Stage 02-workspace

## Delivers

A yarn workspaces monorepo. The app of today is `packages/ui` and behaves as before. `packages/lib`, `packages/api` and `packages/backend` exist, typecheck and test, with every dependency the later stages need already in the lockfile. `packages/lib` holds the modules that both the browser and Node use.

## Assumes

- Stage 1 changed nothing in the shape of the repository: its outcomes (D27, D28, D29) are defaults of the ingest, and nothing outside `agent-work/` changed since 4234222.
- The layout was prototyped in a scratch copy at 2adc538 before this stage was confirmed: the root scripts of step 02.1, the UI in `packages/ui` and an empty `packages/lib` passed typecheck, lint, format check, all 143 tests and the build with its 2 WebAssembly files. The UI image build under the new layout was not tried.
- D07, D09, D16 to D25 and D30 to D32 of `decisions.md`.

## Shape

A chain: 02.1, then 02.2, then 02.3. Every later step in the task builds on the layout, and the manifests and the lockfile are one path, so nothing here can run side by side. Each step's check runs the repository's checks (a Chromium for the UI tests), step 02.1's and the stage's also build a Docker image, and step 02.3's runs the UI tests a second time. An agent runs its check with `agent-work try <step>`: the scripts are in `agent-work/stages/02-workspace/checks/`.

## Gates

- **Does anything outside the repository's own files name a path that moves?** Step 02.1 lists every reference it could not update (the two workflows name `dist` and the root `Dockerfile`). The orchestrator carries that list into step 05.3, which writes it into the closing report for the user. No fallback is needed: the workflows run on a release tag alone, so they fail only if the user tags a release of this branch before changing them. The orchestrator says so to the user when it closes this stage.
- **Whose `.env.local` stops being read?** From step 02.1 on, Vite reads it from `packages/ui/` (D31). No check depends on the file. When it closes this stage the orchestrator tells the user to move theirs, and carries the line into step 05.3's closing report.
