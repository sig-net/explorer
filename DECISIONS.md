# Decisions

Why the explorer is built as it is. Each section names a choice someone could be tempted to
undo, the reason for it, what was measured, and what would have to be true for the choice to
change. Measurements keep the conditions they were taken under: most are one run on a
development machine against PostgreSQL 17, and a synthetic row count is said to be synthetic.

## PostgreSQL, with one schema per network

The backend stores everything in PostgreSQL. Each network has a schema of its own, named
`midnight_<network id>` (`midnight_preprod`), with identical tables made by the same migrations.

Why PostgreSQL: the backend is a long running server with one writer per network and concurrent
readers, and the request list needs trigram search and JSON aggregation, both of which PostgreSQL
has. At 4.5 million events and 1.5 million requests (synthetic rows, one run), the newest 50
lifecycles took 0.8 ms, a fragment search over request id or caller with trigram indexes 3.9 ms,
and a count of the requests 31 ms.

Why a schema per network: a wipe of one network is one `DROP SCHEMA ... CASCADE` followed by the
migrations, no query can forget a network filter, and one set of migrations serves every network.
Tables named per network would need every statement generated per name. The prefix `midnight_`
leaves room for a second chain, whose network ids would be its own.

This would change if networks had to be queried together (a cross-network search), which a schema
per network makes awkward, or if the store had to run where PostgreSQL extensions such as
`pg_trgm` are not available.

## The request list is a maintained table read through a view

The ingest maintains a `requests` table, one row per request id, with the time of the first
request, signature and response and a count per event kind. Every caller of a request is a row of
`request_callers (request_id, caller)`, and `requests` has no caller column. The `lifecycle` view
joins a `requests` row to its events and their transactions as JSON when it is read: no copy of
the events is stored in `requests`. The rows of `requests` are written by the backend's own code
inside the ingest transaction, with no database trigger.

Why: a plain view that groups `events` by request id took 1.4 s for the newest 50 and 3.1 s with a
caller exclusion, at 4.5 million events and 1.5 million requests (synthetic rows, one run). The
maintained table with a lateral join to the events took 0.8 ms and 0.2 ms. Each event is still
stored once, the aggregation lives in one tested place in application code, and the table can be
rebuilt from `events`. A request can have several callers, and the UI searches, excludes and lists
every one of them, so a single caller column would lose what the list shows.

The four counts of a page (requests and events, in total and matching the search) are read from
`requests` and `events` in the page's own transaction, with no totals row. At 200,000 requests and
543,334 events (synthetic rows, about five months of preprod) the request counts took 5–9 ms, the
event count 25 ms, the counts under a caller exclusion 18–45 ms and the distinct callers 23 ms, so
a year of preprod stays near 100 ms. A maintained total would be one more thing the ingest
transaction could get wrong. The service's tests hold each count under 500 ms at 200,000 requests.

This would change if those counts grew past what a page can afford, at which point a totals row
maintained by the ingest becomes worth its risk.

## The processed block moves in the transaction that stores its data

Each network has one `ingest_state` row whose cursor says that every event up to block N is
stored, with the hash of block N. A cycle reads a range of blocks, then stores it in one SQL
transaction whose first statement moves the cursor:
`UPDATE ingest_state ... WHERE cursor_height IS NOT DISTINCT FROM <the height the cycle read>`,
together with the identity the cycle read (the genesis hash, the signer and responder contract
addresses and the start block). When that
statement changes no row, the transaction rolls back before anything is inserted. The cursor
starts null, and the first range starts at the configured start block.

Why: a crash or a failed read then leaves the cursor before the missing data, so the stored history
has no gaps, and two backends cannot both advance one cursor. Taking the row lock first makes the
loser of two concurrent cycles deterministic. `IS NOT DISTINCT FROM` is there because the cursor is
null until the first block is processed, and `=` never matches a null. The identity is part of the
condition because a cycle that read before a wipe could otherwise commit its events under an
identity another process had recorded since, whenever the heights happened to agree.

This would change only if the store stopped being transactional.

## The ingest only inserts

The ingest never deletes or rewrites an event, a transaction, a request or a caller. The one
removal is the operator's wipe of a whole network. A `requests` row is recomputed from the stored
events of its request id inside the transaction that stores them, and a page that meets a
`requests` row with no event fails: the service hides nothing.

