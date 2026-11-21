# Explorer backend

The backend is one Node process. For every configured Midnight network it runs an ingest loop that
reads the Signet signer's and responder's events from an indexer, inspects the transaction behind
each request notification, and stores all of it in PostgreSQL. It serves what it stored to the UI
as read-only JSON over HTTP.

Node runs the TypeScript sources in `src` directly, in development, in the tests and in the image:
there is no build step. `src/main.ts` is the entry point. Why the backend is built this way is
recorded in [DECISIONS.md](../../DECISIONS.md).

## Configuration

The backend reads its configuration from the environment once, at start. A variable set to the
empty string counts as unset. When any variable is missing or invalid, the process prints one line
per problem, naming the variable and what it expects but never its value, and exits 1 before it
listens. For example:

```text
the environment is not a valid configuration:
EXPLORER_DATABASE_URL is invalid: expected a postgres:// or postgresql:// connection URL
EXPLORER_PORT is invalid: expected a TCP port from 1 to 65535
EXPLORER_CORS_ORIGINS is required: expected * alone, or comma separated origins such as https://example.org
```

| Variable                         | Default   | Value                                                                                                                                                                         |
| -------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EXPLORER_DATABASE_URL`          | required  | A `postgres://` or `postgresql://` connection URL                                                                                                                             |
| `EXPLORER_HOST`                  | `0.0.0.0` | The address the server listens on: a host name or an IP address                                                                                                               |
| `EXPLORER_PORT`                  | `8080`    | The TCP port the server listens on, 1 to 65535                                                                                                                                |
| `EXPLORER_CORS_ORIGINS`          | required  | `*` for every origin, or a comma separated list of exact origins (`https://sig-net.github.io,http://localhost:5173`). A browser on any other origin gets no CORS headers back |
| `EXPLORER_MIDNIGHT_NETWORKS`     | required  | The networks to index, comma separated and distinct, among `undeployed`, `preview`, `preprod` and `mainnet`                                                                   |
| `EXPLORER_POLL_INTERVAL_SECONDS` | `30`      | The wait after a cycle that stored nothing, a whole number above 0                                                                                                            |
| `EXPLORER_TIP_MARGIN_BLOCKS`     | `6`       | How many blocks below the indexer's tip the processed block stays, a whole number                                                                                             |
| `EXPLORER_MAX_RANGE_BLOCKS`      | `2000`    | The most blocks one cycle reads, a whole number above 0                                                                                                                       |

The last three apply to every network.

Each network named in `EXPLORER_MIDNIGHT_NETWORKS` reads the variables below, where `<NETWORK>` is
the network id in capitals (`EXPLORER_MIDNIGHT_PREPROD_START_BLOCK`). A network that is not named
reads none of them.

| Variable                                                 | Default                                                                         | Value                                                                                              |
| -------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `EXPLORER_MIDNIGHT_<NETWORK>_INDEXER_URL`                | required, except on preview and preprod (below)                                 | The `http://` or `https://` URL of the indexer's GraphQL endpoint                                  |
| `EXPLORER_MIDNIGHT_<NETWORK>_BLOCKFROST_PROJECT_ID`      | preview and preprod only (below)                                                | A Blockfrost project id for that Midnight network, without whitespace                              |
| `EXPLORER_MIDNIGHT_<NETWORK>_SIGNER_CONTRACT_ADDRESS`    | the address the SDK publishes for the network, if it has one                    | The Signet signer's contract address: 32 bytes of hex, with or without `0x`                        |
| `EXPLORER_MIDNIGHT_<NETWORK>_RESPONDER_CONTRACT_ADDRESS` | the address the SDK publishes for the network, if it has one                    | The Signet responder's contract address, in the same form                                          |
| `EXPLORER_MIDNIGHT_<NETWORK>_START_BLOCK`                | `44831` on preview and `3386746` on preprod, with the SDK's published addresses | The lowest block height to read events from, a whole number. Required wherever there is no default |

