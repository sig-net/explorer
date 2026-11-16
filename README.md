# Explorer

The explorer shows sig.network activity across supported networks. On Midnight it lists every
request made to the Signet contracts, with the MPC's signatures and attestations, and checks each
of them in the browser.

## How it fits together

The explorer is three parts.

- **The UI** is a React single-page application, served as static files from GitHub Pages or from
  its own image. It reads Midnight data from the backend alone, through the backend's HTTP API,
  whose URL it takes from `VITE_EXPLORER_API_URL` at build or start time. It checks signatures
  and attestations itself, and asks EVM RPC nodes and the MPC's output cache directly from the
  browser for what those checks need.
- **The backend** is a Node process. For each configured Midnight network it reads the Signet
  contracts' events from an indexer (Blockfrost's, on preprod), inspects the transaction behind
  each request, and stores everything in PostgreSQL. It serves what it stored to the UI as
  read-only JSON, across origins under CORS. The indexer's credentials stay on the server.
- **PostgreSQL** 17 holds one schema per network. Only the backend writes them: it creates and
  migrates the schemas at start.

Why it is built this way is recorded in [DECISIONS.md](DECISIONS.md).

## Workspaces

The repository is a Yarn workspaces root with four packages:

| Folder             | Package                     | What it holds                                                                                                                                           |
| ------------------ | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/ui`      | `@sig-net/explorer-ui`      | The browser app. Its reference is [packages/ui/README.md](packages/ui/README.md)                                                                        |
| `packages/backend` | `@sig-net/explorer-backend` | The backend and its image. Its reference is [packages/backend/README.md](packages/backend/README.md)                                                    |
| `packages/api`     | `@sig-net/explorer-api`     | The HTTP contract between them: the service interface, the wire format, the routes and the client the UI calls                                          |
| `packages/lib`     | `@sig-net/explorer-lib`     | What the browser and Node both run: the network set, contract address parsing, Signet event decoding and the grouping of events into request lifecycles |

## Requirements

- Node.js 24 or newer: the backend runs its TypeScript sources directly.
- Corepack, which ships with Node.js. Running `yarn` picks up the version pinned in
  `package.json`. If the shim is missing, run `corepack enable` once.
- Docker, for the local PostgreSQL and the images.
- The Chromium build the UI's tests run in, installed once with:

```bash
yarn workspace @sig-net/explorer-ui playwright install chromium
```

## Scripts

| Command             | What it does                                                             |
| ------------------- | ------------------------------------------------------------------------ |
| `yarn dev:ui`       | Start the UI's dev server with hot module replacement                    |
| `yarn dev:backend`  | Start the backend with `packages/backend/.env.local`                     |
| `yarn db:up`        | Start a local PostgreSQL 17 for the backend and wait until it is healthy |
| `yarn db:down`      | Stop the local PostgreSQL, keeping its data                              |
| `yarn build`        | Type-check the UI and emit its production build to `packages/ui/dist`    |
| `yarn preview`      | Serve the UI's production build locally                                  |
| `yarn typecheck`    | Type-check every workspace                                               |
| `yarn lint`         | Run Oxlint over the repository                                           |
| `yarn format`       | Format the repository with Oxfmt                                         |
| `yarn format:check` | Fail if any file is not formatted                                        |
| `yarn test`         | Run every workspace's tests once                                         |
| `yarn check`        | Typecheck, lint, format check and test in sequence                       |

## Running it locally against preprod

Install the dependencies:

```bash
yarn install
```

Start PostgreSQL. It listens on `127.0.0.1:5432`, or on the port `EXPLORER_POSTGRES_PORT` names,
which the database URL below then carries:

```bash
yarn db:up
```

The backend reads preprod from Blockfrost, which needs a project id: create a project for Midnight
Preprod at <https://blockfrost.io> and copy its id. Write the backend's configuration to
`packages/backend/.env.local`, which git ignores:

```dotenv
EXPLORER_DATABASE_URL=postgres://explorer:explorer@127.0.0.1:5432/explorer
EXPLORER_HOST=127.0.0.1
EXPLORER_CORS_ORIGINS=http://localhost:5173
EXPLORER_MIDNIGHT_NETWORKS=preprod
EXPLORER_MIDNIGHT_PREPROD_BLOCKFROST_PROJECT_ID=<your project id>
```

Start the backend. It listens on `127.0.0.1:8080`, migrates the database and starts reading
preprod from the block the Signet contracts were deployed in, logging each range it stores:

```bash
yarn dev:backend
```

Point the UI at it in `packages/ui/.env.local`:

```dotenv
VITE_EXPLORER_API_URL=http://127.0.0.1:8080
```

Start the UI and open <http://localhost:5173/>:

```bash
yarn dev:ui
```

The page lists the requests stored so far and says how far the backend has indexed. Every variable
the backend reads is in [packages/backend/README.md](packages/backend/README.md), and every variable
the UI reads in [packages/ui/README.md](packages/ui/README.md).

## Tests

The backend's tests that touch the database need a PostgreSQL 17 named by
`EXPLORER_TEST_DATABASE_URL`, and fail without it. With `yarn db:up` running:

```bash
EXPLORER_TEST_DATABASE_URL=postgres://explorer:explorer@127.0.0.1:5432/explorer yarn check
```

The UI's tests run in headless Chromium.

## Images

There are two images, and both are built with the repository root as context:

```bash
docker build -f packages/ui/Dockerfile -t explorer .
```

```bash
docker build -f packages/backend/Dockerfile -t explorer-backend .
```

The UI's image serves the production build with nginx on port 8080 and takes its `VITE_` variables
from the container's environment at start. The backend's image runs the backend on port 8080 and
is meant for a Kubernetes deployment of one replica. Each package's README says how to run its
image.

Both release workflows described below fail as committed. What follows says what each does once
the changes listed under [Corrections the workflows need](#corrections-the-workflows-need) are
made.

The `docker-publish` workflow publishes the UI's image to GitHub Packages on a release tag:

```bash
git tag v1.2.0-rc.1 && git push origin v1.2.0-rc.1
```

gives `ghcr.io/sig-net/explorer:v1.2.0-rc.1`, also tagged with the commit hash and, for every
publish, `latest`. A stable tag (`v1.2.0`) must point at a commit on `main`, while `-rc` tags may
come from any branch. The workflow builds linux/amd64 and linux/arm64 on native runners and
combines them into one multi-architecture manifest, passing the tag to the build as
`EXPLORER_VERSION` for the footer. The arm64 build runs without credentials and hands its image
over as a run artifact, which only the publishing job pushes.

No workflow publishes the backend's image.

## GitHub Pages

The `pages-deploy` workflow builds the UI and deploys it to GitHub Pages, at
<https://sig-net.github.io/explorer/>. There is one environment, so the release flow is short:
merge `dev` into `main`, tag the commit on `main` as `vX.Y.Z`, and push the tag. The workflow runs
for that tag form alone, and it fails before building anything when the tagged commit is not on
`main`. Pages holds one site, so each deploy replaces the one before it.

The site is served under `/explorer/`, which the workflow passes to the build as
`EXPLORER_BASE_PATH`, and the workflow copies `index.html` to `404.html` so that a deep link loads
the app. [packages/ui/README.md](packages/ui/README.md) explains both. The deployment runs in the
`github-pages` environment, whose deployment rules must allow release tags (a tag rule
`v[0-9]*.[0-9]*.[0-9]*`). Under Settings, Pages, the source is "GitHub Actions".

Vite inlines `VITE_` values at build time, and the site reaches its backend only when the build
sets `VITE_EXPLORER_API_URL`. The backend must then list `https://sig-net.github.io` in its
`EXPLORER_CORS_ORIGINS`.

## Corrections the workflows need

The UI builds into `packages/ui/dist` and its image is built from `packages/ui/Dockerfile`. The
two workflows read `dist` and a `Dockerfile` at the repository root, where neither exists.

In `.github/workflows/pages-deploy.yml`:

- Line 81: `cp dist/index.html dist/404.html` becomes
  `cp packages/ui/dist/index.html packages/ui/dist/404.html`.
- Line 84: `path: dist` becomes `path: packages/ui/dist`.
- Lines 74 to 78, the `env` of the build step: add `VITE_EXPLORER_API_URL`, set to the public URL
  of the backend. A build without it produces a site that reaches no backend.

In `.github/workflows/docker-publish.yml`:

- Lines 72 and 108: each `context: .` gains the line `file: packages/ui/Dockerfile` beside it. The
  context stays the repository root.
- Line 1: the comment's "root Dockerfile" becomes `packages/ui/Dockerfile`.