Why: `request_callers` does not record which event named a caller, and its foreign key has no
`ON DELETE`. Both matter only to a writer that removes events, and there is none. A `requests` row
with no event would fail the whole page, so the ingest's test that rebuilds `requests` from
`events` is what keeps one from existing.

This would change if the source could retract an event the ingest had stored. The ingest stays 6
blocks below the indexer's tip by default, and that tip was measured at most 1 block ahead of
finality (see the source section), so the blocks it stores are final.

## The backend inspects each transaction and keeps its raw bytes

When the ingest stores a transaction that emitted sign bidirectional events, it inspects it once,
with every such event, and stores the result as JSON in `transactions.inspection`:
`{ callChains, requests: { "<event id>": { cell } or { failed } } }`, or `{ failed }` for the whole
transaction. It also stores the raw transaction bytes beside it. A transaction with no sign
bidirectional event is stored with neither. The browser loads no Midnight ledger WebAssembly.

Why inspect on the server: the raw transaction comes from the indexer, which no browser can reach,
and the inspection of a finalised transaction never changes. Why keep the raw bytes: every stored
transaction can be inspected again after a fix to the decoder, without the indexer. A request's raw
transaction was about 12.6 KB (one sample), about 6 GB a year per network at preprod's rate of
about 500,000 requests a year. The whole store of a preprod network measured 107 MB at 5,417
requests, about 20 KB a request, which is about 10 GB a year at the same rate.

A failure is stored rather than raised, because a transaction the decoder cannot read must not stop
a network for ever:

- An inspection that throws is stored as `{ failed: reason }` and the ingest goes on.
- A request cell that does not decode as an evmType2 request record is stored as failed for that
  event.
- An inspection that holds a character PostgreSQL's `jsonb` refuses (U+0000, an unpaired
  surrogate) is stored as failed for its transaction, and every text stored from outside loses
  those characters first, because one such character fails the storing transaction on every retry.
- An inspection is parsed with the wire's own schema before it is stored, and one that does not
  parse is stored as failed, so the read path never meets a stored value it rejects.
- An inspection nesting more than 64 JSON levels (about 30 nested calls) is stored as failed,
  because a value that parses at the ingest's stack depth can still overflow the stack on the read
  path, which parses it deeper inside a page. A chain 1,000 calls deep was seen to do so.

A raw transaction that cannot be fetched is different: it fails the cycle, which is retried,
because skipping it would leave a gap.

This would change if storage became the constraint, in which case the raw bytes could go and a
decoder fix would mean reading the transactions from the indexer again.

## Events and request records cross the wire as the bytes the contract emitted

The API is read only, under `/v1`: the networks with their configuration and sync state, a page of
lifecycles, one lifecycle by request id, and the callers of a network. An event crosses the wire as
its raw payload, and the browser decodes it with the SDK. The request record crosses the wire as the
cell the transcript wrote, `{ value: [hex of each atom], alignment }`, and the browser decodes it
with the SDK's `decodeEvmType2SignBidirectionalEvent`. The api package's domain inspection keeps
that cell beside the record decoded from it, so that a service holding domain lifecycles can
emit the cell again.

Why: one decoder for both sides cannot drift, and the browser's checks rest on the bytes the
contract emitted rather than on the backend's reading of them. The cell of a preprod transaction
was taken through JSON and back: the decoded records were equal and the record still hashed to its
request id. No field by field codec is written, because a second codec is a second thing to keep
in step with the contract.

This would change if the SDK's decoder stopped running in the browser.

## The indexer is the one source

The backend reads Midnight from Blockfrost's indexer over GraphQL, through the SDK's
`signetEventSourceFromIndexer`, with the project token in the server's environment. The indexer's
event id is the primary key of `events` and the order of everything. A cycle reads up to
`min(tip - tipMargin, cursor + maxRange)`, polls every 30 seconds by default, reads at most 2,000
blocks a cycle, and keeps 6 blocks behind the indexer's tip. Each of these is a configuration value
with its default defined once, in the backend's configuration. Every request to the indexer ends
after 30 seconds as a failed read.