Preview and preprod each take exactly one of `EXPLORER_MIDNIGHT_<NETWORK>_INDEXER_URL` and
`EXPLORER_MIDNIGHT_<NETWORK>_BLOCKFROST_PROJECT_ID`. The project id names Blockfrost's indexer of
that network, `https://midnight-preview.blockfrost.io/api/v0` or
`https://midnight-preprod.blockfrost.io/api/v0`, with the id in its `project_id` query parameter.
To get one, create a project for that Midnight network at <https://blockfrost.io>. Preview also has
a public indexer that takes no token, `https://indexer.preview.midnight.network/api/v4/graphql`,
which `EXPLORER_MIDNIGHT_PREVIEW_INDEXER_URL` can name. A project id is
a secret: the backend cuts the query string and any user and password from every URL it logs or
serves, so the UI shows the indexer's URL without it.

A local `undeployed` stack generates its own contracts, so it needs its indexer URL, both addresses
and a start block.

## HTTP API

Every route answers JSON to `GET`. The routes under `/v1` are the contract the UI's client calls
(`packages/api`).

| Route                                            | Answer                                                                                                                                                    |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/v1/networks`                                   | Every served network with its configuration (addresses, start block, indexer URL without its query string) and its sync state (below)                     |
| `/v1/networks/<network>/lifecycles`              | One page of request lifecycles, newest first, with the counts of matching and of all requests and events                                                  |
| `/v1/networks/<network>/lifecycles/<request id>` | The lifecycle of one request id (32 bytes of hex), or 404 `not_found` when no stored event declares it                                                    |
| `/v1/networks/<network>/callers`                 | The distinct caller contract addresses of the network's request notifications, in ascending order                                                         |
| `/healthz`                                       | 200 `{"status":"live"}` whenever the process is up                                                                                                        |
| `/readyz`                                        | 200 `{"status":"ready"}` from the moment every configured network's schema is migrated until a shutdown begins, 503 `{"status":"not ready"}` outside that |

The lifecycles route takes four query parameters, each optional:

- `search`: a fragment of a request id or of a caller contract address, in any case and with an
  optional `0x`. A fragment shorter than 3 characters, once trimmed and cut of its `0x`, is no
  search and matches every lifecycle.
- `excludeCallers`: a comma separated list of caller contract addresses whose lifecycles are left
  out. A lifecycle that names no caller is always kept.
- `limit`: the page size, 50 by default, at most 200.
- `before`: the `nextBefore` of the previous page, to read the page after it. `nextBefore` is null
  on the page that holds the oldest match.

A failure answers `{"error":{"code":"...","message":"..."}}`: 404 `unknown_network` for a network
the backend does not serve, 404 `not_found` for any other path, 400 `invalid_request` for a query
or request id out of bounds, and 500 `unavailable` for anything unexpected, such as a database that
is down. `/readyz` does not ask the database, so it stays 200 while the database is down: the
routes answer 500 and each network's sync state shows the failed reads.

## The ingest

Each network has a processed block: the claim that every event up to that block is stored. One
cycle of a network's loop:

1. Checks that the indexer is the chain the network was indexed from (its genesis block hash) and
   that the configured addresses and start block are the ones the network was indexed for. It also
   checks that the indexer's block at the processed block still has the stored hash.
2. Reads every event both contracts emitted in the next range of blocks, from just above the
   processed block up to `EXPLORER_MAX_RANGE_BLOCKS` blocks further, and never closer than
   `EXPLORER_TIP_MARGIN_BLOCKS` to the indexer's tip.
3. Fetches the raw transaction behind each request notification and reads in it the call chains and
   the request record.
4. In one database transaction, stores the events and transactions and moves the processed block to
   the end of the range.

The processed block moves only in the transaction that stores its data, and only when it still holds
the value the cycle started from. A cycle that fails at any point stores nothing, so the next one
reads the same range again. After a cycle that stored a range, the next starts at once. After a
cycle that found nothing new, the loop waits `EXPLORER_POLL_INTERVAL_SECONDS`. After a failure it
waits twice the poll interval, doubling with each failure in a row, up to 5 minutes.

The ingest only inserts: it never changes or deletes a stored event. Each network lives in its own
PostgreSQL schema, `midnight_<network>` (`midnight_preprod`), which the backend creates and
migrates at start.

### Sync states

`/v1/networks` reports each network's `state`, the processed block and its time, the indexer's tip
as last read, the time of the last successful cycle and the error of the latest cycle (null when it
succeeded):

| State      | Meaning                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------ |
| `starting` | No cycle has read the indexer yet                                                          |
| `syncing`  | The processed block is more than the tip margin below the tip, and the loop is catching up |
| `synced`   | The processed block is the tip margin below the tip                                        |
| `stopped`  | The indexer or the configuration differs from what the network was indexed for (below)     |

A failed cycle keeps the state it had and sets the error.

### A stopped network

A network stops when the check of step 1 fails: the indexer's genesis hash, a contract address or
the start block differs from what the network's schema was indexed for, or the indexer's block at
the processed block has another hash. The backend then reads nothing more for it, keeps serving
what it stored, logs `the network stopped` with the reason, and reports `stopped` with the reason as
its error. It never deletes anything on its own: a misconfigured variable cannot erase a network's
history.

The loop checks a stopped network again every poll interval, and the network resumes from where it
stopped as soon as the check passes. Two things make it pass:

- The configuration is put back as it was, and the backend restarted with it.
- An operator wipes the network, when the change is meant: a new contract pair, a new start block,
  or a chain that was reset.

To wipe a network, run the backend's wipe command with the backend's own environment:

```bash
node packages/backend/src/main.ts wipe-network preprod
```

In the image, the working directory is the repository root, so the same command runs in the
backend's container, for example with `kubectl exec` in its pod, which holds the environment
already. On a developer's machine, give it the backend's env file:

```bash
node --env-file=packages/backend/.env.local packages/backend/src/main.ts wipe-network preprod
```

It drops the network's schema with everything in it, migrates it again and prints
`dropped and migrated the schema midnight_preprod`. A backend that is running indexes the network
again from its start block at its next cycle, with no restart. A network the configuration does not
name exits 1 and drops nothing.

## Logs

The backend logs one JSON object a line on stdout, with `time`, `level` (`info` or `error`),
`message`, and `network` where one applies. Every text is cut of URL query strings and credentials.

| Message                         | Level   | When                                                                                                                             |
| ------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `listening`                     | `info`  | The server listens, with `host` and `port`                                                                                       |
| `migrating`, `migrated`         | `info`  | Around each network's migration at start                                                                                         |
| `the migration failed`          | `error` | A migration failed, with `error`: the process then stops and exits 1                                                             |
| `stored blocks`                 | `info`  | A cycle stored a range, with `fromBlock`, `toBlock` and `events`                                                                 |
| `caught up`                     | `info`  | A cycle found nothing new, logged only when the cycle before it had another outcome                                              |
| `superseded`                    | `info`  | The processed block or the network's identity changed during the cycle (another writer, or a wipe), and the cycle stored nothing |
| `the cycle failed`              | `error` | A cycle failed, with `reason`                                                                                                    |
| `the network stopped`           | `error` | A network stopped, with `reason`                                                                                                 |
| `the ingest loop did not start` | `error` | A network's loop could not start, with `error`                                                                                   |
| `shutting down`, `shut down`    | `info`  | Around a shutdown                                                                                                                |

## Starting and stopping

The process listens first, then migrates every configured network's schema, then starts the ingest
loops. `/readyz` answers 503 until the migrations are done. A migration that fails is logged and the
process exits 1. A server that cannot listen (a port already taken) also exits 1.

On SIGTERM or SIGINT the backend answers `/readyz` with 503, stops accepting requests, ends every
network's loop, waits at most 8 seconds for the cycles in flight, closes its database pool and
exits 0. A cycle still reading after 8 seconds is abandoned. It has stored nothing, so the processed
block stays before its range.

## Running it locally

The repository's [README](../../README.md) runs the backend with a local PostgreSQL against
preprod. In short, from the repository root:

```bash
yarn db:up
yarn dev:backend
```

`yarn db:up` starts PostgreSQL 17 from `packages/backend/compose.yaml` on `127.0.0.1`, on the port
`EXPLORER_POSTGRES_PORT` (default 5432), with the user, password and database all `explorer`.
`yarn dev:backend` reads `packages/backend/.env.local`. `yarn db:down` stops PostgreSQL and keeps
its data in a Docker volume. Docker Compose names the project after the folder, `backend`, so two
checkouts on one machine share that database unless one sets `COMPOSE_PROJECT_NAME`.

## Tests

```bash
EXPLORER_TEST_DATABASE_URL=postgres://explorer:explorer@127.0.0.1:5432/explorer yarn workspace @sig-net/explorer-backend test
```

The tests that touch the database need a PostgreSQL 17 server named by `EXPLORER_TEST_DATABASE_URL`,
where they may create databases: `yarn db:up` gives one. Each test file makes a database of its own
and drops it at the end. With the variable unset, those tests fail, they never skip.

One test reads preprod itself, and runs only when `EXPLORER_TEST_PREPROD_INDEXER_URL` names a
preprod indexer URL, project id included.

## Image

`packages/backend/Dockerfile` builds an image that runs the sources with their production
dependencies on Node 24, as the user `node`, listening on 8080. Its build context is the repository
root, since the backend imports the `lib` and `api` workspaces. From the root:

```bash
docker build -f packages/backend/Dockerfile -t explorer-backend .
```

The image takes its whole configuration from the environment. To try it against the local
PostgreSQL of `yarn db:up`, which listens on the host's `127.0.0.1`, share the host's network:

```bash
docker run --rm --network host --env-file packages/backend/.env.local explorer-backend
```

## Migrating

The backend migrates every configured network's schema when it starts, before it reports ready.
The same migration runs alone, for a step that must finish before the server starts (an init
container):

```bash
node packages/backend/src/main.ts migrate
```

It reads the same configuration as the server, prints `migrated the schemas midnight_preprod` with
every schema it migrated, and exits 0. A migration that fails exits 1 with the reason. Running it
again changes nothing.

## Deploying to Kubernetes

The repository delivers the image, `ghcr.io/sig-net/explorer-backend`, and no manifests. A
deployment provides:

- Optionally an init container that runs `node packages/backend/src/main.ts migrate` in the same
  image with the same variables, so that a failed migration shows as a failed init container.

- One replica. Readiness does not follow the database, so a second pod would gain nothing when the
  database is down, and every pod would run its own ingest loops.
- The variables above, with the Blockfrost project id from a Secret. `EXPLORER_CORS_ORIGINS` names
  the origin the UI is served from (`https://sig-net.github.io` for GitHub Pages). Leave
  `EXPLORER_HOST` at its default so the pod listens on every interface.
- A liveness probe on `GET /healthz` and a readiness probe on `GET /readyz`, both on port 8080.
- The default termination grace period of 30 seconds or more: the backend needs about 8 seconds to
  stop.
- A PostgreSQL 17 database the backend's user can create schemas in, and where the backend may
  create the `pg_trgm` extension (`CREATE EXTENSION IF NOT EXISTS pg_trgm`), which the search
  indexes use. A user that cannot create it needs the extension created beforehand by one that
  can.
- Outbound HTTPS to the indexer. Against Blockfrost, a preprod network that is caught up sends
  about 28,000 to 31,000 requests a day at the default poll interval (63 requests in 7 polls over
  195 seconds, and 114 requests in 320 seconds, each measured once). Each poll finds a few new
  blocks, stores them with 6 requests and checks the tip again with 3, and each transaction that
  emitted a sign bidirectional event adds one. A longer poll interval lowers that roughly in
  proportion.
