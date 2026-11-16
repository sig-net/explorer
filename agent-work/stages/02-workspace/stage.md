# Stage 02-workspace

## Delivers

A yarn workspaces monorepo. The app of today is `packages/ui` and behaves as before. `packages/lib`, `packages/api` and `packages/backend` exist, typecheck and test, with every dependency the later stages need already in the lockfile. `packages/lib` holds the modules that both the browser and Node use.

## Assumes

- Stage 1 found nothing that changes the shape of the repository.
- D07, D09 and D16 to D25 of `decisions.md`.

## Shape

A chain: 02.1, then 02.2, then 02.3. Every later step in the task builds on the layout, and the manifests and the lockfile are one path, so nothing here can run side by side. One step's check runs the repository's checks (a Chromium for the UI tests) and step 02.1's builds a Docker image.

## Gates

- **Does anything outside the repository's own files name a path that moves?** Step 02.1 lists every reference it could not update (the two workflows name `dist` and the root `Dockerfile`). The orchestrator carries that list into step 05.3, which writes it into the closing report for the user. No fallback is needed: the workflows run on a release tag alone.
