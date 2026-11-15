# Pack: layout

Read this from stage 02 on, before making or touching a package: its name, how it is imported,
how it is checked and where its database comes from. Lines marked `[unverified]` are the plan's
conventions that nothing has run yet: stage 02 proves them, and its planner then marks them.

## Packages

- Yarn workspaces `packages/*`, all private: `@explorer/lib`, `@explorer/api`, `@explorer/backend`, `@explorer/ui` (D25). Dependencies point one way: `lib` <- `api` <- `ui` and `backend` (architecture, section 2). [unverified]
- A package's `package.json` has `"type": "module"` and `"exports"` that point at its TypeScript SOURCE (`./src/index.ts`): nothing is built to be imported. `@explorer/api` has three entries: `.` (resources, service interfaces, args and reply types), `./http` (clients, adaptors, the route table) and `./fakes` (in-memory services and fixtures). [unverified]
- Inside `lib`, `api` and `backend`, an import of a sibling file is relative and ends in `.ts`. No `@/` alias, no `enum`, no parameter property, no namespace: Node strips types and runs nothing else. The `@/` alias stays in `packages/ui` only, where Vite resolves it. [unverified]
- Whether Node 24.18 runs this with no build is gate G10 of stage 01: read its verdict in `decisions.md` before relying on it. [unverified]
- `lib` and `api` run in the browser AND in Node: no `node:` import, no `process`, no DOM, no `import.meta.env`. `backend` is Node only. `ui` is browser only. [unverified]
- Nothing in `lib` or `api` may reach the ledger WebAssembly or `@midnight-ntwrk/midnight-js-types` at runtime: the UI imports both packages on its first load. After any change to their imports, build the UI and count the `.wasm` files. [read 6ee55f6]

## Tooling

- One `oxlint` and one `oxfmt` configuration at the root cover every package. Type-aware lint needs each package's `tsconfig.json`. The React and Tailwind rules apply to `packages/ui/src` only. [unverified]
- `tsc -b` at the root type-checks every package through project references. Each package keeps the strictness of today's `tsconfig.app.json:12-21`: `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `verbatimModuleSyntax`. [unverified]
- Tests: `packages/ui` keeps vitest's browser mode. `lib`, `api` and `backend` run vitest in the Node environment. The root `yarn test` runs all of them, and the root `yarn check` stays typecheck, lint, format check, tests, in that order. [unverified]
- Every dependency a later step needs is added by the step the stage file names for it, so that two steps running side by side never both change `yarn.lock`. A step that finds it needs another dependency reports BLOCKED: it does not add it. [unverified]

## Postgres

- `compose.yaml` at the root has one service, `postgres`, image `postgres:18`, bound to `127.0.0.1` on host port 5433, or on `EXPLORER_POSTGRES_PORT` when that is set (D27). Its data is under `/var/lib/postgresql`, as that image keeps it. [unverified]
- Start it with `docker compose -p explorer up -d --wait postgres`. Every worktree uses the same project name, so the second `up` finds the first one's container and starts nothing. Never `down` it: another step may be using it. [unverified]
- Tests never share a database. A test file asks the harness (`packages/backend/src/testing/scratch-database.ts`) for a scratch database with a random name in that one server, with the shipped migration applied, and drops it when it ends. So steps running side by side, and test files running side by side, cannot see each other's rows. [unverified]
- The connection string of the local server is not a secret, and it still goes in the gitignored `.env` of `packages/backend`, under `DB_CONNECTION_STRING`, with a tracked `.env.example` beside it that holds names and local values only. [unverified]
- No port 5432, 5433 or 5442 was listening and no Postgres image was present on this machine when the plan was written. [run 6ee55f6]