Why: the SDK's indexer source already yields decoded events for a block range. The event id is
unique across contracts and ascended over the whole preprod history: reading it took 9.3 s for the
signer and 26.8 s for the responder, 153 pages of 100 events, at about 3.6 days of history. A 30
minute soak of preprod (blocks 3,442,003 to 3,442,279, 91 events read twice) found no event added
to a block at or below a reported tip and none vanished, so no margin is needed for late events.
The indexer's tip was ahead of finality by at most 1 block (4 polls of 361) with no hash mismatch,
and the margin is that plus 5. All 1,911 calls of the soak answered 200, at about seven times the
ingest's rate. The 30 second timeout exists because a request that never answers would hold a
network's loop for ever with no error recorded.

A source that reads a node instead would decode `Midnight.send_mn_transaction` extrinsics and
replay each call's transcripts in the ledger VM, walking finalised blocks one at a time over
JSON-RPC, as the MPC indexer does. That is a second port adaptor, worth building if the indexer
became unreliable or a self-run node became the requirement.

A poll of a caught-up network sends 9 requests to the indexer when the new blocks hold no sign
bidirectional event. The cycle that stores them sends 6: the genesis block, the block at the
cursor, the tip, the block the cursor moves to, and one page of events for each of the two
contracts. The cycle that follows at once sends the first 3 again and finds nothing to read. Each
transaction that emitted a sign bidirectional event adds one request for its raw bytes. Measured on
preprod at the default interval of 30 seconds, that was 63 requests in 7 polls over 195 seconds,
and in a second run 114 requests in 320 seconds: about 28,000 to 31,000 requests a day. The daily
quota of the Blockfrost plan is not known. If it proves smaller than that, the interval goes up.

## A network stops on a mismatch and is wiped only by an operator

When a network's genesis hash, its signer or responder contract address or its start block differs
from what its schema was indexed for,
or the source's hash at the cursor differs from the stored one, the backend stops that network and
reports it unhealthy. It never wipes on its own. A stopped network is checked again every cycle and
resumes when its stored identity matches its configuration again: after a wipe, or after the
configuration is put back.

The operator's wipe is `node packages/backend/src/main.ts wipe-network <network>`, a short process
that reads the backend's environment, drops the schema of a configured network and migrates it
again. A running backend finds the empty schema and indexes the network again from its start
block, with no restart. A network the configuration does not name exits 1 and drops nothing. In
Kubernetes it is run with `kubectl exec` in the backend's pod, which already holds the environment.

Why: a misconfigured variable then cannot erase a network's history. Demanding a wipe after the
variable is corrected would erase it all the same, which is why a corrected configuration lifts the
stop too.

This would change if networks were reset so often that an operator's step became the bottleneck.

## No URL credential leaves the server

The API returns a network's source URL without its query string and without any `user:password@`.
The api package's `textWithoutUrlCredentials` cuts every URL inside a text the same way. The wire
applies it to a network's error and to every failed inspection reason, and the backend applies it to
what it stores as the last error and to every line it logs.

Why: the UI shows the source URL for information, and the Blockfrost project token is part of that
URL's query string. Error texts quote URLs too. The wire is the one place every service passes, and
the stored copy is cut as well so that the database holds no token either.

This would change only if the token stopped travelling in a URL.

## Search

A search fragment matches a request id or any caller of the request. A fragment shorter than 3
characters is no search: it matches every lifecycle. The rule is `LIFECYCLES_MIN_SEARCH_LENGTH` in
the api package's `resolveLifecyclesQuery`, so every service follows it, and the UI says so under
the search box. The served search is always the union form,
`request_id IN (SELECT request_id FROM requests WHERE request_id LIKE x UNION SELECT request_id FROM request_callers WHERE caller LIKE x)`,
with backslash, percent and underscore escaped in `x`. The backend never runs `VACUUM`.

Why the minimum: a fragment of 1 or 2 characters has no trigram, and its counts took up to 1,006 ms
at 200,000 requests (synthetic rows). Refusing it as an invalid request would turn the first two
keystrokes into an error. Why the union form: at 200,000 requests a page took 1.4–7.3 ms and the
counts under 3 ms, against 55–103 ms for the form with `OR`. The union form loses only on a fragment
matching 80,000 requests (129 ms), which is accepted, and one form is one thing to test. Why no
`VACUUM`: 300,000 rows inserted in one statement into a table with a `gin_trgm_ops` index were
autovacuumed 60 s later with no setting changed, and the search then planned a bitmap index scan on
that index. A network just backfilled relies on that before its caller search uses the index.

This would change if broad fragments became the common search, or if autovacuum were turned off on
the database.

## How the process starts, reports ready and stops

The backend is one process that serves the HTTP API and runs one ingest loop per configured
network. It takes its configuration from the environment, including the allowed CORS origins, and
listens before it migrates. `/healthz` answers whenever the process is up. `/readyz` answers 200
from the moment every configured network's schema is migrated until a shutdown begins, and 503
outside that, without asking the database on each call. A migration that fails at start is logged
and the process exits 1.

On SIGTERM or SIGINT it answers `/readyz` with 503, stops accepting requests, aborts every
network's loop, waits at most 8 seconds for the cycles in flight, closes the pool and exits 0. A
cycle still reading after that is abandoned.

Why: this is what a Kubernetes deployment of one replica needs from an image. With one replica,
nothing is gained by leaving the service while the database is down: the routes answer 500
`unavailable` and each network's sync state shows its failed cycles. A container that exits is
restarted by Kubernetes, which is the retry. The 8 second wait fits inside the 30 seconds Kubernetes
allows by default, where one indexer request may last 30 seconds alone, and an abandoned cycle has
committed nothing, so its cursor stays before its range.

This would change with more than one replica, where readiness should follow the database so that
traffic moves to a healthy pod.

## What stays in the browser

The browser keeps what needs no Midnight node or indexer: the signature check, the attestation
check, EVM transaction status, EVM tracing and the MPC output cache. Contract addresses, the source
URL and the start block are server configuration, shown in the UI read only. The request list loads
50 lifecycles, and "Load more" loads the next 50. Search and caller exclusion are answered by the
backend, Refresh reads the first page again, and a linked request is read by its id. A developer on
a local `undeployed` stack runs the backend locally.

Why: no public Midnight node or indexer serves a browser, while EVM endpoints still do. The browser
does not hold the whole history, which at preprod's rate is about 500,000 requests and 1.5 million
events a year (about 1,400 requests and 4,200 events a day over 3.6 days of preprod, one sample).

This would change if the EVM checks also lost their browser-reachable endpoints.

## Tests run against a real PostgreSQL

Tests that touch the database run against the PostgreSQL named by `EXPLORER_TEST_DATABASE_URL`.
Each test file makes a database of its own inside it and drops it at the end. With the variable
unset, those tests fail: they never skip.

Why: the view, the trigram search and the transactions that move the cursor are PostgreSQL's own
behaviour, which a fake would not exercise. A skipped test would pass with nothing tested.

This would change only if the store stopped being PostgreSQL.

## The backend runs its TypeScript sources

The backend is built on Hono (HTTP), Kysely with `pg` (typed SQL), zod (validation of everything
that enters) and plain SQL migration files. Node runs its TypeScript sources directly, in
development, in tests and in the image, with no build step and no bundle.

Why: each library is small and typed, which the repository's type rules need. Node 24 and 26 run
the sources and resolve the workspace packages through their `node_modules` links. This holds only
while the code is erasable syntax: no enums and no parameter properties, and relative imports carry
the `.ts` extension.

This would change if the backend needed syntax Node cannot strip, or a start time a bundle would
shorten.

## Two images, both built from the repository root

There are two Dockerfiles, `packages/ui/Dockerfile` and `packages/backend/Dockerfile`, and both are
built with the repository root as context. The backend and its PostgreSQL run in Kubernetes on
Google Cloud. The repository delivers the backend's image and no Kubernetes manifests. The UI stays
a static build on GitHub Pages and calls the backend across origins, so the backend answers CORS for
the configured origins.

Why: a second image makes a bare `Dockerfile` ambiguous, and each image needs the workspace
packages it imports, which only the root context holds. The manifests belong to whoever owns the
cluster.

This would change if the UI were served from the backend's origin, which would drop CORS and could
fold the two images into one.
